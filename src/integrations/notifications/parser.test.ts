import { normalizeNotificationCandidate } from './parser';

describe('notification candidate normalization', () => {
  test('accepts a valid native payment event without retaining notification text', () => {
    expect(normalizeNotificationCandidate({
      id: 'evt-1', type: 'expense', amount: 38.5, source: 'notification',
      occurredAt: '2026-10-16T08:30:00.000Z', note: '支付宝交易通知', confidence: 0.8,
    })).toEqual({
      id: 'evt-1', type: 'expense', amount: 38.5, source: 'notification', fingerprint: 'notification|expense|38.50|2026-10-16T08:30',
      occurredAt: '2026-10-16T08:30:00.000Z', note: '支付宝交易通知', confidence: 0.8,
    });
  });

  test('rejects malformed or unsafe event fields', () => {
    expect(normalizeNotificationCandidate({ id: 'x', type: 'expense', amount: -8, occurredAt: 'now' })).toBeNull();
    expect(normalizeNotificationCandidate({ id: 'x', type: 'transfer', amount: 8, occurredAt: '2026-10-16T08:30:00Z' })).toBeNull();
    expect(normalizeNotificationCandidate({ id: 'x', type: 'expense', amount: 8, occurredAt: '2026-10-16T08:30:00Z', rawText: '付款通知内容' })).toBeNull();
  });

  test('produces the same fingerprint for duplicate events in the same minute', () => {
    const first = { id: 'one', type: 'expense', amount: 12, source: 'notification', occurredAt: '2026-10-16T08:30:02.000Z', note: '微信支付' };
    const duplicate = { ...first, id: 'two', occurredAt: '2026-10-16T08:30:58.000Z' };
    expect(normalizeNotificationCandidate(first)?.fingerprint).toBe('notification|expense|12.00|2026-10-16T08:30');
    expect(normalizeNotificationCandidate(duplicate)?.fingerprint).toBe('notification|expense|12.00|2026-10-16T08:30');
  });

  test('preserves structured repayment metadata without retaining notification text', () => {
    expect(normalizeNotificationCandidate({
      id: 'repayment-1', type: 'expense', amount: 120, source: 'notification',
      occurredAt: '2026-10-17T08:00:00.000Z', confidence: 0.95,
      eventKind: 'proxy-repayment', eventStatus: 'success', provider: '花呗',
      debtId: 'debt-1', counterparty: '张三',
    })).toMatchObject({
      eventKind: 'proxy-repayment', eventStatus: 'success', provider: '花呗',
      debtId: 'debt-1', counterparty: '张三',
    });
  });
});
