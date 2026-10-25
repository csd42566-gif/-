import { LedgerState } from '../model/finance';
import { formatLocalDateKey } from '../time/dateKey';
import { calculateEarnings } from '../work/attendance';
import { calculateGoalPlan, calculateMonthlyBudget, debtPayableAmount } from './calculations';
import { roundMoney } from './money';

export interface DerivedFinancials {
  availableBalance: number;
  monthSpent: number;
  monthIncome: number;
  todaySpendable: number;
  goalProgress: number;
  goalRemaining: number;
  goalSaved: number;
  goalShortfallFromStart: number;
  monthDue: number;
  overdueDue: number;
  goalDailySave: number;
  goalRemainingDays: number;
  goalReserve: number;
  essentialReserve: number;
  projectedNet: number;
  shortfall: number;
  extraWorkHours: number;
  hourlyIncome: number;
  remainingDays: number;
}

export function deriveFinancials(state: LedgerState, now = new Date()): DerivedFinancials {
  const availableBalance = roundMoney(state.accounts.reduce((sum, account) => {
    if (account.kind === 'credit') return sum;
    return sum + Math.max(0, account.balance);
  }, 0));
  const incomeSinceStart = state.goal ? incomeSince(state, state.goal.startBalanceAt) : 0;
  const goalPlan = state.goal ? calculateGoalPlan(state.goal, { currentBalance: availableBalance, incomeSinceStart }, now) : null;
  const work = state.settings.work;
  const earnings = calculateEarnings(work, state.attendance ?? [], now);
  const budget = calculateMonthlyBudget({
    transactions: state.transactions,
    debts: state.debts,
    goalDailySave: goalPlan?.dailySave ?? 0,
    monthlyIncome: earnings.monthlySalary,
    essentialMonthlyExpenses: state.settings.essentialMonthlyExpenses,
    workDaysPerMonth: earnings.expectedWorkDays,
    workHoursPerDay: work.workHoursPerDay,
  }, now);
  const today = formatLocalDateKey(now);
  const overdueDue = roundMoney(state.debts
    .filter((debt) => debt.dueDate < today)
    .reduce((sum, debt) => sum + debtPayableAmount(debt), 0));
  const expectedIncome = Math.max(earnings.monthlySalary, budget.monthToDateIncome);
  const hourlyIncome = expectedIncome / (Math.max(1, earnings.expectedWorkDays) * Math.max(1, work.workHoursPerDay));

  return {
    availableBalance,
    monthSpent: budget.monthToDateExpenses,
    monthIncome: budget.monthToDateIncome,
    todaySpendable: budget.dailySpend,
    goalProgress: goalPlan?.progress ?? 0,
    goalRemaining: goalPlan?.remainingAmount ?? 0,
    goalSaved: goalPlan?.netSaved ?? 0,
    goalShortfallFromStart: goalPlan?.shortfallFromStart ?? 0,
    monthDue: budget.upcomingRepayments,
    overdueDue,
    goalDailySave: goalPlan?.dailySave ?? 0,
    goalRemainingDays: goalPlan?.remainingDays ?? 0,
    goalReserve: roundMoney((goalPlan?.dailySave ?? 0) * budget.remainingDays),
    essentialReserve: budget.essentialReserve,
    projectedNet: budget.projectedNet,
    shortfall: budget.shortfall,
    extraWorkHours: budget.extraWorkHours,
    hourlyIncome: roundMoney(hourlyIncome),
    remainingDays: budget.remainingDays,
  };
}

function incomeSince(state: LedgerState, startAt: string): number {
  const start = new Date(startAt).getTime();
  return roundMoney(state.transactions
    .filter((transaction) => transaction.type === 'income' && transaction.eventKind !== 'refund')
    .filter((transaction) => new Date(transaction.occurredAt).getTime() >= start)
    .reduce((sum, transaction) => sum + transaction.amount, 0));
}