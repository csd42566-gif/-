import { createInstallmentDraft, parseAlipayInstallmentText } from './installments';

function sum(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

test('等额本息生成完整本金和利息分期表', () => {
  const draft = createInstallmentDraft({
    debtName: '借呗分期', remainingPrincipal: 12000, totalInterest: 0,
    totalPeriods: 12, annualRate: 12, repaymentType: 'annuity', firstDueDate: '2026-11-14',
  });

  expect(draft.periods).toHaveLength(12);
  expect(draft.periods[0].interestAmount).toBeGreaterThan(0);
  expect(draft.periods[0].principalAmount).toBeGreaterThan(0);
  expect(sum(draft.periods.map((period) => period.principalAmount))).toBeCloseTo(12000, 2);
  expect(draft.totalInterest).toBeGreaterThan(0);
});

test('等额本金每期本金固定、利息递减', () => {
  const draft = createInstallmentDraft({
    debtName: '借呗分期', remainingPrincipal: 12000, totalInterest: 0,
    totalPeriods: 12, annualRate: 12, repaymentType: 'equal-principal', firstDueDate: '2026-11-14',
  });

  expect(draft.periods[0].principalAmount).toBe(1000);
  expect(draft.periods[1].principalAmount).toBe(1000);
  expect(draft.periods[0].interestAmount).toBeGreaterThan(draft.periods[1].interestAmount);
  expect(sum(draft.periods.map((period) => period.principalAmount))).toBeCloseTo(12000, 2);
});

test('解析借呗剩余本金、总利息和剩余期数', () => {
  const text = [
    '借呗还款计划', '剩余本金(元)', '1,157.47', '总利息', '115.47', '总应还', '1,272.94',
    '剩余9期，每月14日自动还', '11月14日应还', '141.43', '12月14日应还', '141.43',
    '01月14日应还', '141.43', '02月14日应还', '141.43', '03月14日应还', '141.43', '04月14日应还', '141.43',
  ].join(' ');
  const draft = parseAlipayInstallmentText(text, new Date('2026-10-18T00:00:00+08:00'));

  expect(draft.debtName).toBe('借呗分期');
  expect(draft.remainingPrincipal).toBe(1157.47);
  expect(draft.totalInterest).toBe(115.47);
  expect(draft.totalPeriods).toBe(9);
  expect(draft.periods).toHaveLength(9);
  expect(draft.periods[0]).toMatchObject({ dueDate: '2026-11-14', totalAmount: 141.43 });
  expect(draft.periods[2].dueDate).toBe('2027-01-14');
  expect(sum(draft.periods.map((period) => period.principalAmount))).toBeCloseTo(1157.47, 2);
  expect(sum(draft.periods.map((period) => period.interestAmount))).toBeCloseTo(115.47, 2);
});

test('解析金额不固定的待还账单', () => {
  const text = '全部待还 11月15日应还 77.50 12月15日应还 46.18 27年1月15日应还 46.18 27年2月15日应还 46.18';
  const draft = parseAlipayInstallmentText(text, new Date('2026-10-18T00:00:00+08:00'));

  expect(draft.totalPeriods).toBe(4);
  expect(draft.remainingPrincipal).toBe(216.04);
  expect(draft.periods.map((period) => period.totalAmount)).toEqual([77.5, 46.18, 46.18, 46.18]);
  expect(draft.periods[2].dueDate).toBe('2027-01-15');
});

test('没有本金和期数时拒绝分期解析', () => {
  expect(() => parseAlipayInstallmentText('只是普通还款 100 元')).toThrow('installment-data-invalid');
});