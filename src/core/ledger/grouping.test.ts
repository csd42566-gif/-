import { groupByDay, summarizeDayItems } from './grouping';
import type { GroupableTransaction } from './grouping';

type Row = GroupableTransaction & { currency: string };

const row = (
  id: number,
  occurredAt: number,
  kind: GroupableTransaction['kind'],
  amountCents: number,
  currency = 'CNY',
): Row => ({
  id,
  kind,
  amountCents,
  occurredAt,
  currency,
});

describe('groupByDay', () => {
  it('按天分组，今天在前，组内新交易在前', () => {
    const t1 = Date.UTC(2026, 10, 16, 4, 0, 0) / 1000; // 12:00 +08
    const t2 = Date.UTC(2026, 10, 16, 1, 0, 0) / 1000; // 09:00 +08
    const t3 = Date.UTC(2026, 10, 15, 10, 0, 0) / 1000;
    const groups = groupByDay([row(1, t1, 'expense', 500), row(2, t3, 'expense', 8600), row(3, t2, 'income', 10000)]);
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-11-16', '2026-11-15']);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 3]);
    expect(groups[1].items.map((i) => i.id)).toEqual([2]);
  });
});

describe('summarizeDayItems', () => {
  it('单币种：支出带负号、收入带正号', () => {
    const t = Date.UTC(2026, 10, 16, 4, 0, 0) / 1000;
    const s = summarizeDayItems([row(1, t, 'expense', 8600), row(2, t, 'income', 10000)]);
    expect(s.expenseLines).toEqual(['-¥86.00']);
    expect(s.incomeLines).toEqual(['¥100.00']);
  });

  it('多币种分列：各自汇总且按币种代码排序（CNY < JPY < USD）', () => {
    const t = Date.UTC(2026, 10, 16, 4, 0, 0) / 1000;
    const s = summarizeDayItems([
      row(1, t, 'expense', 8600, 'CNY'),
      row(2, t, 'expense', 2000, 'USD'),
      row(3, t, 'expense', 1234, 'JPY'),
    ]);
    expect(s.expenseLines).toEqual(['-¥86.00', '-¥1,234', '-$20.00']);
    expect(s.incomeLines).toEqual([]);
  });

  it('转账腿不计入任何汇总', () => {
    const t = Date.UTC(2026, 10, 16, 4, 0, 0) / 1000;
    const s = summarizeDayItems([
      row(1, t, 'transfer', -20000),
      row(2, t, 'transfer', 20000),
      row(3, t, 'expense', 300),
    ]);
    expect(s.expenseLines).toEqual(['-¥3.00']);
    expect(s.incomeLines).toEqual([]);
  });
});
