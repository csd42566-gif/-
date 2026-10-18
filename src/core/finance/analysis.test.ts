import { DerivedFinancials } from './derive';
import { calculateEarnings } from '../work/attendance';
import { createInitialLedgerState } from '../../data/initialState';
import { defaultWorkProfile, LedgerState } from '../model/finance';
import { analyze } from './analysis';

const earnings = calculateEarnings(defaultWorkProfile, [], new Date(2026, 9, 18, 12));

function financials(overrides: Partial<DerivedFinancials> = {}): DerivedFinancials {
  return {
    availableBalance: 5000,
    monthSpent: 0,
    monthIncome: 5000,
    todaySpendable: 100,
    goalProgress: 0,
    goalRemaining: 0,
    goalSaved: 0,
    goalShortfallFromStart: 0,
    monthDue: 0,
    overdueDue: 0,
    goalDailySave: 0,
    goalRemainingDays: 0,
    goalReserve: 0,
    essentialReserve: 0,
    projectedNet: 1000,
    shortfall: 0,
    extraWorkHours: 0,
    hourlyIncome: 20,
    remainingDays: 10,
    ...overrides,
  };
}

function state(overrides: Partial<LedgerState> = {}): LedgerState {
  return { ...createInitialLedgerState(), ...overrides };
}

test('danger：预计透支时结论先行并给出工时与每日削减金额', () => {
  const result = analyze(state({ transactions: [{ id: 'x', type: 'expense', amount: 100, accountId: 'cash', occurredAt: '2026-10-18T10:00:00+08:00', source: 'manual' }] }), earnings, financials({ shortfall: 100, extraWorkHours: 5, hourlyIncome: 20 }));
  expect(result[0]).toMatchObject({ level: 'danger', headline: '本月预计透支', action: '调整目标或减少弹性消费' });
  expect(result[0].detail).toContain('¥100.00');
  expect(result[0].detail).toContain('5.0 小时');
  expect(result[0].detail).toContain('每天少花 ¥10.00');
});

test('warn：本月支出达到预算75%且未到月底', () => {
  const result = analyze(state({ transactions: [{ id: 'x', type: 'expense', amount: 8000, accountId: 'cash', occurredAt: '2026-10-18T10:00:00+08:00', source: 'manual' }] }), earnings, financials({ monthSpent: 8000, projectedNet: 2000, remainingDays: 10 }));
  expect(result[0]).toMatchObject({ level: 'warn', headline: '照这个速度，月底会超支', action: '今天可花额度 ¥100.00' });
  expect(result[0].detail).toBe('已花 ¥8000.00 / 预算 ¥10000.00，还剩 10 天');
});

test('warn：今天已花超过今日可花预算的75%', () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const result = analyze(state({ transactions: [{ id: 'today', type: 'expense', amount: 80, accountId: 'cash', occurredAt: today.toISOString(), source: 'manual' }] }), earnings, financials({ monthSpent: 80, todaySpendable: 20 }));
  expect(result[0]).toMatchObject({ level: 'warn', headline: '今天已经花掉大半了' });
  expect(result[0].detail).toBe('已花 ¥80.00，还剩 ¥20.00');
  expect(result[0].action).toBeUndefined();
});

test('info：有记录时展示目标缺口', () => {
  const goalState = state({
    transactions: [{ id: 'old', type: 'expense', amount: 10, accountId: 'cash', occurredAt: '2026-01-01T10:00:00+08:00', source: 'manual' }],
    goal: { id: 'g', name: '应急金', targetAmount: 1000, startBalance: 0, startBalanceAt: '2026-01-01T00:00:00+08:00', deadline: '2026-12-31' },
  });
  const result = analyze(goalState, earnings, financials({ goalRemaining: 500, goalRemainingDays: 50, goalDailySave: 10 }));
  expect(result[0]).toMatchObject({ level: 'info', headline: '储蓄目标尚未达成', action: '查看目标 ›' });
  expect(result[0].detail).toContain('应急金');
  expect(result[0].detail).toContain('¥500.00');
});

test('没有打卡和流水时只显示健康结论', () => {
  const result = analyze(state(), earnings, financials({ shortfall: 100, monthSpent: 9000, projectedNet: 1000 }));
  expect(result).toEqual([{ level: 'info', headline: '当前节奏健康', detail: expect.stringContaining('本周期已赚') }]);
});

test('命中多条时最多返回三条并保持优先级', () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const result = analyze(state({ transactions: [{ id: 'today', type: 'expense', amount: 80, accountId: 'cash', occurredAt: today.toISOString(), source: 'manual' }], goal: { id: 'g', name: '应急金', targetAmount: 1000, startBalance: 0, startBalanceAt: '2026-01-01T00:00:00+08:00', deadline: '2026-12-31' } }), earnings, financials({ shortfall: 100, extraWorkHours: 5, monthSpent: 8000, projectedNet: 2000, remainingDays: 10, todaySpendable: 20, goalRemaining: 500, goalRemainingDays: 50, goalDailySave: 10 }));
  expect(result).toHaveLength(3);
  expect(result.map((item) => item.level)).toEqual(['danger', 'warn', 'warn']);
});