import { calculateDailyPlan, calculateCashFlow, calculateDailySpendBudget, calculateMonthlyBudget } from './calculations';
import { Debt, Transaction } from '../model/finance';
describe('financial calculations',()=>{test('calculates daily savings target from remaining amount and days',()=>{expect(calculateDailyPlan({remainingGoal:80000,remainingDays:365}).dailySave).toBe(219.18);});test('does not produce a negative daily target after goal is completed',()=>{expect(calculateDailyPlan({remainingGoal:-1,remainingDays:365}).dailySave).toBe(0);});test('calculates cash-flow shortfall from income and required outflows',()=>{expect(calculateCashFlow({income:8000,requiredOutflows:8360})).toEqual({available:-360,shortfall:360});});test.each([{spent:50,expected:70},{spent:120,expected:0},{spent:136,expected:0}])('calculates remaining daily budget without wrapping after overspending',({spent,expected})=>{expect(calculateDailySpendBudget({dailyBudget:120,spent})).toBe(expected);});});

describe('monthly budget projection', () => {
  const debts: Debt[] = [
    { id: 'due', name: 'Rent', amount: 1000, dueDate: '2026-10-25', kind: 'bill', repaymentMode: 'minimum' },
    { id: 'past', name: 'Past bill', amount: 500, dueDate: '2026-10-10', kind: 'bill', repaymentMode: 'minimum' },
    { id: 'next-month', name: 'Card', amount: 700, dueDate: '2026-11-05', kind: 'credit', repaymentMode: 'minimum' },
  ];
  const transactions: Transaction[] = [
    { id: 'this-month-expense', type: 'expense', amount: 300, accountId: 'cash', occurredAt: '2026-10-05T08:00:00.000Z', source: 'manual' },
    { id: 'this-month-transfer', type: 'transfer', amount: 900, accountId: 'cash', occurredAt: '2026-10-06T08:00:00.000Z', source: 'manual' },
    { id: 'last-month-expense', type: 'expense', amount: 4000, accountId: 'cash', occurredAt: '2026-09-30T08:00:00.000Z', source: 'manual' },
  ];

  test('uses only current-month spending and includes overdue obligations', () => {
    const plan = calculateMonthlyBudget({ transactions, debts, goalDailySave: 375, monthlyIncome: 10000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.monthToDateExpenses).toBe(300);
    expect(plan.upcomingRepayments).toBe(1500);
    expect(plan.goalDailySave).toBe(375);
  });

  test('uses minimum payment or full amount according to repayment mode', () => {
    const modeDebts: Debt[] = [
      { id: 'minimum', name: '最低还款', amount: 1000, minimumPayment: 200, dueDate: '2026-10-20', kind: 'credit', repaymentMode: 'minimum' },
      { id: 'full', name: '全额还款', amount: 500, minimumPayment: 100, dueDate: '2026-10-21', kind: 'credit', repaymentMode: 'full' },
    ];
    const plan = calculateMonthlyBudget({ transactions: [], debts: modeDebts, goalDailySave: 0, monthlyIncome: 10000, essentialMonthlyExpenses: 0, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.upcomingRepayments).toBe(700);
  });

  test('nets refunded income against current-month expenses', () => {
    const withRefund: Transaction[] = [
      ...transactions,
      { id: 'refund', type: 'income', amount: 50, accountId: 'cash', occurredAt: '2026-10-07T08:00:00.000Z', source: 'import', eventKind: 'refund', category: '退款' },
    ];
    const plan = calculateMonthlyBudget({ transactions: withRefund, debts, goalDailySave: 375, monthlyIncome: 10000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.monthToDateExpenses).toBe(250);
  });
  test('computes remaining daily allowance and converts a shortfall to work time', () => {
    const plan = calculateMonthlyBudget({ transactions, debts, goalDailySave: 375, monthlyIncome: 5000, essentialMonthlyExpenses: 500, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-15T12:00:00.000Z'));
    expect(plan.dailySpend).toBe(0);
    expect(plan.shortfall).toBeGreaterThan(0);
    expect(plan.extraWorkHours).toBeCloseTo(plan.shortfall / 31.25, 2);
  });

  test('does not report work hours when there is no projected shortfall', () => {
    const plan = calculateMonthlyBudget({ transactions: [], debts: [], goalDailySave: 0, monthlyIncome: 10000, essentialMonthlyExpenses: 0, workDaysPerMonth: 20, workHoursPerDay: 8 }, new Date('2026-10-01T12:00:00.000Z'));
    expect(plan.shortfall).toBe(0);
    expect(plan.extraWorkHours).toBe(0);
    expect(plan.dailySpend).toBeGreaterThan(0);
  });
});
