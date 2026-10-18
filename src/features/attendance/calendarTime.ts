import { WorkProfile } from '../../core/model/finance';

export function parseClockTimeInput(value: string): { hours: number; minutes: number } | null {
  const text = value.trim();
  const compact = /^(\d{2})(\d{2})$/.exec(text);
  const separated = /^(\d{2}):(\d{2})$/.exec(text);
  const match = compact ?? separated;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function formatClockTimeInput(value: string): string {
  const parsed = parseClockTimeInput(value);
  return parsed ? `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}` : value;
}

export function applyTimeToDateKey(dateKey: string, hours: number, minutes: number): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function defaultClockInTime(work: WorkProfile): string {
  const configured = (work as WorkProfile & { scheduleStartTime?: unknown }).scheduleStartTime;
  if (typeof configured === 'string' && parseClockTimeInput(configured)) return formatClockTimeInput(configured);
  return '18:00';
}

export function durationHours(clockIn?: string, clockOut?: string): number | null {
  if (!clockIn || !clockOut) return null;
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 3600000;
}