import { Allowance, AttendanceRecord, WorkProfile } from '../model/finance';
import { formatLocalDateKey } from '../time/dateKey';
import { roundMoney } from '../finance/money';

export interface EarningsResult {
  cycleStart: string;
  cycleEnd: string;
  cycleDays: number;
  phase: 'probation' | 'regular';
  isProbation: boolean;
  monthlySalary: number;
  expectedWorkDays: number;
  dailySalary: number;
  hourlySalary: number;
  workedDays: number;
  restDays: number;
  cycleEarned: number;
  fullAttendance: boolean;
  allowanceTotal: number;
  fullAttendanceBonus: number;
  cycleExpected: number;
  cycleTotal: number;
  payday: string;
}

export function calculateEarnings(profile: WorkProfile, attendance: AttendanceRecord[], now = new Date()): EarningsResult {
  const cycle = resolveCycle(profile.cycleStartDay, now);
  const isProbation = !!profile.regularStartDate && cycle.startKey < profile.regularStartDate;
  const phase = isProbation ? 'probation' : 'regular';
  const monthlySalary = isProbation ? (profile.probationIncome ?? profile.monthlyIncome) : profile.monthlyIncome;
  const expectedWorkDays = Math.max(1, cycle.days - profile.restDaysPerMonth);
  const dailySalaryRaw = monthlySalary / expectedWorkDays;
  const records = cycleRecords(attendance, cycle.startKey, cycle.endKey);
  const workedDays = records.filter((record) => record.status === 'worked' && !!record.clockOut).length;
  const restDays = records.filter((record) => record.status === 'rest' || record.status === 'leave').length;
  const cycleEarned = roundMoney(dailySalaryRaw * workedDays);
  const fullAttendance = restDays <= profile.restDaysPerMonth;
  const actualAllowances = calculateAllowances(profile.allowances, phase, workedDays);
  const expectedAllowances = calculateAllowances(profile.allowances, phase, expectedWorkDays);
  const fullAttendanceBonus = !isProbation && fullAttendance ? (profile.fullAttendanceBonus ?? 0) : 0;
  const potentialFullAttendanceBonus = isProbation ? 0 : (profile.fullAttendanceBonus ?? 0);

  return {
    cycleStart: cycle.startKey,
    cycleEnd: cycle.endKey,
    cycleDays: cycle.days,
    phase,
    isProbation,
    monthlySalary: roundMoney(monthlySalary),
    expectedWorkDays,
    dailySalary: roundMoney(dailySalaryRaw),
    hourlySalary: roundMoney(dailySalaryRaw / Math.max(1, profile.workHoursPerDay)),
    workedDays,
    restDays,
    cycleEarned,
    fullAttendance,
    allowanceTotal: actualAllowances,
    fullAttendanceBonus,
    cycleExpected: roundMoney(monthlySalary + expectedAllowances + potentialFullAttendanceBonus),
    cycleTotal: roundMoney(cycleEarned + actualAllowances + fullAttendanceBonus),
    payday: resolvePayday(cycle.end, profile.payday),
  };
}

function resolveCycle(cycleStartDay: number, now: Date): { startKey: string; endKey: string; days: number; end: Date } {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), cycleStartDay);
  const start = formatLocalDateKey(now) >= formatLocalDateKey(currentMonthStart)
    ? currentMonthStart
    : new Date(now.getFullYear(), now.getMonth() - 1, cycleStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay - 1);
  return {
    startKey: formatLocalDateKey(start),
    endKey: formatLocalDateKey(end),
    days: calendarDayNumber(end) - calendarDayNumber(start) + 1,
    end,
  };
}

function cycleRecords(attendance: AttendanceRecord[], startKey: string, endKey: string): AttendanceRecord[] {
  const byDate = new Map<string, AttendanceRecord>();
  for (const record of attendance) {
    const attributionDate = attributionDateOf(record);
    if (attributionDate >= startKey && attributionDate <= endKey) byDate.set(attributionDate, record);
  }
  return [...byDate.values()];
}

function attributionDateOf(record: AttendanceRecord): string {
  if (record.clockIn) {
    const clockIn = new Date(record.clockIn);
    if (!Number.isNaN(clockIn.getTime())) return formatLocalDateKey(clockIn);
  }
  return record.date;
}

function calculateAllowances(allowances: Allowance[], phase: 'probation' | 'regular', days: number): number {
  return roundMoney(allowances.reduce((total, allowance) => {
    const allowancePhase = allowance.phase ?? 'regular';
    if (allowancePhase !== 'both' && allowancePhase !== phase) return total;
    return total + (allowance.mode === 'per-day' ? allowance.amount * days : allowance.amount);
  }, 0));
}

function resolvePayday(cycleEnd: Date, payday: number): string {
  let date = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), payday);
  if (formatLocalDateKey(date) <= formatLocalDateKey(cycleEnd)) date = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, payday);
  return formatLocalDateKey(date);
}

function calendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}