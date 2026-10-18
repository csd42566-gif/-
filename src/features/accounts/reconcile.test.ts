import { defaultSettings, LedgerState } from '../../core/model/finance';
import { deriveFinancials } from '../../core/finance/derive';
import { lastBalanceReconciliation, reconcileAccountBalances } from './reconcile';

const state: LedgerState = {
  accounts: [
    { id: 'cash', name: '现金', kind: 'cash', balance: 1000 },
    { id: 'credit', name: '信用卡', kind: 'credit', balance: -500 },
    { id: 'wallet', name: '支付宝', kind: 'wallet', balance: 100 },
  ],
  transactions: [],
  pendingTransactions: [],
  debts: [],
  goal: null,
  settings: { ...defaultSettings },
};

test('多账户校准时余额与调整流水一致', () => {
  const now = new Date('2026-10-18T12:00:00.000Z');
  const next = reconcileAccountBalances(state, [
    { accountId: 'cash', actualValue: 1200 },
    { accountId: 'credit', actualValue: 800 },
    { accountId: 'wallet', actualValue: 100 },
  ], now);

  expect(next.accounts.find((account) => account.id === 'cash')?.balance).toBe(1200);
  expect(next.accounts.find((account) => account.id === 'credit')?.balance).toBe(-800);
  expect(next.transactions).toHaveLength(2);
  expect(next.transactions.every((transaction) => transaction.category === '余额校准')).toBe(true);

  const cashAdjustment = next.transactions.find((transaction) => transaction.accountId === 'cash');
  const creditAdjustment = next.transactions.find((transaction) => transaction.accountId === 'credit');
  expect(cashAdjustment).toMatchObject({ type: 'income', amount: 200 });
  expect(creditAdjustment).toMatchObject({ type: 'expense', amount: 300 });
  expect(1200 - 1000).toBe(cashAdjustment?.amount);
  expect(-800 - -500).toBe(-(creditAdjustment?.amount ?? 0));
  expect(lastBalanceReconciliation(next)).toMatchObject({ occurredAt: now.toISOString(), totalAdjustment: -100 });
});

test('余额校准支出不计入本月支出但影响余额和目标进度', () => {
  const now = new Date('2026-10-18T12:00:00.000Z');
  const calibrationState: LedgerState = {
    ...state,
    accounts: [{ id: 'cash', name: '现金', kind: 'cash', balance: 2000 }],
    transactions: [{ id: 'expense', type: 'expense', amount: 50, accountId: 'cash', occurredAt: '2026-10-10T12:00:00.000Z', source: 'manual' }],
    goal: { id: 'goal', name: '目标', targetAmount: 10000, startBalance: 1000, startBalanceAt: '2026-01-01T00:00:00.000Z', deadline: '2026-12-31' },
  };
  const before = deriveFinancials(calibrationState, now);
  const reconciled = reconcileAccountBalances(calibrationState, [{ accountId: 'cash', actualValue: 800 }], now);
  const after = deriveFinancials(reconciled, now);

  expect(before.monthSpent).toBe(50);
  expect(after.monthSpent).toBe(50);
  expect(after.availableBalance).toBe(800);
  expect(after.goalSaved).toBe(-200);
  expect(after.goalProgress).toBe(0);
  expect(after.goalRemaining).toBe(10200);
});

test('全部留空或差额为零时不产生调整流水', () => {
  expect(reconcileAccountBalances(state, [])).toBe(state);
  const unchanged = reconcileAccountBalances(state, [{ accountId: 'cash', actualValue: 1000 }]);
  expect(unchanged).toBe(state);
});