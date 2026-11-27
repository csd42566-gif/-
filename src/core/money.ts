/**
 * 金额工具（v2）：一切金额以整数「分」为准，杜绝浮点误差。
 * 分是唯一存储单位；展示时才格式化成「元」字符串。
 */

/** 四舍五入到整数分。用于任何除法派生量的收口。 */
export function roundCents(value: number): number {
  return Math.round(value);
}

/** 元 → 分。用户输入的是元，入库前调用。 */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 分 → 元。仅用于需要浮点元的派生计算（如画图坐标），展示请用 formatCents。 */
export function centsToYuan(cents: number): number {
  return cents / 100;
}

/**
 * 分 → 展示字符串（元），两位小数，千分位分隔。
 * 例：1352000 → "¥13,520.00"；-8650 → "-¥86.50"。
 */
export function formatCents(cents: number, opts?: { symbol?: string; showDecimals?: boolean }): string {
  const symbol = opts?.symbol ?? '¥';
  const showDecimals = opts?.showDecimals ?? true;
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const frac = abs % 100;
  const intPart = yuan.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!showDecimals) {
    return sign + symbol + intPart;
  }
  return sign + symbol + intPart + '.' + String(frac).padStart(2, '0');
}

/** 解析用户输入的金额字符串为分。非法输入返回 null（不抛异常）。 */
export function parseAmountToCents(input: string): number | null {
  const text = input.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null;
  const yuan = Number(text);
  if (!Number.isFinite(yuan)) return null;
  return yuanToCents(yuan);
}
