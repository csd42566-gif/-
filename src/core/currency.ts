/**
 * 多币种支持（v2）：记账时选币种（默认 CNY）。
 * 分类与账户不绑定币种；统计与总余额按币种分开展示，不做自动汇率换算。
 */

export const DEFAULT_CURRENCY = 'CNY';

/** 支持的币种代码（v2 首发清单，后续可扩展）。 */
export const SUPPORTED_CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string; // 中文名
  symbol: string;
  /** 小数位数：CNY/JPY=0 是「元」粒度，USD/EUR/HKD=2。JPY 最小单位是日元本身。 */
  minorUnit: number;
}

/** 币种展示信息。金额仍以「最小单位」整数存储（对 CNY 即分）。 */
export const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  CNY: { code: 'CNY', name: '人民币', symbol: '¥', minorUnit: 2 },
  USD: { code: 'USD', name: '美元', symbol: '$', minorUnit: 2 },
  EUR: { code: 'EUR', name: '欧元', symbol: '€', minorUnit: 2 },
  JPY: { code: 'JPY', name: '日元', symbol: '¥', minorUnit: 0 },
  HKD: { code: 'HKD', name: '港币', symbol: 'HK$', minorUnit: 2 },
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** 分/最小单位 → 展示字符串（带币种符号）。 */
export function formatCurrencyAmount(minor: number, currency: string): string {
  const code = isCurrencyCode(currency) ? currency : DEFAULT_CURRENCY;
  const info = CURRENCY_INFO[code];
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const divisor = Math.pow(10, info.minorUnit);
  const intPart = Math.floor(abs / divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = abs % divisor;
  const fracStr = info.minorUnit > 0 ? '.' + String(frac).padStart(info.minorUnit, '0') : '';
  return sign + info.symbol + intPart + fracStr;
}
