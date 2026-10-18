import { defaultWorkProfile } from '../../core/model/finance';
import { localDateKey } from './attendance';
import { applyTimeToDateKey, defaultClockInTime, durationHours, parseClockTimeInput } from './calendarTime';

test('接受 1800 和 18:00 两种输入', () => {
  expect(parseClockTimeInput('1800')).toEqual({ hours: 18, minutes: 0 });
  expect(parseClockTimeInput('18:00')).toEqual({ hours: 18, minutes: 0 });
  expect(parseClockTimeInput('25:00')).toBeNull();
});

test('用所选本地日期和指定时间构造 clockIn', () => {
  const date = applyTimeToDateKey('2026-10-15', 18, 0);
  expect(localDateKey(date)).toBe('2026-10-15');
  expect(date.getHours()).toBe(18);
  expect(date.getMinutes()).toBe(0);
  expect(date.getSeconds()).toBe(0);
});

test('18:00 到次日 02:05 显示为 8.1 小时', () => {
  const start = applyTimeToDateKey('2026-10-15', 18, 0).toISOString();
  const end = new Date(2026, 9, 16, 2, 5, 0).toISOString();
  expect(durationHours(start, end)?.toFixed(1)).toBe('8.1');
});

test('没有排班开始字段时默认 18:00', () => {
  expect(defaultClockInTime(defaultWorkProfile)).toBe('18:00');
});