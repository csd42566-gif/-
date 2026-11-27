import { absoluteDayLabel, dayLabel, weekdayOf } from './dayLabel';

describe('weekdayOf', () => {
  it('按真实年份算星期，不写死年份', () => {
    // 2026-11-15 是周日。旧实现用 new Date(2000, 10, 15) 会算成周三。
    expect(weekdayOf('2026-11-15')).toBe(0);
    expect(weekdayOf('2026-11-16')).toBe(1);
    expect(weekdayOf('2026-11-17')).toBe(2);
    expect(weekdayOf('2026-01-01')).toBe(4); // 周四
  });

  it('非法输入返回 null', () => {
    expect(weekdayOf('')).toBeNull();
    expect(weekdayOf('2026-13-01')).toBeNull();
    expect(weekdayOf('2026-11')).toBeNull();
    expect(weekdayOf('abc-def-ghi')).toBeNull();
  });
});

describe('dayLabel', () => {
  const today = '2026-11-17';
  const yesterday = '2026-11-16';

  it('今天 / 昨天 用相对词', () => {
    expect(dayLabel(today, today, yesterday)).toBe('今天 · 11月17日');
    expect(dayLabel(yesterday, today, yesterday)).toBe('昨天 · 11月16日');
  });

  it('更早的日期带正确星期', () => {
    expect(dayLabel('2026-11-15', today, yesterday)).toBe('11月15日 周日');
    expect(dayLabel('2026-11-10', today, yesterday)).toBe('11月10日 周二');
  });

  it('非法 dayKey 原样返回，不抛', () => {
    expect(dayLabel('bad', today, yesterday)).toBe('bad');
  });
});

describe('absoluteDayLabel', () => {
  it('永远给绝对日期 + 星期，不用相对词', () => {
    const epoch = new Date(2026, 10, 17).getTime() / 1000;
    expect(absoluteDayLabel(epoch)).toBe('11月17日 周二');
  });

  it('跨月与闰年日都按本地时区取', () => {
    expect(absoluteDayLabel(new Date(2026, 10, 1).getTime() / 1000)).toBe('11月1日 周日');
    expect(absoluteDayLabel(new Date(2028, 1, 29).getTime() / 1000)).toBe('2月29日 周二');
  });
});
