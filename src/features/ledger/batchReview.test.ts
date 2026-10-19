import { createInitialLedgerState } from '../../data/initialState';
import { Account, PendingTransaction } from '../../core/model/finance';
import { batchSelectionState, isBatchablePending, nextBatchSelection, resolvePendingAccountId, reviewPendingBatch, selectedBatchSummary } from './batchReview';

const expense: PendingTransaction = { id: 'expense', type: 'expense', amount: 100, accountId: 'cash', category: '餐饮', occurredAt: '2026-10-18T08:00:00.000Z', source: 'import', confidence: 0.9, eventKind: 'payment' };
const income: PendingTransaction = { id: 'income', type: 'income', amount: 300, accountId: 'cash', category: '工资', occurredAt: '2026-10-18T09:00:00.000Z', source: 'import', confidence: 0.9 };
const noAccount: PendingTransaction = { id: 'no-account', type: 'expense', amount: 20, occurredAt: '2026-10-18T10:00:00.000Z', source: 'import', confidence: 0.8 };
const repayment: PendingTransaction = { id: 'repayment', type: 'expense', amount: 50, accountId: 'cash', occurredAt: '2026-10-18T11:00:00.000Z', source: 'import', confidence: 0.8, eventKind: 'repayment' };

test('可批量仅包含有账户且非repayment的记录', () => {
  expect(isBatchablePending(expense)).toBe(true);
  expect(isBatchablePending(income)).toBe(true);
  expect(isBatchablePending(noAccount)).toBe(false);
  expect(isBatchablePending(repayment)).toBe(false);
});

test('全选三态按可批量总数计算', () => {
  const ids = ['expense', 'income'];
  expect(batchSelectionState(ids, new Set())).toBe('none');
  expect(batchSelectionState(ids, new Set(['expense']))).toBe('partial');
  expect(batchSelectionState(ids, new Set(ids))).toBe('all');
});

test('批量全选按前10笔、全选全部、清空三态循环', () => {
  const ids = Array.from({ length: 12 }, (_, index) => `item-${index}`);
  const first = nextBatchSelection(ids, new Set());
  expect([...first]).toEqual(ids.slice(0, 10));

  const all = nextBatchSelection(ids, new Set(['item-0']));
  expect([...all]).toEqual(ids);

  const cleared = nextBatchSelection(ids, new Set(ids));
  expect([...cleared]).toEqual([]);
});

test('待核对记录优先沿用有效账户，否则使用首个账户', () => {
  const accounts: Account[] = [{ id: 'cash', name: '现金', kind: 'cash', balance: 0 }, { id: 'bank', name: '银行卡', kind: 'bank', balance: 0 }];
  expect(resolvePendingAccountId('bank', accounts)).toBe('bank');
  expect(resolvePendingAccountId(undefined, accounts)).toBe('cash');
  expect(resolvePendingAccountId('missing', accounts)).toBe('cash');
  expect(resolvePendingAccountId(undefined, [])).toBe('');
});
test('已选汇总只统计选中项并区分收支', () => {
  expect(selectedBatchSummary([expense, income, repayment], new Set(['expense', 'income', 'repayment']))).toEqual({ count: 3, expense: 150, income: 300 });
});

test('批量确认在一次状态结果中处理全部选中项', () => {
  const state = { ...createInitialLedgerState(), accounts: [{ id: 'cash', name: '现金', kind: 'cash' as const, balance: 1000 }], pendingTransactions: [expense, income] };
  const result = reviewPendingBatch(state, new Set(['expense', 'income']));

  expect(result.successCount).toBe(2);
  expect(result.failures).toEqual([]);
  expect(result.state.pendingTransactions).toEqual([]);
  expect(result.state.accounts[0].balance).toBe(1200);
  expect(result.state.transactions).toHaveLength(2);
  expect(new Set(result.state.transactions.map((transaction) => transaction.id)).size).toBe(2);
});
test('批量默认账户会在一次批量结果中写入每条缺失账户的记录', () => {
  const state = { ...createInitialLedgerState(), accounts: [{ id: 'cash', name: '现金', kind: 'cash' as const, balance: 1000 }], pendingTransactions: [noAccount] };
  const result = reviewPendingBatch(state, new Set(['no-account']), new Map([['no-account', 'cash']]));

  expect(result.successCount).toBe(1);
  expect(result.failures).toEqual([]);
  expect(result.state.pendingTransactions).toEqual([]);
  expect(result.state.transactions[0]).toMatchObject({ accountId: 'cash', amount: 20 });
  expect(result.state.accounts[0].balance).toBe(980);
});

test('批量默认账户不会绕过还款类人工核对', () => {
  const proxyRepayment: PendingTransaction = { id: 'proxy', type: 'expense', amount: 30, occurredAt: '2026-10-18T12:00:00.000Z', source: 'import', confidence: 0.8, eventKind: 'proxy-repayment' };
  const state = { ...createInitialLedgerState(), accounts: [{ id: 'cash', name: '现金', kind: 'cash' as const, balance: 1000 }], pendingTransactions: [proxyRepayment] };
  const result = reviewPendingBatch(state, new Set(['proxy']), new Map([['proxy', 'cash']]));

  expect(result.successCount).toBe(0);
  expect(result.state.transactions).toEqual([]);
  expect(result.failures[0]).toMatchObject({ id: 'proxy', reason: '需选择欠款后确认' });
});
