import {
  buildInsightNotes,
  categorySlices,
  dayKeyLabel,
  daysInMonth,
  monthExpenseSummary,
  monthKeyOf,
  monthRange,
  monthTotals,
  rangeCategorySlices,
  rangeExpenseSummary,
  rangeTotals,
  rangeWindow,
} from './insight';
import type { InsightRow } from './insight';

function at(year: number, month: number, day: number, hour = 12): number {
  return Math.floor(new Date(year, month - 1, day, hour, 0, 0).getTime() / 1000);
}

/** 2026-11-17 15:30 本地时间：固定「今天」，让日均天数可预测。 */
const NOW = new Date(2026, 10, 17, 15, 30);
const ANCHOR = new Date(2026, 10, 17);

function row(partial: Partial<InsightRow>): InsightRow {
  return {
    kind: 'expense',
    amountCents: 0,
    occurredAt: at(2026, 11, 17),
    currency: 'CNY',
    categoryId: 1,
    ...partial,
  };
}

describe('monthKeyOf / monthRange / daysInMonth', () => {
  it('月份键是 1–12', () => {
    expect(monthKeyOf(new Date(2026, 10, 17))).toEqual({ year: 2026, month: 11 });
    expect(monthKeyOf(new Date(2026, 0, 1))).toEqual({ year: 2026, month: 1 });
  });

  it('月区间左闭右开，跨年正确', () => {
    expect(monthRange(new Date(2026, 10, 17))).toEqual({
      start: at(2026, 11, 1, 0),
      end: at(2026, 12, 1, 0),
    });
    expect(monthRange(new Date(2026, 11, 5))).toEqual({
      start: at(2026, 12, 1, 0),
      end: at(2027, 1, 1, 0),
    });
  });

  it('月份天数含闰年二月', () => {
    expect(daysInMonth(new Date(2026, 1, 10))).toBe(28);
    expect(daysInMonth(new Date(2028, 1, 10))).toBe(29);
    expect(daysInMonth(new Date(2026, 10, 1))).toBe(30);
  });
});

describe('monthExpenseSummary', () => {
  it('统计本月同币种支出，日均按已过天数算', () => {
    const s = monthExpenseSummary(
      [
        row({ amountCents: 15800, occurredAt: at(2026, 11, 14) }),
        row({ amountCents: 4200, occurredAt: at(2026, 11, 15) }),
        row({ amountCents: 10, occurredAt: at(2026, 11, 17), currency: 'USD' }),
        row({ amountCents: 99, occurredAt: at(2026, 11, 1), kind: 'income' }),
        row({ amountCents: 500, occurredAt: at(2026, 10, 31) }),
      ],
      ANCHOR,
      'CNY',
      NOW,
    );
    expect(s.totalCents).toBe(20000);
    expect(s.count).toBe(2);
    expect(s.elapsedDays).toBe(17);
    expect(s.avgPerDayCents).toBe(Math.round(20000 / 17));
    expect(s.peakDayKey).toBe('2026-11-14');
    expect(s.peakDayCents).toBe(15800);
  });

  it('历史月份按整月天数算日均', () => {
    const s = monthExpenseSummary(
      [row({ amountCents: 3000, occurredAt: at(2026, 10, 5) })],
      new Date(2026, 9, 20),
      'CNY',
      NOW,
    );
    expect(s.elapsedDays).toBe(31);
    expect(s.avgPerDayCents).toBe(Math.round(3000 / 31));
  });

  it('没有支出时峰值为 null / 0', () => {
    const s = monthExpenseSummary([], ANCHOR, 'CNY', NOW);
    expect(s).toMatchObject({
      totalCents: 0,
      count: 0,
      peakDayKey: null,
      peakDayCents: 0,
    });
  });

  it('转账两腿不计入', () => {
    const s = monthExpenseSummary(
      [
        row({ kind: 'transfer', amountCents: -50000 }),
        row({ kind: 'transfer', amountCents: 50000 }),
      ],
      ANCHOR,
      'CNY',
      NOW,
    );
    expect(s.totalCents).toBe(0);
  });
});

describe('categorySlices', () => {
  it('按金额降序，百分比四舍五入到整数', () => {
    const slices = categorySlices(
      [
        row({ categoryId: 1, amountCents: 6200 }),
        row({ categoryId: 2, amountCents: 2600 }),
        row({ categoryId: 3, amountCents: 1200 }),
      ],
      ANCHOR,
      'CNY',
    );
    expect(slices).toEqual([
      { categoryId: 1, cents: 6200, percent: 62 },
      { categoryId: 2, cents: 2600, percent: 26 },
      { categoryId: 3, cents: 1200, percent: 12 },
    ]);
  });

  it('跳过未分类与非本币种', () => {
    const slices = categorySlices(
      [
        row({ categoryId: null, amountCents: 5000 }),
        row({ categoryId: 1, amountCents: 1000 }),
        row({ categoryId: 2, amountCents: 9000, currency: 'USD' }),
      ],
      ANCHOR,
      'CNY',
    );
    expect(slices).toEqual([{ categoryId: 1, cents: 1000, percent: 100 }]);
  });
});

