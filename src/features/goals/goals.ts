import { LedgerState } from '../../core/model/finance';

export interface GoalDraft {
  name: string;
  targetAmount: number;
  deadline: string;
}

export function updateGoal(state: LedgerState, draft: GoalDraft, now = new Date()): LedgerState {
  const name = draft.name.trim();
  if (!name) throw new Error('goal-name-required');
  if (!Number.isFinite(draft.targetAmount) || draft.targetAmount <= 0) throw new Error('goal-amount-invalid');
  if (!isValidGoalDate(draft.deadline)) throw new Error('goal-deadline-invalid');
  return {
    ...state,
    goal: {
      id: state.goal?.id ?? `goal_${Date.now().toString(36)}`,
      name,
      targetAmount: Math.round(draft.targetAmount * 100) / 100,
      startBalance: state.goal?.startBalance ?? currentBalance(state),
      startBalanceAt: state.goal?.startBalanceAt ?? now.toISOString(),
      deadline: draft.deadline,
    },
  };
}

function currentBalance(state: LedgerState): number {
  return Math.round(state.accounts.reduce((sum, account) => {
    if (account.kind === 'credit') return sum;
    return sum + Math.max(0, account.balance);
  }, 0) * 100) / 100;
}

export function isValidGoalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}