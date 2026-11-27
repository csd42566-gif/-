/**
 * 流水筛选（v2 决策 37）：纯函数，搜索 + 筛选全部规则显式化。
 * 输入为 TransactionLike 数组，输出新数组，不改输入。
 * 所有条件为空时原样返回（同一数组引用）。
 */

import { dayKeyOf } from './grouping';

export interface FilterCriteria {
  /** 备注模糊匹配（大小写不敏感，trim 后为空 = 不筛）。 */
  query?: string;
  /** 流水类型（空 = 全部）。 */
  kinds?: Array<'expense' | 'income' | 'transfer'>;
  /** 账户（空 = 全部）。 */
  accountIds?: number[];
  /** 分类（空 = 全部）。 */
  categoryIds?: number[];
  /** 币种（空 = 全部）。 */
  currencies?: string[];
  /** 金额下限（分，含）。 */
  minCents?: number;
  /** 金额上限（分，含）。 */
  maxCents?: number;
  /** 起始日期（YYYY-MM-DD，含）。 */
  fromDay?: string;
  /** 结束日期（YYYY-MM-DD，含）。 */
  toDay?: string;
}

export interface FilterableTransaction {
  id: number;
  kind: 'expense' | 'income' | 'transfer';
  amountCents: number;
  accountId: number;
  categoryId: number | null;
  currency: string;
  note: string;
  occurredAt: number; // epoch 秒
}

/** 大小写不敏感包含匹配（中文无大小写差异，等同精确包含）。 */
function matchesQuery(note: string, query: string): boolean {
  return note.toLowerCase().includes(query.toLowerCase());
}

/** 某 epoch 秒对应本地日期是否落在 [fromDay, toDay]（闭区间：>= from 且 <= to）。 */
function dayInRange(epochSeconds: number, fromDay?: string, toDay?: string): boolean {
  if (!fromDay && !toDay) return true;
  const day = dayKeyOf(epochSeconds);
  if (fromDay && day < fromDay) return false;
  if (toDay && day > toDay) return false;
  return true;
}

export function filterTransactions<T extends FilterableTransaction>(
  transactions: readonly T[],
  criteria: FilterCriteria,
): T[] {
  const {
    query,
    kinds,
    accountIds,
    categoryIds,
    currencies,
    minCents,
    maxCents,
    fromDay,
    toDay,
  } = criteria;

  const hasAny =
    (query !== undefined && query.trim() !== '') ||
    (kinds !== undefined && kinds.length > 0) ||
    (accountIds !== undefined && accountIds.length > 0) ||
    (categoryIds !== undefined && categoryIds.length > 0) ||
    (currencies !== undefined && currencies.length > 0) ||
    minCents !== undefined ||
    maxCents !== undefined ||
    fromDay !== undefined ||
    toDay !== undefined;
  if (!hasAny) return transactions as T[];

  const q = query?.trim().toLowerCase() ?? '';
  const kindSet = kinds && kinds.length > 0 ? new Set(kinds) : null;
  const accountSet = accountIds && accountIds.length > 0 ? new Set(accountIds) : null;
  const categorySet = categoryIds && categoryIds.length > 0 ? new Set(categoryIds) : null;
  const currencySet = currencies && currencies.length > 0 ? new Set(currencies) : null;

  return transactions.filter((t) => {
    if (q !== '' && !matchesQuery(t.note, q)) return false;
    if (kindSet && !kindSet.has(t.kind)) return false;
    if (accountSet && !accountSet.has(t.accountId)) return false;
    if (categorySet && (t.categoryId === null || !categorySet.has(t.categoryId))) return false;
    if (currencySet && !currencySet.has(t.currency)) return false;
    if (minCents !== undefined && Math.abs(t.amountCents) < minCents) return false;
    if (maxCents !== undefined && Math.abs(t.amountCents) > maxCents) return false;
    if (!dayInRange(t.occurredAt, fromDay, toDay)) return false;
    return true;
  });
}
