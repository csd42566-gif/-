import { LedgerState } from '../../core/model/finance';

export interface GoalDraft {
  name: string;
  targetAmount: number;
  deadline: string;
}

export function updateGoal(state: LedgerState, draft: GoalDraft): LedgerState {
  const name = draft.name.trim();
  if (!name) throw new Error('goal-name-required');
  if (!Number.isFinite(draft.targetAmount) || draft.targetAmount <= 0) throw new Error('goal-amount-invalid');
  if (!isValidDate(draft.deadline)) throw new Error('goal-deadline-invalid');
  return {
    ...state,
    goal: {
      id: state.goal?.id ?? `goal_${Date.now().toString(36)}`,
      name,
      targetAmount: Math.round(draft.targetAmount * 100) / 100,
      savedAmount: state.goal?.savedAmount ?? 0,
      deadline: draft.deadline,
    },
  };
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
