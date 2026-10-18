import { addLocalDays, normalizeDateKey } from './dateKey';

test('接受宽松日期并统一补零存储', () => {
  expect(normalizeDateKey('2026-1-1')).toBe('2026-01-01');
  expect(normalizeDateKey('2026-01-01')).toBe('2026-01-01');
  expect(normalizeDateKey('20260101')).toBe('2026-01-01');
});

test('拒绝不存在的日期并保持本地跨月计算', () => {
  expect(normalizeDateKey('2026-02-30')).toBeNull();
  expect(addLocalDays('2026-11-09', 1)).toBe('2026-11-10');
  expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
});