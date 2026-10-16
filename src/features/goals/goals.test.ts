import { defaultSettings, LedgerState } from '../../core/model/finance';
import { calculateGoalPlan } from '../../core/finance/calculations';
import { updateGoal } from './goals';

const state: LedgerState = {
  accounts: [],
  transactions: [],
  pendingTransactions: [],
  debts: [],
  goal: { id: 'goal', name: '一年存下 10 万', targetAmount: 100000, savedAmount: 20000, deadline: '2027-10-15' },
  settings: { ...defaultSettings },
};

describe('savings goal', () => {
  test('updates goal details without changing saved progress', () => {
    const next = updateGoal(state, { name: '旅行基金', targetAmount: 60000, deadline: '2026-10-30' });

    expect(next.goal).toEqual({
      id: 'goal',
      name: '旅行基金',
      targetAmount: 60000,
      savedAmount: 20000,
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
    const plan = calculateGoalPlan(state.goal!, new Date('2026-10-15T12:00:00'));

    expect(plan.remainingDays).toBe(365);
    expect(plan.dailySave).toBe(219.18);
    expect(plan.remainingAmount).toBe(80000);
  });
});
