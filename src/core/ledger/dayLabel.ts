/**
 * 分组头文案（纯函数）。
 *
 * 单独抽出来的原因：星期必须用真实年份算。早期版本写死 `new Date(2000, m-1, d)`，
 * 把所有日期的星期都算错一格（2026-11-15 是周日，显示成周三），而当时没有任何测试能抓到。
 * 现在这层有 dateKey 的纯函数测试兜着。
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** YYYY-MM-DD → 0=周日 … 6=周六。非法输入返回 null。 */
export function weekdayOf(dayKey: string): number | null {
  const parts = dayKey.split('-').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d).getDay();
}

/**
 * 分组头文案：今天 · 11月17日 / 昨天 · 11月16日 / 11月15日 周日。
 * 非法 dayKey 原样返回，不抛。
 */
export function dayLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  const parts = dayKey.split('-').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [, m, d] = parts;
  const dow = weekdayOf(dayKey);
  const weekday = dow === null ? '' : WEEKDAYS[dow];
  if (dayKey === todayKey) return `今天 · ${m}月${d}日`;
  if (dayKey === yesterdayKey) return `昨天 · ${m}月${d}日`;
  return weekday === '' ? `${m}月${d}日` : `${m}月${d}日 ${weekday}`;
}

/**
 * 记账页日期字段的文案：永远写绝对日期 + 星期（原型「11月17日 周一」）。
 * 和 dayLabel 分开的原因：记账时日期是「这笔账算哪天」，写「今天」就说不清是记哪天，
 * 而流水分组头要的是相对感（今天/昨天）。
 */
export function absoluteDayLabel(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}
