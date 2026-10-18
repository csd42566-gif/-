import { AttendanceRecord, LedgerState } from '../../core/model/finance';

export const ATTENDANCE_CLOCK_IN_REQUIRED = 'attendance-clock-in-required';

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function clockInAttendance(state: LedgerState, now: Date): LedgerState {
  const date = localDateKey(now);
  const current = state.attendance ?? [];
  const existing = current.find((record) => record.date === date);
  return {
    ...state,
    attendance: upsertAttendance(current, {
      date,
      clockIn: now.toISOString(),
      status: 'worked',
      ...(existing?.note ? { note: existing.note } : {}),
    }),
  };
}

export function clockOutAttendance(state: LedgerState, now: Date): LedgerState {
  const attendance = state.attendance ?? [];
  const pending = findPendingAttendanceRecord(attendance, now);
  if (!pending) throw new Error(ATTENDANCE_CLOCK_IN_REQUIRED);
  return {
    ...state,
    attendance: upsertAttendance(attendance, {
      ...pending,
      clockOut: now.toISOString(),
      status: 'worked',
    }),
  };
}

export function markAttendanceRest(state: LedgerState, now: Date): LedgerState {
  const date = localDateKey(now);
  const current = state.attendance ?? [];
  const existing = current.find((record) => record.date === date);
  return {
    ...state,
    attendance: upsertAttendance(current, {
      date,
      status: 'rest',
      ...(existing?.note ? { note: existing.note } : {}),
    }),
  };
}

export function undoAttendanceRest(state: LedgerState, now: Date): LedgerState {
  const date = localDateKey(now);
  const current = state.attendance ?? [];
  const next = current.filter((record) => !(record.date === date && record.status === 'rest'));
  return next.length === current.length ? state : { ...state, attendance: next };
}

export function findPendingAttendanceRecord(attendance: AttendanceRecord[], now: Date): AttendanceRecord | undefined {
  const today = localDateKey(now);
  const todayRecord = attendance.find((item) => item.date === today && !!item.clockIn && !item.clockOut);
  if (todayRecord) return todayRecord;
  return attendance
    .filter((item) => !!item.clockIn && !item.clockOut)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

function upsertAttendance(attendance: AttendanceRecord[], record: AttendanceRecord): AttendanceRecord[] {
  const index = attendance.findIndex((item) => item.date === record.date);
  if (index < 0) return [...attendance, record];
  return attendance.map((item, itemIndex) => itemIndex === index ? record : item);
}

function previousLocalDateKey(date: Date): string {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12));
}