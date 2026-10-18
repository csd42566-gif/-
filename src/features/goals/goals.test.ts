import { defaultSettings, LedgerState } from '../../core/model/finance';
import { calculateGoalPlan } from '../../core/finance/calculations';
import { isValidGoalDate, updateGoal } from './goals';

const state: LedgerState = {
  accounts: [],
  transactions: [],
  pendingTransactions: [],
  debts: [],
  goal: { id: 'goal', name: '一年存下 10 万', targetAmount: 100000, startBalance: -20000, startBalanceAt: '2026-01-01T00:00:00.000Z', deadline: '2027-10-15' },
  settings: { ...defaultSettings },
};

describe('savings goal', () => {
  test.each(['2027-10-16', '2030-02-28'])('accepts a valid calendar date: %s', (deadline) => {
    expect(isValidGoalDate(deadline)).toBe(true);
  });

  test.each(['2027-02-30', '2027/10/16', '2027-1-6', ''])('rejects an invalid calendar date: %s', (deadline) => {
    expect(isValidGoalDate(deadline)).toBe(false);
  });

  test('creates a start balance snapshot when setting the first goal', () => {
    const withoutGoal: LedgerState = {
      ...state,
      accounts: [
        { id: 'cash', name: '现金', kind: 'cash', balance: 500 },
        { id: 'credit', name: '信用卡', kind: 'credit', balance: 2000 },
      ],
      goal: null,
    };
    const next = updateGoal(withoutGoal, { name: '应急金', targetAmount: 10000, deadline: '2027-10-15' }, new Date('2026-10-18T00:00:00.000Z'));

    expect(next.goal).toMatchObject({ startBalance: 500, startBalanceAt: '2026-10-18T00:00:00.000Z' });
  });

  test('updates goal details without changing saved progress', () => {
    const next = updateGoal(state, { name: '旅行基金', targetAmount: 60000, deadline: '2026-10-30' });

    expect(next.goal).toEqual({
      id: 'goal',
      name: '旅行基金',
      targetAmount: 60000,
      startBalance: -20000,
      startBalanceAt: '2026-01-01T00:00:00.000Z',
      deadline: '2026-10-30',
    });
  });

  test.each([
    { name: '旅行基金', targetAmount: 0, deadline: '2026-10-30' },
    { name: '   ', targetAmount: 60000, deadline: '2026-10-30' },
    { name: '旅行基金', targetAmount: 60000, deadline: '2026-02-30' },
  ])('rejects invalid goal details: %j', (draft) => {
    expect(() => updateGoal(state, draft)).toThrow();
  });

  test('plans savings using the goal deadline', () => {
    const plan = calculateGoalPlan(state.goal!, { currentBalance: 0, incomeSinceStart: 0 }, new Date('2026-10-15T12:00:00'));

    expect(plan.remainingDays).toBe(365);
    expect(plan.dailySave).toBe(219.18);
    expect(plan.remainingAmount).toBe(80000);
  });
});