describe('monthTotals', () => {
  it('本月与上月各一条，最新在前', () => {
    const totals = monthTotals(
      [
        row({ amountCents: 36850, occurredAt: at(2026, 11, 14) }),
        row({ amountCents: 41880, occurredAt: at(2026, 10, 20) }),
      ],
      ANCHOR,
      'CNY',
    );
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({ shortLabel: '11月', cents: 36850 });
    expect(totals[1]).toMatchObject({ shortLabel: '10月', cents: 41880 });
  });

  it('跨年回退到去年 12 月', () => {
    const totals = monthTotals(
      [row({ amountCents: 1234, occurredAt: at(2025, 12, 31) })],
      new Date(2026, 0, 10),
      'CNY',
    );
    expect(totals[1]).toMatchObject({ label: '2025年12月', cents: 1234 });
  });
});

describe('dayKeyLabel', () => {
  it('YYYY-MM-DD 转 M月D日，去前导零', () => {
    expect(dayKeyLabel('2026-11-04')).toBe('11月4日');
    expect(dayKeyLabel('2026-01-31')).toBe('1月31日');
  });

  it('异常输入原样返回', () => {
    expect(dayKeyLabel('bad')).toBe('bad');
  });
});

describe('buildInsightNotes', () => {
  const nameOf = (id: number) => (id === 1 ? '吃饭' : id === 2 ? '购物' : '交通');

  it('生成最多三条，每条带具体数字', () => {
    const rows = [
      row({ categoryId: 1, amountCents: 22850, occurredAt: at(2026, 11, 14) }),
      row({ categoryId: 2, amountCents: 9600, occurredAt: at(2026, 11, 10) }),
      row({ categoryId: 3, amountCents: 4400, occurredAt: at(2026, 11, 5) }),
      row({ categoryId: 1, amountCents: 500, occurredAt: at(2026, 10, 20) }),
    ];
    const summary = monthExpenseSummary(rows, ANCHOR, 'CNY', NOW);
    const slices = categorySlices(rows, ANCHOR, 'CNY');
    const notes = buildInsightNotes({
      summary,
      slices,
      categoryName: nameOf,
      currency: 'CNY',
      budgetCents: 300000,
      prevMonthCents: 50000,
    });
    expect(notes).toHaveLength(3);
    expect(notes[0].title).toBe('吃饭占最多');
    expect(notes[0].body).toContain('¥228.50');
    expect(notes[0].body).toContain('62%');
    expect(notes[1].title).toBe('11月14日 花得最多');
    expect(notes[2].key).toBe('budget');
    expect(notes.every((n) => n.body.length > 0)).toBe(true);
  });

  it('没设预算时用环比补位', () => {
    const rows = [row({ categoryId: 1, amountCents: 1000 })];
    const notes = buildInsightNotes({
      summary: monthExpenseSummary(rows, ANCHOR, 'CNY', NOW),
      slices: categorySlices(rows, ANCHOR, 'CNY'),
      categoryName: nameOf,
      currency: 'CNY',
      budgetCents: 0,
      prevMonthCents: 500,
    });
    expect(notes.map((n) => n.key)).toContain('mom');
  });

  it('本月无支出时返回空数组', () => {
    const notes = buildInsightNotes({
      summary: monthExpenseSummary([], ANCHOR, 'CNY', NOW),
      slices: [],
      categoryName: nameOf,
      currency: 'CNY',
      budgetCents: 300000,
      prevMonthCents: 0,
    });
    expect(notes).toEqual([]);
  });

  it('占比不足 30% 时不吹「占最多」', () => {
    const rows = [
      row({ categoryId: 1, amountCents: 300 }),
      row({ categoryId: 2, amountCents: 300 }),
      row({ categoryId: 3, amountCents: 300 }),
      row({ categoryId: 4, amountCents: 300 }),
    ];
    const notes = buildInsightNotes({
      summary: monthExpenseSummary(rows, ANCHOR, 'CNY', NOW),
      slices: categorySlices(rows, ANCHOR, 'CNY'),
      categoryName: nameOf,
      currency: 'CNY',
      budgetCents: 0,
      prevMonthCents: 0,
    });
    expect(notes.map((n) => n.key)).not.toContain('top-category');
  });

  it('periodLabel 会替换文案里的「本月」，不写死', () => {
    const rows = [row({ categoryId: 1, amountCents: 1000 })];
    const notes = buildInsightNotes({
      summary: monthExpenseSummary(rows, ANCHOR, 'CNY', NOW),
      slices: categorySlices(rows, ANCHOR, 'CNY'),
      categoryName: nameOf,
      currency: 'CNY',
      budgetCents: 0,
      prevMonthCents: 500,
      periodLabel: '近 7 天',
      prevPeriodLabel: '前 7 天',
    });
    const mom = notes.find((n) => n.key === 'mom');
    expect(mom?.title).toContain('前 7 天');
    expect(mom?.body).toContain('近 7 天');
    expect(mom?.body).not.toContain('这个月');
  });
});

