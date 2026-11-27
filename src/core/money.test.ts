import { roundCents, yuanToCents, centsToYuan, formatCents, parseAmountToCents } from './money';

describe('money（整数分）', () => {
  test('roundCents 四舍五入', () => {
    expect(roundCents(1.4)).toBe(1);
    expect(roundCents(1.5)).toBe(2);
    expect(roundCents(-1.5)).toBe(-1); // Math.round 向 +∞
  });

  test('yuanToCents 元转分', () => {
    expect(yuanToCents(13.52)).toBe(1352);
    expect(yuanToCents(0.1)).toBe(10);
    expect(yuanToCents(0.29)).toBe(29); // 0.29*100=28.9999... → round 收口
    expect(yuanToCents(-86.5)).toBe(-8650);
  });

  test('centsToYuan 分转元', () => {
    expect(centsToYuan(1352)).toBe(13.52);
  });

  test('formatCents 千分位与两位小数', () => {
    expect(formatCents(1352000)).toBe('¥13,520.00');
    expect(formatCents(-8650)).toBe('-¥86.50');
    expect(formatCents(5)).toBe('¥0.05');
    expect(formatCents(0)).toBe('¥0.00');
  });

  test('formatCents 不带小数', () => {
    expect(formatCents(1352000, { showDecimals: false })).toBe('¥13,520');
  });

  test('parseAmountToCents 解析用户输入', () => {
    expect(parseAmountToCents('13.52')).toBe(1352);
    expect(parseAmountToCents('13,520')).toBe(1352000);
    expect(parseAmountToCents('-86.5')).toBe(-8650);
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('1.234')).toBeNull();
    expect(parseAmountToCents('')).toBeNull();
  });
});
