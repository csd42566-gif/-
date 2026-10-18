import { EarningsResult } from '../../core/work/attendance';
import { DerivedFinancials } from '../../core/finance/derive';
import { estimateWorkCost, evaluateTransaction } from './punishment';

const earnings: EarningsResult = {
  cycleStart: '2026-10-10',
  cycleEnd: '2026-11-09',
  cycleDays: 31,
  phase: 'probation',
  isProbation: true,
  monthlySalary: 5000,
  expectedWorkDays: 27,
  dailySalary: 185.19,
  hourlySalary: 23.15,
  workedDays: 10,
  restDays: 2,
  cycleEarned: 1851.9,
  fullAttendance: true,
  allowanceTotal: 0,
  fullAttendanceBonus: 0,
  cycleExpected: 5000,
  cycleTotal: 1851.9,
  payday: '2026-11-15',
};

function financials(overrides: Partial<DerivedFinancials>): DerivedFinancials {
  return {
    availableBalance: 1000,
    monthSpent: 0,
    monthIncome: 0,
    todaySpendable: 200,
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
    hourlyIncome: 23.15,
    remainingDays: 20,
    ...overrides,
  };
}

test('severe：月支出加上本笔达到收入阈值', () => {
  const result = evaluateTransaction({
    draft: { amount: 80, type: 'expense', budgetGroup: 'essential' },
    earnings,
    financials: financials({ monthSpent: 4950, monthIncome: 5000, todaySpendable: 500 }),
  });

  expect(result).toMatchObject({
    level: 'severe',
    title: '极罚',
    detail: '这笔 ¥80 等于白干 3.5 小时。本月支出已经超过预计到手。',
    hoursOfWork: 3.46,
  });
});

test('punish：弹性消费达到日薪四分之一', () => {
  const amount = earnings.dailySalary * 0.25;
  const result = evaluateTransaction({
    draft: { amount, type: 'expense', budgetGroup: 'flexible' },
    earnings,
    financials: financials({ monthIncome: 10000, todaySpendable: 100 }),
  });

  expect(result.level).toBe('punish');
  expect(result.title).toBe('重罚');
  expect(result.detail).toBe('弹性消费 ¥46.30，折合 2.0 小时工资。');
});

test('warn：记账后今日可花归零或透支', () => {
  const result = evaluateTransaction({
    draft: { amount: 20, type: 'expense', budgetGroup: 'essential' },
    earnings,
    financials: financials({ monthIncome: 10000, todaySpendable: 20 }),
  });

  expect(result).toMatchObject({
    level: 'warn',
    title: '警告',
    detail: '今天额度用尽，这笔让今天变成透支。',
    hoursOfWork: 0.86,
  });
});

test('none：未命中任何阈值', () => {
  const result = evaluateTransaction({
    draft: { amount: 10, type: 'expense', budgetGroup: 'flexible' },
    earnings,
    financials: financials({ monthIncome: 10000, todaySpendable: 200 }),
  });

  expect(result).toEqual({ level: 'none', title: '', detail: '', hoursOfWork: 0.43 });
});

test('severe 优先于 punish，即使这笔同时满足弹性消费阈值', () => {
  const result = evaluateTransaction({
    draft: { amount: 100, type: 'expense', budgetGroup: 'flexible' },
    earnings,
    financials: financials({ monthIncome: 10000, todaySpendable: 50 }),
  });

  expect(result.level).toBe('severe');
});

test('punish 优先于 warn', () => {
  const amount = earnings.dailySalary * 0.25;
  const result = evaluateTransaction({
    draft: { amount, type: 'expense', budgetGroup: 'flexible' },
    earnings,
    financials: financials({ monthIncome: 10000, todaySpendable: amount }),
  });

  expect(result.level).toBe('punish');
});

test('工作时长估算集中在一个可替换函数', () => {
  expect(estimateWorkCost(80, 23.15)).toBeCloseTo(3.4557, 4);
  expect(estimateWorkCost(80, 0)).toBe(0);
});
