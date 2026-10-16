import { Debt, Goal, Transaction } from '../model/finance';
export function calculateDailyPlan(input:{remainingGoal:number;remainingDays:number}){const remaining=Math.max(0,input.remainingGoal);const days=Math.max(1,input.remainingDays);return {dailySave:Math.round((remaining/days)*100)/100};}
export function calculateGoalPlan(goal:Goal,now=new Date()){const remainingAmount=Math.max(0,goal.targetAmount-goal.savedAmount);const remainingDays=Math.max(1,daysUntil(goal.deadline,now));return {remainingAmount,remainingDays,dailySave:calculateDailyPlan({remainingGoal:remainingAmount,remainingDays}).dailySave,progress:goal.targetAmount>0?Math.min(100,goal.savedAmount/goal.targetAmount*100):0};}
export function calculateDailySpendBudget(input:{dailyBudget:number;spent:number}){return Math.round(Math.max(0,input.dailyBudget-input.spent)*100)/100;}
export function calculateCashFlow(input:{income:number;requiredOutflows:number}){const available=Math.round((input.income-input.requiredOutflows)*100)/100;return {available,shortfall:Math.max(0,-available)};}
export function calculateProjectedCashFlow(input:{income:number;expenses:number;repayments:number;dailyGoalSaving:number;periodDays:number}){return calculateCashFlow({income:input.income,requiredOutflows:input.expenses+input.repayments+input.dailyGoalSaving*Math.max(0,input.periodDays)});}
export function calculateAvailableSpend(input:{income:number;transactions:Transaction[];debts:Debt[];goal:Goal|null}){const expenses=input.transactions.filter(t=>t.type==='expense').reduce((sum,t)=>sum+t.amount,0);return Math.round((input.income-expenses)*100)/100;}
export function daysUntil(date:string,now=new Date()){const target=new Date(date+'T00:00:00');return Math.max(0,Math.ceil((target.getTime()-now.getTime())/86400000));}

export interface MonthlyBudgetInput {
  transactions: Transaction[];
  debts: Debt[];
  goal: Goal | null;
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
  const monthToDateIncome = sumTransactions(currentMonthTransactions, 'income');
  const monthToDateExpenses = sumTransactions(currentMonthTransactions, 'expense');
  const monthToDateEssentialExpenses = currentMonthTransactions
    .filter((transaction) => transaction.type === 'expense' && transaction.budgetGroup === 'essential')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthEnd = new Date(nextMonthStart.getTime() - 1);
  const today = toDateKey(now);
  const monthEndDate = toDateKey(monthEnd);
  const upcomingRepayments = input.debts
    .filter((debt) => debt.dueDate >= today && debt.dueDate <= monthEndDate)
    .reduce((sum, debt) => sum + debt.amount, 0);
  const goalDailySave = input.goal ? calculateGoalPlan(input.goal, now).dailySave : 0;
  const essentialReserve = Math.max(0, input.essentialMonthlyExpenses - monthToDateEssentialExpenses);
  const expectedIncome = Math.max(input.monthlyIncome, monthToDateIncome);
  const goalReserve = goalDailySave * remainingDays;
  const available = expectedIncome - monthToDateExpenses - essentialReserve - upcomingRepayments - goalReserve;
  const shortfall = Math.round(Math.max(0, -available) * 100) / 100;
  const hourlyIncome = expectedIncome / (Math.max(1, input.workDaysPerMonth) * Math.max(1, input.workHoursPerDay));

  return {
    monthToDateIncome,
    monthToDateExpenses,
    monthToDateEssentialExpenses,
    upcomingRepayments,
    remainingDays,
    goalDailySave,
    essentialReserve,
    projectedNet: Math.round(available * 100) / 100,
    dailySpend: Math.round((Math.max(0, available) / remainingDays) * 100) / 100,
    shortfall,
    extraWorkHours: hourlyIncome > 0 ? Math.round((shortfall / hourlyIncome) * 100) / 100 : 0,
  };
}

function sumTransactions(transactions: Transaction[], type: 'income' | 'expense'): number {
  return transactions.filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
