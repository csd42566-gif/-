import { goalDueLabel, goalPercent } from './goals';

describe('goalPercent', () => {
  it('正常区间向下取整', () => {
    expect(goalPercent(500000, 180000)).toBe(36);
    expect(goalPercent(100, 1)).toBe(1);
    expect(goalPercent(100, 99)).toBe(99);
  });

  it('目标为 0 或负数时返回 0，不除零', () => {
    expect(goalPercent(0, 500)).toBe(0);
    expect(goalPercent(-100, 500)).toBe(0);
  });

  it('已存为负按 0；超出目标封顶 100', () => {
    expect(goalPercent(1000, -50)).toBe(0);
    expect(goalPercent(1000, 1000)).toBe(100);
    expect(goalPercent(1000, 5000)).toBe(100);
  });
});

describe('goalDueLabel', () => {
  const now = new Date(2026, 10, 20, 15, 0);

  it('dueAt 为 0 时返回空串', () => {
    expect(goalDueLabel(0, now)).toBe('');
  });

  it('今天到期', () => {
    const due = new Date(2026, 10, 20, 3, 0).getTime() / 1000;
    expect(goalDueLabel(due, now)).toBe('今天到期');
  });

  it('未来日期写月日', () => {
    const due = new Date(2026, 11, 31, 3, 0).getTime() / 1000;
    expect(goalDueLabel(due, now)).toBe('12月31日到期');
  });

  it('过期按天数，1 天单独措辞', () => {
    const one = new Date(2026, 10, 19, 3, 0).getTime() / 1000;
    expect(goalDueLabel(one, now)).toBe('已过期 1 天');
    const three = new Date(2026, 10, 17, 3, 0).getTime() / 1000;
    expect(goalDueLabel(three, now)).toBe('已过期 3 天');
  });

  it('跨月过期也算对天数', () => {
    const due = new Date(2026, 9, 25, 3, 0).getTime() / 1000;
    expect(goalDueLabel(due, now)).toBe('已过期 26 天');
  });
});
