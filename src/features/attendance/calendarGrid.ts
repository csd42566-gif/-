import { localDateKey } from './attendance';

export interface CalendarDay {
  dateKey: string;
  day: number;
  inMonth: boolean;
}

export function buildMonthMatrix(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month - 1, 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset, 12);
  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + weekIndex * 7 + dayIndex, 12);
      return {
        dateKey: localDateKey(date),
        day: date.getDate(),
        inMonth: date.getFullYear() === year && date.getMonth() === month - 1,
      };
    })
  );
}