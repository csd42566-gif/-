import {
  filterTransactions,
  type FilterableTransaction,
} from './filter';
import { dayKeyOf } from './grouping';

const tx = (
  id: number,
  note: string,
  amountCents: number,
  kind: FilterableTransaction['kind'],
  accountId: number,
  categoryId: number | null,
  occurredAt: number,
  currency = 'CNY',
): FilterableTransaction => ({
  id,
  kind,
  amountCents,
  accountId,
  categoryId,
  currency,
  note,
  occurredAt,
});

const day = (s: string) => new Date(`${s}T00:00:00`).getTime() / 1000;

const SAMPLE = [
  tx(1, '午饭 沙县', -1600, 'expense', 1, 3, day('2026-11-10')),
  tx(2, '打车回家', -2300, 'expense', 2, 4, day('2026-11-11')),
  tx(3, '工资', 800000, 'income', 3, null, day('2026-11-01')),
  tx(4, '转出', -100000, 'transfer', 3, null, day('2026-11-05')),
  tx(5, '转入', 100000, 'transfer', 1, null, day('2026-11-05')),
  tx(6, '午餐', -2000, 'expense', 1, 3, day('2026-11-12')),
];

describe('filterTransactions', () => {
  it('空条件返回原数组（同一引用）', () => {
    const result = filterTransactions(SAMPLE, {});
    expect(result).toBe(SAMPLE);
  });

  it('query 大小写不敏感模糊匹配', () => {
    const result = filterTransactions(SAMPLE, { query: ' 午 ' });
    expect(result.map((t) => t.id)).toEqual([1, 6]);
  });

  it('kinds 过滤（含 transfer）', () => {
    expect(filterTransactions(SAMPLE, { kinds: ['transfer'] }).map((t) => t.id)).toEqual([4, 5]);
    expect(filterTransactions(SAMPLE, { kinds: ['income', 'expense'] }).map((t) => t.id)).toEqual([
      1, 2, 3, 6,
    ]);
  });

  it('accountIds 过滤', () => {
    expect(filterTransactions(SAMPLE, { accountIds: [3] }).map((t) => t.id)).toEqual([3, 4]);
  });

  it('categoryIds 过滤，null 分类不命中', () => {
    expect(filterTransactions(SAMPLE, { categoryIds: [3] }).map((t) => t.id)).toEqual([1, 6]);
  });

  it('金额区间按绝对值（转移与普通一致）', () => {
    expect(filterTransactions(SAMPLE, { minCents: 2000, maxCents: 2500 }).map((t) => t.id)).toEqual([
      2, 6,
    ]);
  });

  it('日期区间含两端', () => {
    expect(filterTransactions(SAMPLE, { fromDay: '2026-11-05', toDay: '2026-11-11' }).map((t) => t.id)).toEqual([1, 2, 4, 5]);
    expect(filterTransactions(SAMPLE, { fromDay: '2026-11-12' }).map((t) => t.id)).toEqual([6]);
    expect(filterTransactions(SAMPLE, { toDay: '2026-11-01' }).map((t) => t.id)).toEqual([3]);
  });

  it('组合条件', () => {
    const result = filterTransactions(SAMPLE, { query: '午', kinds: ['expense'], categoryIds: [3] });
    expect(result.map((t) => t.id)).toEqual([1, 6]);
  });
});

describe('dayKeyOf', () => {
  it('本地时区转 YYYY-MM-DD', () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 8, 30).getTime() / 1000)).toBe('2026-01-05');
    expect(dayKeyOf(new Date(2026, 11, 31, 23, 59).getTime() / 1000)).toBe('2026-12-31');
  });
});
