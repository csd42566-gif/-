export function normalizeDateKey(value: string): string | null {
  const text = value.trim();
  const separated = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  const parts = separated ? [separated[1], separated[2], separated[3]] : compact ? [compact[1], compact[2], compact[3]] : null;
  if (!parts) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

export function isValidDateKey(value: string): boolean {
  return normalizeDateKey(value) !== null;
}

export function parseLocalDateKey(value: string): Date | null {
  const normalized = normalizeDateKey(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatLocalDateKey(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function addLocalDays(value: string, days: number): string | null {
  const date = parseLocalDateKey(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return formatLocalDateKey(date);
}