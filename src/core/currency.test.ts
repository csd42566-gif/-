import { DEFAULT_CURRENCY, isCurrencyCode, formatCurrencyAmount } from './currency';

describe('currency（多币种）', () => {
  test('默认币种 CNY', () => {
    expect(DEFAULT_CURRENCY).toBe('CNY');
  });

  test('isCurrencyCode 校验', () => {
    expect(isCurrencyCode('CNY')).toBe(true);
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('XXX')).toBe(false);
  });

  test('formatCurrencyAmount 按币种格式化', () => {
    expect(formatCurrencyAmount(135200, 'CNY')).toBe('¥1,352.00');
    expect(formatCurrencyAmount(-8650, 'CNY')).toBe('-¥86.50');
    expect(formatCurrencyAmount(123456, 'USD')).toBe('$1,234.56');
    expect(formatCurrencyAmount(5000, 'JPY')).toBe('¥5,000'); // minorUnit 0
    expect(formatCurrencyAmount(123456, 'XXX')).toBe('¥1,234.56'); // 未知回退 CNY
  });
});
