/**
 * 首页余额卡右侧「近 30 天每日支出」曲线的数据派生（纯函数）。
 * 只按单一币种汇总：多币种混在一起画曲线没有意义，所以调用方指定币种（默认 CNY）。
 */

export interface DailyExpensePoint {
  /** YYYY-MM-DD（本地时区），最旧在前。 */
  dayKey: string;
  /** 该天该币种的支出合计（分，恒为非负）。 */
  cents: number;
}

export interface SparkSourceRow {
  kind: string;
  amountCents: number;
  occurredAt: number; // epoch 秒
  currency: string;
}

/** 本地时区的 YYYY-MM-DD（与 grouping.dayKeyOf 同规则，避免两套口径）。 */
function keyOfDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 最近 N 天的日期键，最旧在前、今天在最后。 */
export function lastNDayKeys(days: number, now: Date): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(keyOfDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return keys;
}

/**
 * 最近 N 天每日支出序列（最旧在前，缺数据的天补 0）。
 * 只统计 kind === 'expense' 且币种匹配的行；transfer 与收入不进曲线。
 */
export function dailyExpenseSeries(
  rows: SparkSourceRow[],
  days: number,
  now: Date,
  currency: string,
): DailyExpensePoint[] {
  const keys = lastNDayKeys(days, now);
  const sums = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const row of rows) {
    if (row.kind !== 'expense' || row.currency !== currency) continue;
    const key = keyOfDate(new Date(row.occurredAt * 1000));
    const current = sums.get(key);
    if (current === undefined) continue; // 窗口外的旧账不画
    sums.set(key, current + row.amountCents);
  }
  return keys.map((dayKey) => ({ dayKey, cents: sums.get(dayKey) ?? 0 }));
}

/** 曲线峰值（分）。全为 0 时返回 0，调用方据此决定是否画平线。 */
export function peakDailyCents(points: DailyExpensePoint[]): number {
  let peak = 0;
  for (const p of points) if (p.cents > peak) peak = p.cents;
  return peak;
}
