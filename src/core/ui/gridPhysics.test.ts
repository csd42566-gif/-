import { STRIDE, buildGrid, stepGrid } from './gridPhysics';

const GAP = 20;

function makeGrid(w: number, h: number) {
  return buildGrid(w, h, GAP);
}

/** 取整张网的最大偏离（相对原位的最大位移）。 */
function maxDeviation(nodes: number[], cols: number, rows: number): number {
  let dev = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * STRIDE;
      const dx = Math.abs(nodes[i] - x * GAP);
      const dy = Math.abs(nodes[i + 1] - y * GAP);
      const m = Math.max(dx, dy);
      if (m > dev) dev = m;
    }
  }
  return dev;
}

const SPRING = { spring: 260, damping: 29 };
const REPEL = { radius: 100, force: 0 };
const RIPPLE = { speed: 260, band: 30, force: 2000, life: 600 };
const NO_POINTER = { x: 0, y: 0, in: 0 };

function advance(
  nodes: number[],
  cols: number,
  rows: number,
  ripples: { x: number; y: number; t0: number }[],
  ticks: number,
  startNow = 0,
  dt = 1 / 60,
): number {
  let maxDev = 0;
  for (let t = 0; t < ticks; t += 1) {
    maxDev = stepGrid(
      nodes,
      cols,
      rows,
      GAP,
      dt,
      NO_POINTER,
      ripples,
      startNow + t * dt * 1000,
      SPRING,
      REPEL,
      RIPPLE,
    ).maxDev;
  }
  return maxDev;
}

describe('buildGrid', () => {
  it('格点数与网格尺寸一致，且所有点起始于原位', () => {
    const nodes = makeGrid(100, 60);
    const cols = Math.floor(100 / GAP) + 1;
    const rows = Math.floor(60 / GAP) + 1;
    expect(nodes.length).toBe(cols * rows * STRIDE);
    expect(maxDeviation(nodes, cols, rows)).toBe(0);
    expect(nodes[0]).toBe(0);
    expect(nodes[STRIDE]).toBe(GAP); // 第二列 x
  });
});

describe('stepGrid 涟漪', () => {
  const cols = Math.floor(200 / GAP) + 1;
  const rows = Math.floor(200 / GAP) + 1;

  it('涟漪确实推动网格（旧版因时钟不同源恒为 0）', () => {
    const nodes = makeGrid(200, 200);
    const ripples = [{ x: 100, y: 100, t0: 0 }];
    const dev = advance(nodes, cols, rows, ripples, 12);
    expect(dev).toBeGreaterThan(0.5);
  });

  it('涟漪过后网格回到原位（弹簧把位移收回去）', () => {
    const nodes = makeGrid(200, 200);
    const ripples = [{ x: 100, y: 100, t0: 0 }];
    advance(nodes, cols, rows, ripples, 60);
    // 涟漪寿命 600ms = 36 帧；再跑 120 帧让弹簧收敛
    const dev = advance(nodes, cols, rows, [], 120, 5000);
    expect(dev).toBeLessThan(0.5);
  });

  it('寿命之外的涟漪不产生任何力', () => {
    const nodes = makeGrid(200, 200);
    const dev = advance(nodes, cols, rows, [{ x: 100, y: 100, t0: -10000 }], 5);
    expect(dev).toBe(0);
  });

  it('涟漪是向外扩散的波：远处的点比近处的点更晚开始动', () => {
    const size = 400;
    const c = Math.floor(size / GAP) + 1;
    const rr = Math.floor(size / GAP) + 1;
    const cy = Math.round(200 / GAP);
    const nearX = Math.round(110 / GAP); // 距圆心 90dp
    const farX = Math.round(300 / GAP); // 距圆心 200dp

    const nodes = makeGrid(size, size);
    const ripples = [{ x: 20, y: 200, t0: 0 }];

    /** 跑 n 帧后取某个格点的总位移（横向 + 纵向，波沿径向推，只看纵向会漏）。 */
    const devAt = (frames: number, col: number): number => {
      const local = makeGrid(size, size);
      advance(local, c, rr, ripples, frames);
      const i = (cy * c + col) * STRIDE;
      const dx = local[i] - col * GAP;
      const dy = local[i + 1] - cy * GAP;
      return Math.sqrt(dx * dx + dy * dy);
    };

    // 6 帧（100ms）时波前只走到 26dp，两个点都还没动
    expect(devAt(6, nearX)).toBeLessThan(0.05);
    expect(devAt(6, farX)).toBeLessThan(0.05);

    // 24 帧（400ms）波前到 ~104dp：近点已经被推到，远点还没有
    const nearAt400 = devAt(24, nearX);
    const farAt400 = devAt(24, farX);
    expect(nearAt400).toBeGreaterThan(0.2);
    expect(farAt400).toBeLessThan(nearAt400);
  });

  it('涟漪时间戳用负数时按「还没打戳」处理也不会崩（由组件侧补戳）', () => {
    const nodes = makeGrid(200, 200);
    const ripples = [{ x: 100, y: 100, t0: -1 }];
    // t0=-1 在纯函数里 age 会是正的巨大值 → 直接超出寿命，不产生形变
    const dev = advance(nodes, cols, rows, ripples, 5, 0);
    expect(dev).toBe(0);
  });
});
