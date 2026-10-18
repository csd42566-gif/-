import { BudgetGroup, TransactionType } from '../../core/model/finance';
import { DerivedFinancials } from '../../core/finance/derive';
import { EarningsResult } from '../../core/work/attendance';

export type PunishmentLevel = 'none' | 'warn' | 'punish' | 'severe';

export interface PunishmentResult {
  level: PunishmentLevel;
  title: string;
  detail: string;
  hoursOfWork: number;
}

export function evaluateTransaction(input: {
  draft: { amount: number; type: TransactionType; budgetGroup?: BudgetGroup };
  earnings: EarningsResult;
  financials: DerivedFinancials;
}): PunishmentResult {
  const { draft, earnings, financials } = input;
  const hoursRaw = earnings.hourlySalary > 0 ? draft.amount / earnings.hourlySalary : 0;
  const hoursOfWork = round(hoursRaw);
  const amount = formatAmount(draft.amount);
  const hours = hoursRaw.toFixed(1);
  const expectedMonthlyIncome = Math.max(financials.monthIncome, earnings.monthlySalary);
  const reachedMonthlyIncome = financials.monthSpent + draft.amount >= expectedMonthlyIncome;

  if (reachedMonthlyIncome || hoursRaw >= 2) {
    return {
      level: 'severe',
      title: '极罚',
      detail: reachedMonthlyIncome
        ? `这笔 ¥${amount} 等于白干 ${hours} 小时。本月支出已经超过预计到手。`
        : `这笔 ¥${amount} 等于白干 ${hours} 小时。`,
      hoursOfWork,
    };
  }

  if (draft.budgetGroup === 'flexible' && draft.amount >= earnings.dailySalary * 0.25) {
    return {
      level: 'punish',
      title: '重罚',
      detail: `弹性消费 ¥${amount}，折合 ${hours} 小时工资。`,
      hoursOfWork,
    };
  }

  if (financials.todaySpendable - draft.amount <= 0) {
    return {
      level: 'warn',
      title: '警告',
      detail: '今天额度用尽，这笔让今天变成透支。',
      hoursOfWork,
    };
  }

  return { level: 'none', title: '', detail: '', hoursOfWork };
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}