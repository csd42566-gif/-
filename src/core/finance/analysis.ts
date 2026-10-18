import { LedgerState } from '../model/finance';
import { EarningsResult } from '../work/attendance';
import { DerivedFinancials } from './derive';

export interface Insight {
  level: 'info' | 'warn' | 'danger';
  headline: string;
  detail: string;
  action?: string;
}

export function analyze(state: LedgerState, earnings: EarningsResult, financials: DerivedFinancials): Insight[] {
  const hasRecords = state.transactions.length > 0 || (state.attendance?.length ?? 0) > 0;
  if (!hasRecords) return [healthyInsight(earnings, financials)];

  const insights: Insight[] = [];
  const push = (insight: Insight) => {
    if (insights.length < 3) insights.push(insight);
  };

  if (financials.shortfall > 0) {
    const dailyReduction = financials.shortfall / Math.max(1, financials.remainingDays);
    push({
      level: 'danger',
      headline: '本月预计透支',
      detail: `预计透支 ¥${money(financials.shortfall)}，当前时薪 ¥${money(financials.hourlyIncome)}，约需多上 ${financials.extraWorkHours.toFixed(1)} 小时班，或每天少花 ¥${money(dailyReduction)}`,
      action: '调整目标或减少弹性消费',
    });
  }

  const monthlyBudget = round(financials.monthSpent + financials.projectedNet);
  if (monthlyBudget > 0 && financials.remainingDays > 1 && financials.monthSpent >= monthlyBudget * 0.75) {
    push({
      level: 'warn',
      headline: '照这个速度，月底会超支',
      detail: `已花 ¥${money(financials.monthSpent)} / 预算 ¥${money(monthlyBudget)}，还剩 ${financials.remainingDays} 天`,
      action: `今天可花额度 ¥${money(financials.todaySpendable)}`,
    });
  }

  const todaySpent = todayExpenseTotal(state);
  const todayBudget = todaySpent + Math.max(0, financials.todaySpendable);
  if (todayBudget > 0 && todaySpent > todayBudget * 0.75) {
    push({
      level: 'warn',
      headline: '今天已经花掉大半了',
      detail: `已花 ¥${money(todaySpent)}，还剩 ¥${money(financials.todaySpendable)}`,
    });
  }

  if (state.goal) {
    push({
      level: 'info',
      headline: '储蓄目标尚未达成',
      detail: `距离『${state.goal.name}』还差 ¥${money(financials.goalRemaining)}，剩余 ${financials.goalRemainingDays} 天，每天需存 ¥${money(financials.goalDailySave)}`,
      action: '查看目标 ›',
    });
  }

  return insights.length ? insights : [healthyInsight(earnings, financials)];
}

function healthyInsight(earnings: EarningsResult, financials: DerivedFinancials): Insight {
  return {
    level: 'info',
    headline: '当前节奏健康',
    detail: `本周期已赚 ¥${money(earnings.cycleEarned)}，今日可花 ¥${money(financials.todaySpendable)}`,
  };
}

function todayExpenseTotal(state: LedgerState): number {
  const now = new Date();
  const today = localDateKey(now);
  return round(state.transactions
    .filter((transaction) => transaction.type === 'expense')
    .filter((transaction) => !(transaction.category === '余额校准' && transaction.source === 'manual'))
    .filter((transaction) => localDateKey(new Date(transaction.occurredAt)) === today)
    .reduce((sum, transaction) => sum + transaction.amount, 0));
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function money(value: number): string {
  return round(value).toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}