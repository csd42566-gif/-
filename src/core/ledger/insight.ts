/**
 * 洞察页的数据派生（纯函数，零 React）。
 *
 * 口径：
 * - 只按单一币种统计（多币种混加没有意义），调用方指定币种（主币种 CNY）。
 * - 「本月」指 anchor 所在自然月；anchor 落在当前月时「日均」按已过天数算，
 *   落在历史月份时按整月天数算（否则会显示成「日均 = 总额」这种假数）。
 * - 转账两腿不进任何支出/收入汇总（与 grouping.summarizeDayItems 同口径）。
 */

import { formatCurrencyAmount } from '../currency';

export interface InsightRow {
  kind: string;
  amountCents: number;
  occurredAt: number; // epoch 秒
  currency: string;
  categoryId: number | null;
}

export interface MonthKey {
  year: number;
  /** 1–12。 */
  month: number;
}

export interface MonthExpenseSummary {
  totalCents: number;
  /** 笔数（只数支出）。 */
  count: number;
  /** 统计用的天数：当前月取今天几号，历史月取该月总天数。 */
  elapsedDays: number;
  /** 日均（分，已四舍五入）。 */
  avgPerDayCents: number;
  /** 单日最高：没有支出时为 null。 */
  peakDayKey: string | null;
  peakDayCents: number;
}

export interface CategorySlice {
  categoryId: number;
  cents: number;
  /** 占本月总支出（同币种）的百分比，四舍五入到整数。 */
  percent: number;
}

export interface MonthTotal {
  key: MonthKey;
  /** 展示用「2026年11月」。 */
  label: string;
  /** 展示用「11月」。 */
  shortLabel: string;
  cents: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function monthKeyOf(anchor: Date): MonthKey {
  return { year: anchor.getFullYear(), month: anchor.getMonth() + 1 };
}

/** 该月第一天 00:00 与下月第一天 00:00（epoch 秒，左闭右开）。 */
export function monthRange(anchor: Date): { start: number; end: number } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  return {
    start: new Date(y, m, 1).getTime() / 1000,
    end: new Date(y, m + 1, 1).getTime() / 1000,
  };
}

/** 该月总天数。 */
export function daysInMonth(anchor: Date): number {
  return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
}

function localDayKey(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** 当月支出汇总（总额 / 笔数 / 日均 / 最高单日）。 */
export function monthExpenseSummary(
  rows: InsightRow[],
  anchor: Date,
  currency: string,
  now: Date = new Date(),
): MonthExpenseSummary {
  const { start, end } = monthRange(anchor);
  const thisMonth = isSameMonth(anchor, now);
  const elapsedDays = thisMonth ? now.getDate() : daysInMonth(anchor);

  let totalCents = 0;
  let count = 0;
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== 'expense') continue;
    if (row.currency !== currency) continue;
    if (row.occurredAt < start || row.occurredAt >= end) continue;
    totalCents += row.amountCents;
    count += 1;
    const key = localDayKey(row.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + row.amountCents);
  }

  let peakDayKey: string | null = null;
  let peakDayCents = 0;
  for (const [key, cents] of byDay) {
    if (cents > peakDayCents) {
      peakDayCents = cents;
      peakDayKey = key;
    }
  }

  return {
    totalCents,
    count,
    elapsedDays,
    avgPerDayCents: elapsedDays > 0 ? Math.round(totalCents / elapsedDays) : 0,
    peakDayKey,
    peakDayCents,
  };
}

/**
 * 分类占比（当月，按金额降序）。percent 是四舍五入整数，合计可能不是 100。
 *
 * 传了 `parentOf`（子类 id → 父类 id）就把小类上卷到大类再统计：
 * 流水一般记在「午饭」这种小类上，但占比图和洞察文案说的是「吃饭」这个大类，
 * 不上卷会得到「午饭 100%」这种只对小类有意义的数。
 */
