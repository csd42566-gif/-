import { DetectedEventKind, DetectedEventStatus } from '../../core/model/finance';

export type RepaymentProvider = 'douyin' | 'alipay' | 'wechat' | 'dew' | 'jd' | 'other';

export interface ParsedRepayment {
  provider: RepaymentProvider;
  amount: number;
  occurredAt: string;
  counterparty?: string;
  note: string;
  confidence: number;
  eventKind: Extract<DetectedEventKind, 'proxy-repayment'>;
  eventStatus: Extract<DetectedEventStatus, 'success'>;
}

export const repaymentProviderLabels: Record<RepaymentProvider, string> = {
  douyin: '抖音',
  alipay: '支付宝',
  wechat: '微信',
  dew: '得物',
  jd: '京东',
  other: '其他',
};

const repaymentSemantics = /代还|帮.{1,10}?还款|替.{1,10}?(?:还款|偿还)|代付|偿还|还款/;
const successSemantics = /成功|已还|已完成|完成|已付款/;
const amountPatterns = [
  /(?:金额|还款|代还|付款|支付)[:：]?\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)/,
  /[¥￥]\s*(\d+(?:\.\d{1,2})?)/,
  /(\d+(?:\.\d{1,2})?)\s*元/,
];
const dateTimePattern = /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?\s+(\d{1,2}):(\d{2})/;
const counterpartyPatterns = [
  /(?:帮|替)([^\s，。,：:]{1,10}?)(?:还款|偿还|代付)/,
  /代(?:还|付)([^\s，。,：:\d¥￥金额]{1,10})/,
];
const summaryLength = 60;
const chinaOffset = '+08:00';

function extractAmount(text: string): number {
  const dateStripped = text.replace(dateTimePattern, ' ');
  for (const pattern of amountPatterns) {
    const matched = dateStripped.match(pattern);
    const amount = matched ? Number(matched[1]) : NaN;
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  throw new Error('repayment-import-amount-invalid');
}

function pad(value: string): string {
  return value.padStart(2, '0');
}

function extractOccurredAt(text: string, importedAt: string): string {
  const matched = text.match(dateTimePattern);
  if (!matched) return importedAt;
  const [, year, month, day, hour, minute] = matched;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:00.000${chinaOffset}`;
}

function extractCounterparty(text: string): string | undefined {
  for (const pattern of counterpartyPatterns) {
    const matched = text.match(pattern);
    if (matched?.[1]) return matched[1];
  }
  return undefined;
}

export function parseRepaymentText(provider: RepaymentProvider, text: string, importedAt: string = new Date().toISOString()): ParsedRepayment {
  const normalized = text.trim();
  if (!repaymentSemantics.test(normalized)) throw new Error('repayment-import-not-repayment');
  const amount = extractAmount(normalized);
  const counterparty = extractCounterparty(normalized);
  const confidence = (successSemantics.test(normalized) ? 0.6 : 0.4) + (counterparty ? 0.2 : 0) + (dateTimePattern.test(normalized) ? 0.1 : 0);
  return {
    provider,
    amount,
    occurredAt: extractOccurredAt(normalized, importedAt),
    counterparty,
    note: `${repaymentProviderLabels[provider]}导入：${normalized.replace(/\s+/g, ' ').slice(0, summaryLength)}`,
    confidence: Math.min(confidence, 0.95),
    eventKind: 'proxy-repayment',
    eventStatus: 'success',
  };
}