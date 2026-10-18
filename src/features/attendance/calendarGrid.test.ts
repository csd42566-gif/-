import { buildMonthMatrix } from './calendarGrid';

test('月历固定为6×7并从周一开始', () => {
  const matrix = buildMonthMatrix(2026, 10);

  expect(matrix).toHaveLength(6);
  expect(matrix.every((week) => week.length === 7)).toBe(true);
  expect(matrix[0][0]).toMatchObject({ dateKey: '2026-09-28', day: 28, inMonth: false });
  expect(matrix[0][3]).toMatchObject({ dateKey: '2026-10-01', day: 1, inMonth: true });
  expect(matrix[5][6]).toMatchObject({ dateKey: '2026-11-08', day: 8, inMonth: false });
});