import { calculateDailyPlan, calculateCashFlow, calculateAvailableSpend, calculateDailySpendBudget, calculateProjectedCashFlow, calculateMonthlyBudget } from './calculations';
import { Debt, Goal, Transaction } from '../model/finance';
describe('financial calculations',()=>{test('calculates daily savings target from remaining amount and days',()=>{expect(calculateDailyPlan({remainingGoal:80000,remainingDays:365}).dailySave).toBe(219.18);});test('does not produce a negative daily target after goal is completed',()=>{expect(calculateDailyPlan({remainingGoal:-1,remainingDays:365}).dailySave).toBe(0);});test('calculates cash-flow shortfall from income and required outflows',()=>{expect(calculateCashFlow({income:8000,requiredOutflows:8360})).toEqual({available:-360,shortfall:360});});test('projects cash flow with expenses, repayments, and monthly goal savings',()=>{expect(calculateProjectedCashFlow({income:8000,expenses:136,repayments:5060,dailyGoalSaving:219.18,periodDays:30})).toEqual({available:-3771.4,shortfall:3771.4});});test('excludes transfers from spend totals',()=>{const transactions:Transaction[]=[{id:'1',type:'expense',amount:100,accountId:'cash',occurredAt:'2026-10-15',source:'manual'},{id:'2',type:'transfer',amount:500,accountId:'cash',occurredAt:'2026-10-15',source:'manual'}];expect(calculateAvailableSpend({income:1000,transactions,debts:[],goal:null})).toBe(900);});test.each([{spent:50,expected:70},{spent:120,expected:0},{spent:136,expected:0}])('calculates remaining daily budget without wrapping after overspending',({spent,expected})=>{expect(calculateDailySpendBudget({dailyBudget:120,spent})).toBe(expected);});});

describe('monthly budget projection', () => {
  const goal: Goal = { id: 'goal', name: 'Savings', targetAmount: 12000, savedAmount: 0, deadline: '2026-11-16' };
  const debts: Debt[] = [
    { id: 'due', name: 'Rent', amount: 1000, dueDate: '2026-10-25', kind: 'bill' },
    { id: 'past', name: 'Paid bill', amount: 500, dueDate: '2026-10-10', kind: 'bill' },
    { id: 'next-month', name: 'Card', amount: 700, dueDate: '2026-11-05', kind: 'credit' },
  ];
  const transactions: Transaction[] = [
    { id: 'this-month-expense', type: 'expense', amount: 300, accountId: 'cash', occurredAt: '2026-10-05T08:00:00.000Z', source: 'manual' },
    { id: 'this-month-transfer', type: 'transfer', amount: 900, accountId: 'cash', occurredAt: '2026-10-06T08:00:00.000Z', source: 'manual' },
    { id: 'last-month-expense', type: 'expense', amount: 4000, accountId: 'cash', occurredAt: '2026-09-30T08:00:00.000Z', source: 'manual' },
  ];

  test('uses only current-month spending and obligations due this month', () => {
    const plan = calculateMonthlyBudget({ transactions, debts, goal, monthlyIncome: 10000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.monthToDateExpenses).toBe(300);
    expect(plan.upcomingRepayments).toBe(1000);
    expect(plan.goalDailySave).toBe(375);
  });

  test('computes remaining daily allowance and converts a shortfall to work time', () => {
    const plan = calculateMonthlyBudget({ transactions, debts, goal, monthlyIncome: 5000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.dailySpend).toBe(0);
    expect(plan.shortfall).toBeGreaterThan(0);
    expect(plan.extraWorkHours).toBeCloseTo(plan.shortfall / 31.25, 2);
  });

  test('does not report work hours when there is no projected shortfall', () => {
    const plan = calculateMonthlyBudget({ transactions: [], debts: [], goal: null, monthlyIncome: 10000, essentialMonthlyExpenses: 0, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-01T12:00:00.000Z'));
    expect(plan.shortfall).toBe(0);
    expect(plan.extraWorkHours).toBe(0);
    expect(plan.dailySpend).toBeGreaterThan(0);
  });
});
