import { createInitialLedgerState } from '../../data/initialState';
import { WorkProfile } from '../../core/model/finance';
import { calculateEarnings } from '../../core/work/attendance';
import { clockInAttendance, clockOutAttendance, findPendingAttendanceRecord, markAttendanceRest, undoAttendanceRest } from './attendance';

const testWorkProfile: WorkProfile = {
  monthlyIncome: 5000,
  restDaysPerMonth: 4,
  workHoursPerDay: 8,
  payday: 15,
  cycleStartDay: 10,
  allowances: [],
};

function stateWithSalary() {
  const state = createInitialLedgerState();
  return { ...state, settings: { ...state.settings, work: testWorkProfile } };
}

test('同一天重复上班打卡只更新原记录', () => {
  const firstTime = new Date(2026, 9, 18, 9, 2);
  const secondTime = new Date(2026, 9, 18, 9, 15);
  const first = clockInAttendance(createInitialLedgerState(), firstTime);
  const second = clockInAttendance(first, secondTime);

  expect(second.attendance).toHaveLength(1);
  expect(second.attendance?.[0]).toMatchObject({
    date: '2026-10-18',
    clockIn: secondTime.toISOString(),
    status: 'worked',
  });
  expect(second.attendance?.[0].clockOut).toBeUndefined();
});

test('标记休息不计钱，撤销后可重新打卡并恢复日薪', () => {
  const state = stateWithSalary();
  const workTime = new Date(2026, 9, 18, 9, 0);
  const restState = markAttendanceRest(state, workTime);
  const restEarnings = calculateEarnings(restState.settings.work, restState.attendance ?? [], workTime);

  expect(restState.attendance?.[0]).toMatchObject({ date: '2026-10-18', status: 'rest' });
  expect(restEarnings.cycleEarned).toBe(0);

  const restored = undoAttendanceRest(restState, workTime);
  expect(restored.attendance).toEqual([]);

  const completed = clockOutAttendance(clockInAttendance(restored, workTime), new Date(2026, 9, 18, 18, 0));
  const completedEarnings = calculateEarnings(completed.settings.work, completed.attendance ?? [], workTime);
  expect(completedEarnings.cycleEarned).toBe(185.19);
});

test('22:00 上班后次日 02:00 下班仍归属前一天且只算一天', () => {
  const clockInTime = new Date(2026, 9, 18, 22, 0);
  const clockOutTime = new Date(2026, 9, 19, 2, 0);
  const clockedIn = clockInAttendance(stateWithSalary(), clockInTime);
  const completed = clockOutAttendance(clockedIn, clockOutTime);

  expect(completed.attendance).toHaveLength(1);
  expect(completed.attendance?.[0]).toMatchObject({
    date: '2026-10-18',
    clockIn: clockInTime.toISOString(),
    clockOut: clockOutTime.toISOString(),
    status: 'worked',
  });

  const earnings = calculateEarnings(completed.settings.work, completed.attendance ?? [], clockOutTime);
  expect(earnings.workedDays).toBe(1);
  expect(earnings.cycleEarned).toBe(185.19);
});

test('凌晨没有可确认的上班卡时提示先打上班卡', () => {
  expect(() => clockOutAttendance(createInitialLedgerState(), new Date(2026, 9, 19, 2, 0)))
    .toThrow('attendance-clock-in-required');
});

test('白天的历史未完成班次仍会被横幅识别并可选最近一条', () => {
  const attendance = [
    { date: '2026-10-16', clockIn: new Date(2026, 9, 16, 22).toISOString(), status: 'worked' as const },
    { date: '2026-10-17', clockIn: new Date(2026, 9, 17, 22).toISOString(), status: 'worked' as const },
  ];

  const pending = findPendingAttendanceRecord(attendance, new Date(2026, 9, 18, 12));

  expect(pending?.date).toBe('2026-10-17');
});