export function categorySlices(
  rows: InsightRow[],
  anchor: Date,
  currency: string,
  parentOf?: ReadonlyMap<number, number>,
): CategorySlice[] {
  const { start, end } = monthRange(anchor);
  const byCategory = new Map<number, number>();
  let total = 0;
  for (const row of rows) {
    if (row.kind !== 'expense') continue;
    if (row.currency !== currency) continue;
    if (row.occurredAt < start || row.occurredAt >= end) continue;
    if (row.categoryId === null) continue;
    const root = parentOf?.get(row.categoryId) ?? row.categoryId;
    total += row.amountCents;
    byCategory.set(root, (byCategory.get(root) ?? 0) + row.amountCents);
  }
  return [...byCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      cents,
      percent: total > 0 ? Math.round((cents / total) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);
}

/**
 * 最近 count 个月的支出合计（最新在前）。默认两个月：本月 vs 上月。
 * 用于底部「本月 vs 上月」对比条。
 */
export function monthTotals(
  rows: InsightRow[],
  anchor: Date,
  currency: string,
  count = 2,
): MonthTotal[] {
  const result: MonthTotal[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const { start, end } = monthRange(d);
    let cents = 0;
    for (const row of rows) {
      if (row.kind !== 'expense') continue;
      if (row.currency !== currency) continue;
      if (row.occurredAt < start || row.occurredAt >= end) continue;
      cents += row.amountCents;
    }
    result.push({
      key: monthKeyOf(d),
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      shortLabel: `${d.getMonth() + 1}月`,
      cents,
    });
  }
  return result;
}

/** 洞察页分段控件选中的统计范围。 */
export type StatRange = 'day' | 'week' | 'month';

export interface RangeWindow {
  /** 起点（epoch 秒，含）。 */
  start: number;
  /** 终点（epoch 秒，不含）。 */
  end: number;
  /** 窗口天数，用于算日均。 */
  days: number;
  /** 主卡上的标题：「本日支出 / 本周支出 / 本月支出」。 */
  label: string;
  /** 上一周期的同形状窗口，用于环比。 */
  prevStart: number;
  prevEnd: number;
  prevLabel: string;
}

const DAY_SECONDS = 24 * 60 * 60;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000;
}

/**
 * 统计窗口（纯函数）。
 *
 * 口径写死在这里，UI 不再自己算：
 * - `day`：今天 00:00 起，到明天 00:00；
 * - `week`：近 7 天（含今天），按自然日切，不跟周一起算 —— 用户看的「本周」是最近七天，
 *   不是「周一到现在」，后者在周一只会给出一天的数据；
 * - `month`：本月 1 号到下月 1 号，日均按「已过天数」算，与 monthExpenseSummary 一致。
 */
export function rangeWindow(range: StatRange, now: Date): RangeWindow {
  const todayStart = startOfLocalDay(now);
  if (range === 'day') {
    return {
      start: todayStart,
      end: todayStart + DAY_SECONDS,
      days: 1,
      label: '本日支出',
      prevStart: todayStart - DAY_SECONDS,
      prevEnd: todayStart,
      prevLabel: '昨天',
    };
  }
  if (range === 'week') {
    const start = todayStart - 6 * DAY_SECONDS;
    return {
      start,
      end: todayStart + DAY_SECONDS,
      days: 7,
      label: '近 7 天支出',
      prevStart: start - 7 * DAY_SECONDS,
      prevEnd: start,
      prevLabel: '前 7 天',
    };
  }
  const { start, end } = monthRange(now);
  const prevAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = monthRange(prevAnchor);
  return {
    start,
    end,
    days: now.getDate(),
    label: '本月支出',
    prevStart: prev.start,
    prevEnd: prev.end,
    prevLabel: '上月',
  };
}

/**
 * 任意窗口的支出汇总。形状与 monthExpenseSummary 一致，让页面只认一种返回类型。
 * 日均按窗口天数算（day=1、week=7、month=已过天数）。
 */
export function rangeExpenseSummary(
  rows: InsightRow[],
  range: StatRange,
  now: Date,
  currency: string,
): MonthExpenseSummary {
  const win = rangeWindow(range, now);
  let totalCents = 0;
  let count = 0;
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== 'expense') continue;
    if (row.currency !== currency) continue;
    if (row.occurredAt < win.start || row.occurredAt >= win.end) continue;
    totalCents += row.amountCents;
    count += 1;
    const key = localDayKey(row.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + row.amountCents);
  }

  let peakDayKey: string | null = null;
  let peakDayCents = 0;
  for (const [key, cents] of byDay) {
    if (cents > peakDayCents) {
      peakDayCents = cents;
      peakDayKey = key;
    }
  }

  return {
    totalCents,
    count,
    elapsedDays: win.days,
    avgPerDayCents: win.days > 0 ? Math.round(totalCents / win.days) : 0,
    peakDayKey,
    peakDayCents,
  };
}

