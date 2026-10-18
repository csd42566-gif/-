import { DetectedEventKind, DetectedEventStatus } from '../../core/model/finance';

export interface NotificationClassificationInput {
  provider?: unknown;
  title?: unknown;
  summary?: unknown;
  rawText?: unknown;
}

export interface NotificationClassification {
  kind: DetectedEventKind;
  status: DetectedEventStatus;
  type: 'income' | 'expense';
  category: string;
  provider: string;
  counterparty?: string;
  confidence: number;
}

export function classifyNotification(input: NotificationClassificationInput): NotificationClassification | null {
  if (!input || typeof input !== 'object' || input.rawText !== undefined) return null;

  const provider = boundedText(input.provider, 80);
  const title = boundedText(input.title, 160);
  const summary = boundedText(input.summary, 240);
  const text = [provider, title, summary].filter(Boolean).join(' ');
  if (!text) return null;

  const resolvedProvider = provider ?? detectProvider(text) ?? '未知平台';
  const base = { type: 'expense' as const, category: '还款', provider: resolvedProvider };

  if (/(失败|未成功|被拒绝|扣款失败|还款失败)/.test(text) && /(还款|偿还|账单)/.test(text)) {
    return { ...base, kind: 'repayment-failed', status: 'failed', confidence: 0.96 };
  }

  if (/(待还|应还|到期|还款提醒|还款日|请还款)/.test(text)) {
    return { ...base, kind: 'repayment-reminder', status: 'reminder', confidence: 0.94 };
  }

  const counterparty = extractCounterparty(text);
  if (counterparty && /(还款|偿还|代付)/.test(text) && /(成功|已还|完成|付款)/.test(text)) {
    return { ...base, kind: 'proxy-repayment', status: 'success', counterparty, confidence: 0.93 };
  }

  if (/(还款|偿还|账单还清|最低还款)/.test(text) && /(成功|已还|完成|付款)/.test(text)) {
    return { ...base, kind: 'repayment', status: 'success', confidence: 0.95 };
  }

  if (/(支付成功|付款成功|扣款成功|收款成功|交易成功)/.test(text)) {
    return { ...base, kind: 'payment', status: 'success', category: '支付', confidence: 0.88 };
  }

  return null;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

function detectProvider(text: string): string | undefined {
  const providers = ['花呗', '白条', '信用卡', '支付宝', '微信支付', '云闪付', '京东', '美团', '借呗', '微粒贷'];
  return providers.find((provider) => text.includes(provider));
}

function extractCounterparty(text: string): string | undefined {
  const match = text.match(/(?:代|帮|替)([^\s，。,。:：]{1,20}?)(?:还款|偿还|代付)/);
  return match?.[1] ? boundedText(match[1], 40) : undefined;
}
