import { Debt, Goal, Transaction } from '../model/finance';
import { formatLocalDateKey } from '../time/dateKey';
import { roundMoney } from './money';

export interface GoalPlanSnapshot {
  currentBalance: number;
  incomeSinceStart: number;
}

export interface GoalPlan {
  netSaved: number;
  shortfallFromStart: number;
  remainingAmount: number;
  remainingDays: number;
  dailySave: number;
  progress: number;
}

export function calculateDailyPlan(input: { remainingGoal: number; remainingDays: number }) {
  const remaining = Math.max(0, input.remainingGoal);
  const days = Math.max(1, input.remainingDays);
  return { dailySave: Math.round((remaining / days) * 100) / 100 };
}

export function calculateGoalPlan(goal: Goal, snapshot: GoalPlanSnapshot, now = new Date()): GoalPlan {
  const netSaved = roundMoney(snapshot.currentBalance - goal.startBalance - snapshot.incomeSinceStart);
  const remainingAmount = Math.max(0, roundMoney(goal.targetAmount - netSaved));
  const remainingDays = Math.max(1, daysUntil(goal.deadline, now));
  return {
    netSaved,
    shortfallFromStart: Math.max(0, roundMoney(-netSaved)),
    remainingAmount,
    remainingDays,
    dailySave: calculateDailyPlan({ remainingGoal: remainingAmount, remainingDays }).dailySave,
    progress: goal.targetAmount > 0 ? Math.max(0, Math.min(100, netSaved / goal.targetAmount * 100)) : 0,
  };
}

export function calculateDailySpendBudget(input: { dailyBudget: number; spent: number }) {
  return Math.round(Math.max(0, input.dailyBudget - input.spent) * 100) / 100;
}

export function calculateCashFlow(input: { income: number; requiredOutflows: number }) {
  const available = Math.round((input.income - input.requiredOutflows) * 100) / 100;
  return { available, shortfall: Math.max(0, -available) };
}

export function daysUntil(date: string, now = new Date()) {
  const target = new Date(date + 'T00:00:00');
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

export interface MonthlyBudgetInput {
  transactions: Transaction[];
  debts: Debt[];
  goalDailySave: number;
  monthlyIncome: number;
  essentialMonthlyExpenses: number;
  workDaysPerMonth: number;
  workHoursPerDay: number;
}

export interface MonthlyBudget {
  monthToDateIncome: number;
  monthToDateExpenses: number;
  monthToDateEssentialExpenses: number;
  upcomingRepayments: number;
  remainingDays: number;
  goalDailySave: number;
  essentialReserve: number;
  projectedNet: number;
  dailySpend: number;
  shortfall: number;
  extraWorkHours: number;
}

export function calculateMonthlyBudget(input: MonthlyBudgetInput, now = new Date()): MonthlyBudget {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const remainingDays = Math.max(1, Math.ceil((nextMonthStart.getTime() - dayStart.getTime()) / 86400000));
  const currentMonthTransactions = input.transactions.filter((transaction) => {
    const occurred = new Date(transaction.occurredAt);
    return occurred >= monthStart && occurred < nextMonthStart;
  });
  const monthToDateIncome = sumTransactions(currentMonthTransactions.filter((transaction) => transaction.eventKind !== 'refund'), 'income');
  const grossExpenses = sumTransactions(currentMonthTransactions.filter((transaction) => !(transaction.type === 'expense' && transaction.category === '余额校准' && transaction.source === 'manual')), 'expense');
  const refundedAmount = currentMonthTransactions
    .filter((transaction) => transaction.type === 'income' && transaction.eventKind === 'refund')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthToDateExpenses = Math.round(Math.max(0, grossExpenses - refundedAmount) * 100) / 100;
  const monthToDateEssentialExpenses = currentMonthTransactions
    .filter((transaction) => transaction.type === 'expense' && transaction.budgetGroup === 'essential')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthEndDate = formatLocalDateKey(new Date(nextMonthStart.getTime() - 1));
  const upcomingRepayments = roundMoney(input.debts
    .filter((debt) => debt.dueDate <= monthEndDate)
    .reduce((sum, debt) => sum + debtPayableAmount(debt), 0));
  const essentialReserve = Math.max(0, input.essentialMonthlyExpenses - monthToDateEssentialExpenses);
  const expectedIncome = Math.max(input.monthlyIncome, monthToDateIncome);
  const goalReserve = input.goalDailySave * remainingDays;
  const available = expectedIncome - monthToDateExpenses - essentialReserve - upcomingRepayments - goalReserve;
  const shortfall = Math.round(Math.max(0, -available) * 100) / 100;
  const hourlyIncome = expectedIncome / (Math.max(1, input.workDaysPerMonth) * Math.max(1, input.workHoursPerDay));

  return {
    monthToDateIncome,
    monthToDateExpenses,
    monthToDateEssentialExpenses,
    upcomingRepayments,
    remainingDays,
    goalDailySave: input.goalDailySave,
    essentialReserve,
    projectedNet: Math.round(available * 100) / 100,
    dailySpend: Math.round((Math.max(0, available) / remainingDays) * 100) / 100,
    shortfall,
    extraWorkHours: hourlyIncome > 0 ? Math.round((shortfall / hourlyIncome) * 100) / 100 : 0,
  };
}

export function debtPayableAmount(debt: Debt): number {
  return debt.repaymentMode === 'full' ? debt.amount : (debt.minimumPayment ?? debt.amount);
}

function sumTransactions(transactions: Transaction[], type: 'income' | 'expense'): number {
  return transactions.filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}