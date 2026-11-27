/**
 * 弹性线网的物理积分（纯函数 / worklet，零 React 依赖）。
 *
 * 抽出来的两个理由：
 * 1. 「涟漪看不看得见」是能量问题，能算：推力 × 作用时长 = 速度增量，再除以 ω 就是
 *    峰值位移。肉眼调参数会调成「点了没反应」或「整卡乱抖」，这里可以定量。
 * 2. 组件里只留绘制与调度，物理逻辑能被单测锁住，改参数时不会静默退化。
 *
 * 注意：这个文件里的导出函数都带 `'worklet'` 指令 —— 组件在 UI 线程的
 * `useFrameCallback` 里调用它们，Reanimated 的 babel 插件会据此生成 worklet 版本。
 * 在 jest 里指令只是字符串字面量，不影响普通执行。
 */

/** 一个格点占 4 个槽位：[x, y, vx, vy]。 */
export const STRIDE = 4;

export interface GridNode {
  /** 当前 x（dp）。 */
  x: number;
  /** 当前 y（dp）。 */
  y: number;
  /** 速度 x（dp/s）。 */
  vx: number;
  /** 速度 y（dp/s）。 */
  vy: number;
  /** 原位 y（用于算偏离；x 的原位由列号推）。 */
  homeY: number;
}

export interface RippleSpec {
  speed: number;
  band: number;
  force: number;
  life: number;
}

export interface RipplePoint {
  x: number;
  y: number;
  /** 出生时刻，单位与调用方的 `now` 一致（必须是同一个时钟）。 */
  t0: number;
}

export interface SpringSpec {
  spring: number;
  damping: number;
}

/** 铺一张网：w×h 的矩形，格距 gap。坐标是格点原位。 */
export function buildGrid(w: number, h: number, gap: number): number[] {
  'worklet';
  const c = Math.floor(w / gap) + 1;
  const r = Math.floor(h / gap) + 1;
  const arr: number[] = [];
  for (let i = 0; i < c * r * STRIDE; i += 1) arr.push(0);
  for (let y = 0; y < r; y += 1) {
    for (let x = 0; x < c; x += 1) {
      const i = (y * c + x) * STRIDE;
      arr[i] = x * gap;
      arr[i + 1] = y * gap;
    }
  }
  return arr;
}

/**
 * 积分一帧。原地修改 `nodes`，返回本帧结束后整网的最大偏离与最大速度。
 *
 * 力模型（与原型 stepGrid 同构，只把衰减改成连续包络）：
 * - 回弹：`-spring * 位移 - damping * 速度`
 * - 指针斥力：`(1 - d/R)² * force`，按住时持续
 * - 涟漪：`exp(-(band/BAND)²) * force * (1 - age/LIFE)^1.5`
 *   高斯包络让「一圈」有厚度，节点进圈后受力平滑升起再落下；
 *   原来用三角形窗 `1 - band/BAND`，进圈瞬间受力最大、出圈瞬间归零，
 *   观感是「被戳一下」而不是「一波推过去」。
 */
export function stepGrid(
  nodes: number[],
  cols: number,
  rows: number,
  gap: number,
  dt: number,
  pointer: { x: number; y: number; in: number },
  ripples: RipplePoint[],
  now: number,
  spring: SpringSpec,
  repel: { radius: number; force: number },
  ripple: RippleSpec,
): { maxDev: number; maxSpd: number } {
  'worklet';
  let maxDev = 0;
  let maxSpd = 0;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * STRIDE;
      const ox = x * gap;
      const oy = y * gap;
      const nx = nodes[i];
      const ny = nodes[i + 1];

      let fx = -spring.spring * (nx - ox) - spring.damping * nodes[i + 2];
      let fy = -spring.spring * (ny - oy) - spring.damping * nodes[i + 3];

      if (pointer.in === 1) {
        const dx = nx - pointer.x;
        const dy = ny - pointer.y;
        const d2 = dx * dx + dy * dy;
        const rr = repel.radius;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const s = 1 - d / rr;
          const f = s * s * repel.force;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }

      for (let k = 0; k < ripples.length; k += 1) {
        const rp = ripples[k];
        /* t0 < 0 是「还没打时间戳」的占位，必须跳过——否则 age 会被算成巨大正值，
           实际效果是跳过，但语义上不该靠巧合；组件侧本应已补戳，这里是兜底。 */
        if (rp.t0 < 0) continue;
        const age = (now - rp.t0) / 1000;
        if (age <= 0) continue;
        const life = ripple.life / 1000;
        if (age >= life) continue;
        const rad = age * ripple.speed;
        const dx = ox - rp.x;
        const dy = oy - rp.y;
        const d2 = dx * dx + dy * dy;
        const band = Math.abs(Math.sqrt(d2) - rad);
        if (band >= ripple.band) continue;
        const shape = Math.exp(-((band / ripple.band) * (band / ripple.band)) * 2.2);
        const fade = 1 - age / life;
        const f = shape * ripple.force * fade * fade;
        if (f <= 0) continue;
        const d = Math.sqrt(d2);
        if (d < 0.001) continue;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }

      nodes[i + 2] += fx * dt;
      nodes[i + 3] += fy * dt;
      nodes[i] += nodes[i + 2] * dt;
      nodes[i + 1] += nodes[i + 3] * dt;

      const devX = nodes[i] - ox;
      const devY = nodes[i + 1] - oy;
      const adx = devX > 0 ? devX : -devX;
      const ady = devY > 0 ? devY : -devY;
      const dev = adx > ady ? adx : ady;
      if (dev > maxDev) maxDev = dev;
      const svx = nodes[i + 2];
      const svy = nodes[i + 3];
      const asx = svx > 0 ? svx : -svx;
      const asy = svy > 0 ? svy : -svy;
      const spd = asx > asy ? asx : asy;
      if (spd > maxSpd) maxSpd = spd;
    }
  }

  return { maxDev, maxSpd };
}
