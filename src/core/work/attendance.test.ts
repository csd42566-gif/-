import { AttendanceRecord, defaultWorkProfile, WorkProfile } from '../model/finance';
import { calculateEarnings } from './attendance';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function cycleAttendance(year: number, monthIndex: number, cycleStartDay: number, days: number, worked: number, rest: number): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(year, monthIndex, cycleStartDay + index, 12);
    if (index < worked) {
      records.push({
        date: dateKey(date),
        clockIn: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0, 0).toISOString(),
        clockOut: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 2, 0, 0).toISOString(),
        status: 'worked',
      });
    } else if (index < worked + rest) {
      records.push({ date: dateKey(date), status: 'rest' });
    }
  }
  return records;
}

test('周期1为试用期：31天、应出勤27天、日薪185.19、满勤5000', () => {
  const result = calculateEarnings(defaultWorkProfile, cycleAttendance(2026, 9, 10, 31, 27, 4), new Date(2026, 9, 18, 12));

  expect(result).toMatchObject({
    cycleStart: '2026-10-10', cycleEnd: '2026-11-09', cycleDays: 31,
    phase: 'probation', isProbation: true, expectedWorkDays: 27, dailySalary: 185.19,
    workedDays: 27, restDays: 4, cycleEarned: 5000, fullAttendance: true,
    allowanceTotal: 0, fullAttendanceBonus: 0, cycleExpected: 5000, cycleTotal: 5000,
    payday: '2026-11-15',
  });
});

test('周期2为转正：30天、应出勤26天、日薪192.31、满勤到手5700', () => {
  const result = calculateEarnings(defaultWorkProfile, cycleAttendance(2026, 10, 10, 30, 26, 4), new Date(2026, 10, 18, 12));

  expect(result).toMatchObject({
    cycleStart: '2026-11-10', cycleEnd: '2026-12-09', cycleDays: 30,
    phase: 'regular', isProbation: false, monthlySalary: 5000, expectedWorkDays: 26, dailySalary: 192.31,
    workedDays: 26, restDays: 4, cycleEarned: 5000, fullAttendance: true,
    allowanceTotal: 500, fullAttendanceBonus: 200, cycleExpected: 5700, cycleTotal: 5700,
    payday: '2026-12-15',
  });
});

test('周期3为转正：31天、应出勤27天、日薪185.19、满勤到手5700', () => {
  const result = calculateEarnings(defaultWorkProfile, cycleAttendance(2026, 11, 10, 31, 27, 4), new Date(2026, 11, 18, 12));

  expect(result).toMatchObject({
    cycleStart: '2026-12-10', cycleEnd: '2027-01-09', cycleDays: 31,
    phase: 'regular', isProbation: false, monthlySalary: 5000, expectedWorkDays: 27, dailySalary: 185.19,
    workedDays: 27, restDays: 4, cycleEarned: 5000, fullAttendance: true,
    allowanceTotal: 500, fullAttendanceBonus: 200, cycleExpected: 5700, cycleTotal: 5700,
    payday: '2027-01-15',
  });
});

test('18:00 上班、次日 02:00 下班按上班当天归属并算一天', () => {
  const record: AttendanceRecord = {
    date: '2026-10-19',
    clockIn: new Date(2026, 9, 18, 18, 0, 0).toISOString(),
    clockOut: new Date(2026, 9, 19, 2, 0, 0).toISOString(),
    status: 'worked',
  };
  const result = calculateEarnings(defaultWorkProfile, [record], new Date(2026, 9, 18, 12));

  expect(result.workedDays).toBe(1);
  expect(result.cycleEarned).toBe(185.19);
});

test('只有上班卡没有下班卡不算钱', () => {
  const result = calculateEarnings(defaultWorkProfile, [{ date: '2026-10-18', clockIn: new Date(2026, 9, 18, 18).toISOString(), status: 'worked' }], new Date(2026, 9, 18, 12));

  expect(result.workedDays).toBe(0);
  expect(result.cycleEarned).toBe(0);
});

test('休息5天不达成全勤，也不发全勤奖', () => {
  const attendance = cycleAttendance(2026, 10, 10, 30, 21, 5);
  const result = calculateEarnings(defaultWorkProfile, attendance, new Date(2026, 10, 18, 12));

  expect(result.restDays).toBe(5);
  expect(result.fullAttendance).toBe(false);
  expect(result.fullAttendanceBonus).toBe(0);
});

test('休息日标记为 worked 仍算一天日薪', () => {
  const result = calculateEarnings(defaultWorkProfile, [{
    date: '2026-10-18',
    clockIn: new Date(2026, 9, 18, 18).toISOString(),
    clockOut: new Date(2026, 9, 19, 2).toISOString(),
    status: 'worked',
  }], new Date(2026, 9, 18, 12));

  expect(result.workedDays).toBe(1);
  expect(result.cycleEarned).toBe(185.19);
});

test('试用期不发放 regular 补贴和全勤奖', () => {
  const profile: WorkProfile = {
    ...defaultWorkProfile,
    allowances: [
      { name: '转正补贴', amount: 500, mode: 'fixed', phase: 'regular' },
      { name: '试用补贴', amount: 100, mode: 'fixed', phase: 'probation' },
      { name: '全阶段补贴', amount: 50, mode: 'fixed', phase: 'both' },
    ],
    fullAttendanceBonus: 200,
  };
  const result = calculateEarnings(profile, cycleAttendance(2026, 9, 10, 31, 27, 4), new Date(2026, 9, 18, 12));

  expect(result.isProbation).toBe(true);
  expect(result.allowanceTotal).toBe(150);
  expect(result.fullAttendanceBonus).toBe(0);
  expect(result.cycleExpected).toBe(5150);
});

test('per-day 与 fixed 补贴都只按生效阶段计算', () => {
  const profile: WorkProfile = {
    ...defaultWorkProfile,
    monthlyIncome: 5000,
    fullAttendanceBonus: 200,
    allowances: [
      { name: '餐补', amount: 500, mode: 'fixed', phase: 'regular' },
      { name: '交通补', amount: 10, mode: 'per-day', phase: 'regular' },
    ],
  };
  const result = calculateEarnings(profile, cycleAttendance(2026, 10, 10, 30, 26, 4), new Date(2026, 10, 18, 12));

  expect(result.allowanceTotal).toBe(760);
  expect(result.cycleExpected).toBe(5960);
  expect(result.cycleTotal).toBe(5960);
});
