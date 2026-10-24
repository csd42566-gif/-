import { DetectedEventKind, DetectedEventStatus, PendingTransaction } from '../../core/model/finance';

export interface NativeNotificationEvent {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  source?: unknown;
  occurredAt?: unknown;
  note?: unknown;
  confidence?: unknown;
  eventKind?: unknown;
  eventStatus?: unknown;
  provider?: unknown;
  debtId?: unknown;
  counterparty?: unknown;
  rawText?: unknown;
}

export type NormalizedNotificationCandidate = PendingTransaction;

export function normalizeNotificationCandidate(value: NativeNotificationEvent): NormalizedNotificationCandidate | null {
  if (!value || typeof value !== 'object' || value.rawText !== undefined) return null;
  if (typeof value.id !== 'string' || !value.id || value.id.length > 100) return null;
  if (value.type !== 'expense' && value.type !== 'income') return null;
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount > 100000000) return null;
  if (value.source !== 'notification' || typeof value.occurredAt !== 'string' || Number.isNaN(Date.parse(value.occurredAt))) return null;
  const note = typeof value.note === 'string' ? value.note.trim().slice(0, 80) : undefined;
  const eventKind = enumValue(value.eventKind, ['payment', 'repayment', 'proxy-repayment', 'repayment-reminder', 'repayment-failed', 'refund'] as const);
  const eventStatus = enumValue(value.eventStatus, ['success', 'reminder', 'failed'] as const);
  const provider = boundedText(value.provider, 80);
  const debtId = boundedText(value.debtId, 100);
  const counterparty = boundedText(value.counterparty, 80);
  const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
    ? Math.max(0, Math.min(1, value.confidence)) : 0.5;
  const occurredAt = new Date(value.occurredAt).toISOString();
  const amount = Math.round(value.amount * 100) / 100;
  const candidate: NormalizedNotificationCandidate = {
    id: value.id,
    type: value.type,
    amount,
    source: 'notification',
    occurredAt,
    confidence,
  };
  if (note) candidate.note = note;
  if (eventKind) candidate.eventKind = eventKind;
  if (eventStatus) candidate.eventStatus = eventStatus;
  if (provider) candidate.provider = provider;
  if (debtId) candidate.debtId = debtId;
  if (counterparty) candidate.counterparty = counterparty;
  return candidate;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}
