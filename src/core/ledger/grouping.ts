/**
 * 流水按天分组（纯函数）。
 * 首页「按天分组 + 折叠」直接消费 groupByDay；分组头文案用 summarizeDayItems（多币种安全）。
 */

import { formatCurrencyAmount } from '../currency';

export type TransactionKind = 'expense' | 'income' | 'transfer';

export interface GroupableTransaction {
  id: number;
  kind: TransactionKind;
  amountCents: number;
  occurredAt: number; // epoch 秒
}

export interface DayGroup<T extends GroupableTransaction = GroupableTransaction> {
  dayKey: string; // YYYY-MM-DD
  items: T[];
}

export function dayKeyOf(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 把流水按天分组：今天在前，组内新交易在前。transfer 腿只占行、不计任何日汇总。 */
export function groupByDay<T extends GroupableTransaction>(rows: T[]): DayGroup<T>[] {
  const map = new Map<string, DayGroup<T>>();
  for (const t of rows) {
    const key = dayKeyOf(t.occurredAt);
    let g = map.get(key);
    if (!g) {
      g = { dayKey: key, items: [] };
      map.set(key, g);
    }
    g.items.push(t);
  }
  const groups = [...map.values()];
  for (const g of groups) g.items.sort((a, b) => b.occurredAt - a.occurredAt);
  groups.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
  return groups;
}

/**
 * 分组头文案（多币种安全，验收 17）：支出/收入各自按币种汇总，按币种代码排序。
 * 例：expenseLines=['-¥86.00','-$20.00']（支出以负号展示），incomeLines=['¥100.00']。
 * transfer 腿不计入任何汇总（带符号两腿会互相抵消，也无需计入）。
 */
export function summarizeDayItems<T extends GroupableTransaction & { currency?: string }>(
  items: T[],
): { expenseLines: string[]; incomeLines: string[] } {
  const expenseByCurrency = new Map<string, number>();
  const incomeByCurrency = new Map<string, number>();
  for (const t of items) {
    const currency = t.currency ?? 'CNY';
    if (t.kind === 'expense') {
      expenseByCurrency.set(currency, (expenseByCurrency.get(currency) ?? 0) + t.amountCents);
    } else if (t.kind === 'income') {
      incomeByCurrency.set(currency, (incomeByCurrency.get(currency) ?? 0) + t.amountCents);
    }
  }
  const toLines = (map: Map<string, number>, sign: 1 | -1): string[] =>
    [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([code, minor]) => formatCurrencyAmount(sign * minor, code));
  return { expenseLines: toLines(expenseByCurrency, -1), incomeLines: toLines(incomeByCurrency, 1) };
}
