import {
  TILT_LIFT,
  TILT_MAX_DEG,
  TILT_PARALLAX,
  TILT_PERSPECTIVE,
  TILT_REST,
  TILT_SHADOW_SCALE,
  TILT_SHADOW_SHIFT,
  tiltFromTouch,
} from './tilt';

/*
 * 注意：按压浮起 / 内容视差 / 地影位移三条算式内联在 src/ui/tiltPanel.tsx 的
 * useAnimatedStyle 里（跨模块 worklet 调用在 release 包里会被收口成 undefined，
 * 实测崩过一次），所以这里只测 JS 侧真正调用的 tiltFromTouch + 常量口径。
 */

describe('tiltFromTouch', () => {
  it('触点落在正中心时完全水平', () => {
    const a = tiltFromTouch(100, 50, 200, 100);
    /* rotateX 是取负得到的，中心处会算出 -0，Object.is(-0, 0) 为 false，必须用 closeTo。 */
    expect(a.rotateX).toBeCloseTo(0, 10);
    expect(a.rotateY).toBeCloseTo(0, 10);
    expect(a.normX).toBeCloseTo(0, 10);
    expect(a.normY).toBeCloseTo(0, 10);
  });

  it('触点靠右 → rotateY 为正（右边沉下去）且随距离线性增大', () => {
    const quarter = tiltFromTouch(150, 50, 200, 100);
    const edge = tiltFromTouch(200, 50, 200, 100);
    expect(quarter.rotateY).toBeGreaterThan(0);
    expect(edge.rotateY).toBeCloseTo(TILT_MAX_DEG, 5);
    expect(edge.rotateY).toBeGreaterThan(quarter.rotateY);
  });

  it('触点靠上 → rotateX 为正（顶边后仰 = 顶边沉下去）', () => {
    const a = tiltFromTouch(100, 0, 200, 100);
    expect(a.rotateX).toBeCloseTo(TILT_MAX_DEG, 5);
  });

  it('触点靠下 → rotateX 为负（下边后仰 = 下边沉下去）', () => {
    const a = tiltFromTouch(100, 100, 200, 100);
    expect(a.rotateX).toBeCloseTo(-TILT_MAX_DEG, 5);
  });

  it('倾角不超过上限，即便手指拖到面板外很远', () => {
    const far = tiltFromTouch(-9999, -9999, 200, 100);
    expect(Math.abs(far.rotateX)).toBeLessThanOrEqual(TILT_MAX_DEG);
    expect(Math.abs(far.rotateY)).toBeLessThanOrEqual(TILT_MAX_DEG);
    expect(Math.abs(far.normX)).toBeLessThanOrEqual(1);
    expect(Math.abs(far.normY)).toBeLessThanOrEqual(1);
  });

  it('X 轴符号与归一化 Y 相反、Y 轴同号（按哪沉哪的方向依赖这一点）', () => {
    const a = tiltFromTouch(180, 20, 200, 100);
    expect(Math.sign(a.rotateY)).toBe(Math.sign(a.normX));
    expect(Math.sign(a.rotateX)).toBe(-Math.sign(a.normY));
  });

  it('面板尺寸为 0 时返回复位态，不产生除零', () => {
    expect(tiltFromTouch(10, 10, 0, 0)).toEqual(TILT_REST);
    expect(tiltFromTouch(10, 10, 0, 100)).toEqual(TILT_REST);
  });

  it('复位态是全零', () => {
    expect(TILT_REST.rotateX).toBe(0);
    expect(TILT_REST.rotateY).toBe(0);
    expect(TILT_REST.normX).toBe(0);
    expect(TILT_REST.normY).toBe(0);
  });
});

describe('参数口径（对齐 Kinetik Tilt Deck 后的取值）', () => {
  it('倾角 9°——12° 会让 8.7dp 的小字梯形失真', () => {
    expect(TILT_MAX_DEG).toBe(9);
    expect(TILT_MAX_DEG).toBeLessThan(12);
  });

  it('透视 800——比最初的 900 更近，纵深更强', () => {
    expect(TILT_PERSPECTIVE).toBe(800);
  });

  it('浮起 3%，超过 5% 会读成「卡片被放大」而不是「被顶起来」', () => {
    expect(TILT_LIFT).toBe(1.03);
    expect(TILT_LIFT).toBeLessThan(1.05);
  });

  it('视差每单位 10dp，与 Kinetik 默认一致', () => {
    expect(TILT_PARALLAX).toBe(10);
  });

  it('地影位移 9dp、静息缩放 0.98（按下时追到 1.01 以内）', () => {
    expect(TILT_SHADOW_SHIFT).toBe(9);
    expect(TILT_SHADOW_SCALE).toBeLessThan(1);
    expect(TILT_SHADOW_SCALE + 0.03).toBeLessThan(1.02);
  });
});
