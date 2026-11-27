/**
 * 储蓄目标的派生（纯函数，零 React）。
 *
 * 目标不挂账户、不进流水：已存金额由用户手填，所以这里只有展示层需要的换算——
 * 进度百分比、到期文案。金额一律整数分，不做浮点运算。
 */

const DAY_SECONDS = 24 * 60 * 60;

/**
 * 进度百分比（0–100，向下取整）。
 * 目标金额 <= 0 时按 0 处理（避免除零）；已存为负按 0；超出目标按 100 封顶。
 */
export function goalPercent(targetCents: number, savedCents: number): number {
  if (targetCents <= 0) return 0;
  const pct = Math.floor((savedCents / targetCents) * 100);
  if (pct < 0) return 0;
  return pct > 100 ? 100 : pct;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000;
}

/**
 * 到期日文案：「12月31日到期」/「今天到期」/「已过期 3 天」/「已过期」。
 * dueAt <= 0 表示没设，返回空串，调用方据此不渲染。
 */
export function goalDueLabel(dueAt: number, now: Date = new Date()): string {
  if (dueAt <= 0) return '';
  const dueDay = startOfLocalDay(new Date(dueAt * 1000));
  const today = startOfLocalDay(now);
  const diffDays = Math.round((dueDay - today) / DAY_SECONDS);
  if (diffDays === 0) return '今天到期';
  if (diffDays > 0) {
    const d = new Date(dueAt * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日到期`;
  }
  const overdue = -diffDays;
  return overdue === 1 ? '已过期 1 天' : `已过期 ${overdue} 天`;
}