describe('rangeWindow', () => {
  it('日窗口是今天 00:00 到明天 00:00，天数为 1', () => {
    const w = rangeWindow('day', NOW);
    expect(w.start).toBe(at(2026, 11, 17, 0));
    expect(w.end).toBe(at(2026, 11, 18, 0));
    expect(w.days).toBe(1);
    expect(w.label).toBe('本日支出');
  });

  it('周窗口是近 7 天含今天，不是周一到现在', () => {
    const w = rangeWindow('week', NOW);
    expect(w.start).toBe(at(2026, 11, 11, 0));
    expect(w.end).toBe(at(2026, 11, 18, 0));
    expect(w.days).toBe(7);
  });

  it('月窗口跟着月末走，跨年也对', () => {
    const w = rangeWindow('month', new Date(2026, 11, 5));
    expect(w.start).toBe(at(2026, 12, 1, 0));
    expect(w.end).toBe(at(2027, 1, 1, 0));
    expect(w.prevStart).toBe(at(2026, 11, 1, 0));
  });
});

describe('rangeExpenseSummary', () => {
  const rows = [
    row({ amountCents: 1000, occurredAt: at(2026, 11, 17) }), // 今天
    row({ amountCents: 2000, occurredAt: at(2026, 11, 16) }), // 昨天
    row({ amountCents: 4000, occurredAt: at(2026, 11, 10) }), // 7 天窗口外
    row({ amountCents: 8000, occurredAt: at(2026, 10, 20) }), // 上月
    row({ amountCents: 9999, occurredAt: at(2026, 11, 17), kind: 'income' }),
    row({ amountCents: 5555, occurredAt: at(2026, 11, 17), currency: 'USD' }),
  ];

  it('日：只算今天同币种支出', () => {
    const s = rangeExpenseSummary(rows, 'day', NOW, 'CNY');
    expect(s.totalCents).toBe(1000);
    expect(s.count).toBe(1);
    expect(s.elapsedDays).toBe(1);
    expect(s.avgPerDayCents).toBe(1000);
  });

  it('周：只算近 7 天，日均按 7 天算', () => {
    const s = rangeExpenseSummary(rows, 'week', NOW, 'CNY');
    expect(s.totalCents).toBe(3000);
    expect(s.count).toBe(2);
    expect(s.avgPerDayCents).toBe(Math.round(3000 / 7));
  });

  it('月：与 monthExpenseSummary 同口径', () => {
    const a = rangeExpenseSummary(rows, 'month', NOW, 'CNY');
    const b = monthExpenseSummary(rows, NOW, 'CNY', NOW);
    expect(a.totalCents).toBe(b.totalCents);
    expect(a.count).toBe(b.count);
    expect(a.avgPerDayCents).toBe(b.avgPerDayCents);
    expect(a.peakDayKey).toBe(b.peakDayKey);
  });
});

describe('rangeCategorySlices / rangeTotals', () => {
  const rows = [
    row({ categoryId: 1, amountCents: 3000, occurredAt: at(2026, 11, 17) }),
    row({ categoryId: 11, amountCents: 1000, occurredAt: at(2026, 11, 16) }),
    row({ categoryId: 2, amountCents: 6000, occurredAt: at(2026, 11, 10) }),
    row({ categoryId: 1, amountCents: 500, occurredAt: at(2026, 10, 20) }),
  ];
  const parentOf = new Map<number, number>([[11, 1]]);

  it('日窗口按分类汇总并把小类上卷', () => {
    const s = rangeCategorySlices(rows, 'day', NOW, 'CNY', parentOf);
    expect(s).toHaveLength(1);
    expect(s[0].categoryId).toBe(1);
    expect(s[0].cents).toBe(3000);
    expect(s[0].percent).toBe(100);
  });

  it('周窗口把「午饭」并进「吃饭」', () => {
    const s = rangeCategorySlices(rows, 'week', NOW, 'CNY', parentOf);
    const eat = s.find((x) => x.categoryId === 1);
    expect(eat?.cents).toBe(4000);
  });

  it('rangeTotals 给本期与上一期两行，标签随窗口变', () => {
    const w = rangeTotals(rows, 'week', NOW, 'CNY');
    expect(w).toHaveLength(2);
    // 本期 = 11/11–11/18：11/17 的 3000 + 11/16 的 1000
    expect(w[0].cents).toBe(4000);
    // 上一期 = 11/4–11/11：11/10 的 6000 正好落在里面
    expect(w[1].cents).toBe(6000);
    expect(w[1].label).toBe('前 7 天');
    const m = rangeTotals(rows, 'month', NOW, 'CNY');
    expect(m[0].label).toBe('本月');
    expect(m[1].label).toBe('上月');
    expect(m[1].cents).toBe(500);
  });
});
