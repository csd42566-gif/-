import { defaultSettings, LedgerState, PendingTransaction } from '../../core/model/finance';
import { addPendingWithDedupe, queueDetectedTransaction, reviewDetectedTransaction } from './ledger';
import { logger } from '../../core/logging/logger';

const state: LedgerState = {
  accounts: [{ id: 'cash', name: '现金', kind: 'cash', balance: 100 }],
  transactions: [], pendingTransactions: [], debts: [], goal: null, settings: { ...defaultSettings },
};
const candidate: PendingTransaction = {
  id: 'event-1', type: 'expense', amount: 12, source: 'notification',
  occurredAt: '2026-10-16T08:30:00.000Z', note: '微信支付', confidence: 0.8,
};

test('does not post a detected event until an account is explicitly selected', () => {
  const queued = queueDetectedTransaction(state, candidate);
  expect(() => reviewDetectedTransaction(queued, candidate.id, 'accept')).toThrow('transaction-account-invalid');
  const reviewed = reviewDetectedTransaction(queued, candidate.id, 'accept', { accountId: 'cash' });
  expect(reviewed.accounts[0].balance).toBe(88);
  expect(reviewed.transactions[0].accountId).toBe('cash');
});

test('deduplicates account-free notifications by source, amount, and minute', () => {
  const first = queueDetectedTransaction(state, candidate);
  const duplicate = queueDetectedTransaction(first, { ...candidate, id: 'event-2', occurredAt: '2026-10-16T08:30:45.000Z' });
  expect(duplicate.pendingTransactions).toHaveLength(1);
});

test('keeps an unrelated manual transaction with the same amount and minute', () => {
  const withManualTransaction = { ...state, transactions: [{ id: 'manual', type: 'expense' as const, amount: 12, accountId: 'cash', occurredAt: candidate.occurredAt, source: 'manual' as const }] };
  expect(queueDetectedTransaction(withManualTransaction, candidate).pendingTransactions).toHaveLength(1);
});

test('accepting a repayment records metadata and reduces the selected debt without going below zero', () => {
  const repaymentState: LedgerState = {
    ...state,
    debts: [{ id: 'debt-1', name: '花呗', amount: 80, dueDate: '2026-10-20', kind: 'credit', repaymentMode: 'minimum' }],
  };
  const repayment: PendingTransaction = {
    ...candidate, id: 'repayment-1', amount: 100, eventKind: 'repayment', eventStatus: 'success',
    provider: '花呗', debtId: 'debt-1',
  };
  const queued = queueDetectedTransaction(repaymentState, repayment);
  const reviewed = reviewDetectedTransaction(queued, repayment.id, 'accept', { accountId: 'cash' });
  expect(reviewed.debts[0].amount).toBe(0);
  expect(reviewed.transactions[0]).toMatchObject({ eventKind: 'repayment', eventStatus: 'success', provider: '花呗', debtId: 'debt-1' });
});

test('keeps a repayment candidate pending when its debt cannot be identified', () => {
  const repayment: PendingTransaction = {
    ...candidate, id: 'repayment-without-debt', eventKind: 'repayment', eventStatus: 'success', provider: '白条',
  };
  const queued = queueDetectedTransaction(state, repayment);
  expect(() => reviewDetectedTransaction(queued, repayment.id, 'accept', { accountId: 'cash' })).toThrow('repayment-debt-invalid');
  expect(queued.pendingTransactions).toHaveLength(1);
});

test('does not post repayment reminders or failures as expenses', () => {
  for (const eventKind of ['repayment-reminder', 'repayment-failed'] as const) {
    const pending: PendingTransaction = {
      ...candidate, id: eventKind, eventKind, eventStatus: eventKind === 'repayment-reminder' ? 'reminder' : 'failed',
    };
    const queued = queueDetectedTransaction(state, pending);
    expect(() => reviewDetectedTransaction(queued, pending.id, 'accept', { accountId: 'cash' })).toThrow('detected-event-not-postable');
    expect(queued.pendingTransactions).toHaveLength(1);
  }
});
test('replaces a duplicate pending record when the later source provides more fields', () => {
  const bothSourceState: LedgerState = { ...state, settings: { ...defaultSettings, billSource: 'both' } };
  const first = addPendingWithDedupe(bothSourceState, {
    ...candidate, id: 'notice-light', provider: '支付宝', occurredAt: '2026-10-16T08:30:02.000Z',
  });
  const second = addPendingWithDedupe(first, {
    ...candidate, id: 'auto-full', source: 'autoaccounting', provider: '支付宝', occurredAt: '2026-10-16T08:30:58.000Z',
    category: '餐饮', accountLabel: '余额', externalKey: 'ORDER-1', confidence: 1,
  });

  expect(second.pendingTransactions).toHaveLength(1);
  expect(second.pendingTransactions[0]).toMatchObject({ id: 'auto-full', source: 'autoaccounting', externalKey: 'ORDER-1', category: '餐饮' });
});

test('rejects an incoming channel disabled by billSource and records a log', () => {
  logger.clear();
  const rejected = addPendingWithDedupe(state, {
    ...candidate, id: 'auto-rejected', source: 'autoaccounting', provider: '支付宝',
  });

  expect(rejected).toBe(state);
  expect(logger.getEntries()[0]).toMatchObject({ event: 'BILL_SOURCE_REJECTED' });
});
