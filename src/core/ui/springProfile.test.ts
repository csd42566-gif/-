import { GRID_DAMPING, GRID_SPRING, springProfile } from './springProfile';

describe('springProfile', () => {
  it('原型参数 140/13 是欠阻尼，会摆，3τ≈0.46s', () => {
    const p = springProfile(140, 13);
    expect(p.oscillates).toBe(true);
    expect(p.zeta).toBeCloseTo(0.549, 2);
    expect(p.settleMs).toBeGreaterThan(400);
    expect(p.settleMs).toBeLessThan(500);
  });

  it('当前参数 260/29 明显更快：3τ 减半以上', () => {
    const old = springProfile(140, 13);
    const now = springProfile(GRID_SPRING, GRID_DAMPING);
    expect(now.omega).toBeGreaterThan(old.omega);
    expect(now.zeta).toBeGreaterThan(old.zeta);
    expect(now.settleMs).toBeLessThan(old.settleMs * 0.5);
  });

  it('当前参数仍留一点过冲（ζ 在 0.8–0.95 之间），不是硬邦邦的直落', () => {
    const p = springProfile(GRID_SPRING, GRID_DAMPING);
    expect(p.zeta).toBeGreaterThan(0.8);
    expect(p.zeta).toBeLessThan(1);
  });

  it('阻尼足够大时转为过阻尼，不再摆', () => {
    expect(springProfile(260, 40).oscillates).toBe(false);
    expect(springProfile(260, 29).oscillates).toBe(true);
  });

  it('刚度越大静止越快（同阻尼比下）', () => {
    const soft = springProfile(100, 20);
    const stiff = springProfile(400, 40);
    expect(stiff.settleMs).toBeLessThan(soft.settleMs);
  });
});