/** 任意窗口的分类占比（小类上卷规则同 categorySlices）。 */
export function rangeCategorySlices(
  rows: InsightRow[],
  range: StatRange,
  now: Date,
  currency: string,
  parentOf?: ReadonlyMap<number, number>,
): CategorySlice[] {
  const win = rangeWindow(range, now);
  const byCategory = new Map<number, number>();
  let total = 0;
  for (const row of rows) {
    if (row.kind !== 'expense') continue;
    if (row.currency !== currency) continue;
    if (row.occurredAt < win.start || row.occurredAt >= win.end) continue;
    if (row.categoryId === null) continue;
    const root = parentOf?.get(row.categoryId) ?? row.categoryId;
    total += row.amountCents;
    byCategory.set(root, (byCategory.get(root) ?? 0) + row.amountCents);
  }
  return [...byCategory.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      cents,
      percent: total > 0 ? Math.round((cents / total) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);
}

/** 本期 / 上一期的支出合计，用于「本期 vs 上期」对比条。 */
export function rangeTotals(
  rows: InsightRow[],
  range: StatRange,
  now: Date,
  currency: string,
): { label: string; cents: number }[] {
  const win = rangeWindow(range, now);
  const sum = (start: number, end: number): number => {
    let cents = 0;
    for (const row of rows) {
      if (row.kind !== 'expense') continue;
      if (row.currency !== currency) continue;
      if (row.occurredAt < start || row.occurredAt >= end) continue;
      cents += row.amountCents;
    }
    return cents;
  };
  return [
    { label: range === 'month' ? '本月' : '本期', cents: sum(win.start, win.end) },
    { label: win.prevLabel, cents: sum(win.prevStart, win.prevEnd) },
  ];
}

export interface InsightNote {
  /** 稳定 id，用作列表 key。 */
  key: string;
  title: string;
  body: string;
}

/** 「M月D日」。dayKey 形如 YYYY-MM-DD。 */
export function dayKeyLabel(dayKey: string): string {
  const parts = dayKey.split('-');
  if (parts.length !== 3) return dayKey;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

/**
 * 「值得留意」的三条结论：规则生成，每条都带具体数字。
 * 优先级：最大分类占比 → 最高单日 → 预算消耗率 → 环比。
 * 没有数据时返回空数组，调用方整块隐藏。
 */
export function buildInsightNotes(input: {
  summary: MonthExpenseSummary;
  slices: CategorySlice[];
  categoryName: (id: number) => string;
  currency: string;
  /** 月预算（分，仅 CNY）；0 表示未设置。 */
  budgetCents: number;
  /** 上一周期支出（分，同币种）。 */
  prevMonthCents: number;
  /** 窗口的人话名字，如「本月」「近 7 天」「今天」。缺省「本月」。 */
  periodLabel?: string;
  /** 上一周期人话名字，如「上月」「前 7 天」「昨天」。缺省「上月」。 */
  prevPeriodLabel?: string;
}): InsightNote[] {
  const {
    summary,
    slices,
    categoryName,
    currency,
    budgetCents,
    prevMonthCents,
    periodLabel = '本月',
    prevPeriodLabel = '上月',
  } = input;
  const notes: InsightNote[] = [];
  const money = (cents: number) => formatCurrencyAmount(cents, currency);

  if (summary.totalCents === 0) return notes;

  // 1. 最大分类占比
  const top = slices[0];
  if (top !== undefined && top.percent >= 30) {
    const name = categoryName(top.categoryId);
    notes.push({
      key: 'top-category',
      title: `${name}占最多`,
      body: `${periodLabel} ${money(top.cents)} 花在${name}上，占全部支出的 ${top.percent}%。`,
    });
  }

  // 2. 最高单日
  if (summary.peakDayKey !== null && summary.peakDayCents > 0) {
    const share =
      summary.totalCents > 0 ? Math.round((summary.peakDayCents / summary.totalCents) * 100) : 0;
    notes.push({
      key: 'peak-day',
      title: `${dayKeyLabel(summary.peakDayKey)} 花得最多`,
      body: `单日 ${money(summary.peakDayCents)}，占${periodLabel}的 ${share}%。`,
    });
  }

  // 3. 预算消耗率（没设预算时这条让位给环比）
  if (budgetCents > 0) {
    const used = Math.round((summary.totalCents / budgetCents) * 100);
    const title =
      used >= 100
        ? '预算已经超了'
        : used >= 80
          ? '预算快到头了'
          : used >= 50
            ? '预算用掉一半'
            : '预算还剩大半';
    notes.push({
      key: 'budget',
      title,
      body: `月预算 ${money(budgetCents)}，已用掉 ${used}%。`,
    });
  }

  // 4. 环比（有上一周期数据才出，作为第 3 条的补位或第 3 条本身）
  if (prevMonthCents > 0) {
    const diff = summary.totalCents - prevMonthCents;
    const pct = Math.round((Math.abs(diff) / prevMonthCents) * 100);
    notes.push({
      key: 'mom',
      title: diff >= 0 ? `比${prevPeriodLabel}多花` : `比${prevPeriodLabel}少花`,
      body: `${prevPeriodLabel} ${money(prevMonthCents)}，${periodLabel}${diff >= 0 ? '多' : '少'}了 ${money(
        Math.abs(diff),
      )}（${pct}%）。`,
    });
  }

  return notes.slice(0, 3);
}
