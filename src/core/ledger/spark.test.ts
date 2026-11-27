import { dailyExpenseSeries, lastNDayKeys, peakDailyCents } from './spark';
import type { SparkSourceRow } from './spark';

function at(year: number, month: number, day: number, hour = 12): number {
  return Math.floor(new Date(year, month - 1, day, hour, 0, 0).getTime() / 1000);
}

const NOW = new Date(2026, 10, 17, 15, 30); // 2026-11-17 15:30 本地

function row(partial: Partial<SparkSourceRow>): SparkSourceRow {
  return {
    kind: 'expense',
    amountCents: 0,
    occurredAt: at(2026, 11, 17),
    currency: 'CNY',
    ...partial,
  };
}

describe('lastNDayKeys', () => {
  it('返回 N 个键，最旧在前、今天在最后', () => {
    const keys = lastNDayKeys(3, NOW);
    expect(keys).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
  });

  it('跨月边界正确回退', () => {
    const keys = lastNDayKeys(2, new Date(2026, 11, 1, 0, 10));
    expect(keys).toEqual(['2026-11-30', '2026-12-01']);
  });
});

describe('dailyExpenseSeries', () => {
  it('按天累加支出，缺数据的天补 0', () => {
    const points = dailyExpenseSeries(
      [
        row({ amountCents: 1900, occurredAt: at(2026, 11, 17, 9) }),
        row({ amountCents: 2800, occurredAt: at(2026, 11, 17, 13) }),
        row({ amountCents: 3550, occurredAt: at(2026, 11, 16, 12) }),
      ],
      3,
      NOW,
      'CNY',
    );
    expect(points).toEqual([
      { dayKey: '2026-11-15', cents: 0 },
      { dayKey: '2026-11-16', cents: 3550 },
      { dayKey: '2026-11-17', cents: 4700 },
    ]);
  });

  it('收入与转账不进曲线', () => {
    const points = dailyExpenseSeries(
      [
        row({ kind: 'income', amountCents: 850000, occurredAt: at(2026, 11, 17, 8) }),
        row({ kind: 'transfer', amountCents: -50000, occurredAt: at(2026, 11, 17, 9) }),
        row({ kind: 'expense', amountCents: 1200, occurredAt: at(2026, 11, 17, 10) }),
      ],
      2,
      NOW,
      'CNY',
    );
    expect(points[1]).toEqual({ dayKey: '2026-11-17', cents: 1200 });
  });

  it('只统计指定币种', () => {
    const points = dailyExpenseSeries(
      [
        row({ amountCents: 1000, occurredAt: at(2026, 11, 17), currency: 'CNY' }),
        row({ amountCents: 999, occurredAt: at(2026, 11, 17), currency: 'USD' }),
      ],
      1,
      NOW,
      'CNY',
    );
    expect(points).toEqual([{ dayKey: '2026-11-17', cents: 1000 }]);
  });

  it('窗口外的旧账不计入', () => {
    const points = dailyExpenseSeries(
      [row({ amountCents: 500, occurredAt: at(2026, 10, 1) })],
      2,
      NOW,
      'CNY',
    );
    expect(points).toEqual([
      { dayKey: '2026-11-16', cents: 0 },
      { dayKey: '2026-11-17', cents: 0 },
    ]);
  });
});

describe('peakDailyCents', () => {
  it('取最大值，全 0 返回 0', () => {
    expect(
      peakDailyCents([
        { dayKey: '2026-11-15', cents: 0 },
        { dayKey: '2026-11-16', cents: 24800 },
        { dayKey: '2026-11-17', cents: 4700 },
      ]),
    ).toBe(24800);
    expect(peakDailyCents([{ dayKey: '2026-11-17', cents: 0 }])).toBe(0);
  });
});
