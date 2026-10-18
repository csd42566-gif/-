import { defaultSettings, LedgerState } from '../model/finance';
import { deriveFinancials } from './derive';

const state: LedgerState = {
  accounts: [
    { id: 'cash', name: '现金', kind: 'cash', balance: 500 },
    { id: 'bank', name: '银行卡', kind: 'bank', balance: 1000 },
    { id: 'credit', name: '信用卡', kind: 'credit', balance: 5000 },
  ],
  transactions: [
    { id: 'expense', type: 'expense', amount: 200, accountId: 'bank', occurredAt: '2026-10-05T12:00:00+08:00', source: 'manual' },
    { id: 'refund', type: 'income', amount: 50, accountId: 'bank', occurredAt: '2026-10-06T12:00:00+08:00', source: 'manual', eventKind: 'refund' },
    { id: 'income', type: 'income', amount: 3000, accountId: 'bank', occurredAt: '2026-10-01T12:00:00+08:00', source: 'manual' },
    { id: 'old-expense', type: 'expense', amount: 999, accountId: 'bank', occurredAt: '2026-09-30T12:00:00+08:00', source: 'manual' },
    { id: 'transfer', type: 'transfer', amount: 100, accountId: 'cash', toAccountId: 'bank', occurredAt: '2026-10-03T12:00:00+08:00', source: 'manual' },
  ],
  pendingTransactions: [],
  debts: [
    { id: 'overdue', name: '逾期账单', amount: 100, dueDate: '2026-10-10', kind: 'bill', repaymentMode: 'minimum' },
    { id: 'current', name: '本月账单', amount: 200, dueDate: '2026-10-20', kind: 'bill', repaymentMode: 'minimum' },
    { id: 'next', name: '下月账单', amount: 300, dueDate: '2026-11-05', kind: 'bill', repaymentMode: 'minimum' },
  ],
  goal: { id: 'goal', name: '应急金', targetAmount: 1000, startBalance: -1750, startBalanceAt: '2026-01-01T00:00:00.000+08:00', deadline: '2026-10-25' },
  settings: { ...defaultSettings, monthlyIncome: 5000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 },
};

test('统一派生现金流、目标和负债口径', () => {
  const result = deriveFinancials(state, new Date('2026-10-15T12:00:00+08:00'));

  expect(result.availableBalance).toBe(1500);
  expect(result.monthSpent).toBe(150);
  expect(result.monthIncome).toBe(3000);
  expect(result.todaySpendable).toBe(163.24);
  expect(result.goalProgress).toBe(25);
  expect(result.goalRemaining).toBe(750);
  expect(result.goalSaved).toBe(250);
  expect(result.goalShortfallFromStart).toBe(0);
  expect(result.monthDue).toBe(300);
  expect(result.overdueDue).toBe(100);
  expect(result.goalDailySave).toBe(75);
  expect(result.goalRemainingDays).toBe(10);
  expect(result.goalReserve).toBe(1275);
  expect(result.essentialReserve).toBe(500);
  expect(result.projectedNet).toBe(2775);
  expect(result.shortfall).toBe(0);
  expect(result.extraWorkHours).toBe(0);
  expect(result.hourlyIncome).toBe(23.15);
  expect(result.remainingDays).toBe(17);
});

test('目标倒退时进度为 0 并返回距起点多花金额', () => {
  const negative: LedgerState = {
    ...state,
    accounts: [{ id: 'cash', name: '现金', kind: 'cash', balance: 100 }],
    transactions: [],
    debts: [],
    goal: { id: 'goal', name: '应急金', targetAmount: 1000, startBalance: 1000, startBalanceAt: '2026-01-01T00:00:00.000+08:00', deadline: '2026-10-25' },
  };
  const result = deriveFinancials(negative, new Date('2026-10-15T12:00:00+08:00'));

  expect(result.goalSaved).toBe(-900);
  expect(result.goalProgress).toBe(0);
  expect(result.goalShortfallFromStart).toBe(900);
  expect(result.goalRemaining).toBe(1900);
});

test('预算收入、工作天数和工时只读取 settings.work', () => {
  const withDeprecatedPlaceholders: LedgerState = {
    ...state,
    settings: {
      ...state.settings,
      monthlyIncome: 15000,
      workDaysPerMonth: 2,
      workHoursPerDay: 1,
      work: { ...defaultSettings.work, monthlyIncome: 5000, workHoursPerDay: 8 },
    },
  };

  const result = deriveFinancials(withDeprecatedPlaceholders, new Date('2026-10-15T12:00:00+08:00'));

  expect(result.todaySpendable).toBe(163.24);
  expect(result.hourlyIncome).toBe(23.15);
});


test('试用期预算使用 probationIncome，转正周期使用 monthlyIncome', () => {
  const workState: LedgerState = {
    ...state,
    accounts: [],
    transactions: [],
    debts: [],
    goal: null,
    settings: {
      ...defaultSettings,
      essentialMonthlyExpenses: 0,
      work: {
        ...defaultSettings.work,
        probationIncome: 4000,
        monthlyIncome: 6000,
        regularStartDate: '2026-11-10',
      },
    },
  };

  const probation = deriveFinancials(workState, new Date('2026-10-15T12:00:00+08:00'));
  const regular = deriveFinancials(workState, new Date('2026-11-15T12:00:00+08:00'));

  expect(probation.todaySpendable).toBe(235.29);
  expect(probation.hourlyIncome).toBe(18.52);
  expect(regular.todaySpendable).toBe(375);
  expect(regular.hourlyIncome).toBe(28.85);
});
