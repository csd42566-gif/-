import { defaultSettings, LedgerState } from '../../core/model/finance';
import { mergeNotificationCandidates } from './sync';
import { logger } from '../../core/logging/logger';

const state: LedgerState = {
  accounts: [],
  transactions: [],
  pendingTransactions: [],
  debts: [],
  goal: null,
  settings: { ...defaultSettings },
};

test('merges valid native notification events into pending transactions', () => {
  const next = mergeNotificationCandidates(state, [{
    id: 'notice-1',
    type: 'expense',
    amount: 28.5,
    source: 'notification',
    occurredAt: '2026-10-17T08:30:00.000Z',
    provider: '微信支付',
    eventKind: 'payment',
    eventStatus: 'success',
    confidence: 0.92,
  }]);

  expect(next.pendingTransactions).toHaveLength(1);
  expect(next.pendingTransactions[0]).toMatchObject({
    id: 'notice-1',
    amount: 28.5,
    provider: '微信支付',
    eventKind: 'payment',
  });
});

test('ignores malformed native events without changing the ledger', () => {
  const next = mergeNotificationCandidates(state, [{
    id: 'notice-invalid',
    type: 'expense',
    amount: 0,
    source: 'notification',
    occurredAt: 'not-a-date',
  }]);

  expect(next).toBe(state);
});
test('drops notification events when billSource excludes notification and logs the rejection', () => {
  logger.clear();
  const restricted = { ...state, settings: { ...defaultSettings, billSource: 'autoaccounting' as const } };
  const next = mergeNotificationCandidates(restricted, [{
    id: 'notice-disabled',
    type: 'expense',
    amount: 15,
    source: 'notification',
    occurredAt: '2026-10-17T09:10:00.000Z',
    provider: '支付宝',
  }]);

  expect(next).toBe(restricted);
  expect(logger.getEntries()[0]).toMatchObject({ event: 'BILL_SOURCE_REJECTED' });
});
