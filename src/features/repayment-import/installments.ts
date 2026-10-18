import { InstallmentPeriod, InstallmentPlan } from '../../core/model/finance';

export type InstallmentType = InstallmentPlan['repaymentType'];

export interface InstallmentDraft {
  debtName: string;
  remainingPrincipal: number;
  totalInterest: number;
  totalPeriods: number;
  paidPeriods: number;
  annualRate?: number;
  repaymentType: InstallmentType;
  fixedPayment?: number;
  firstDueDate: string;
  periods: InstallmentPeriod[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseMoney(value: string): number {
  const amount = Number(value.replace(/[,\s]/g, ''));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('installment-amount-invalid');
  return round(amount);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addMonths(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateKey(target);
}

function makePeriods(amounts: number[], firstDueDate: string, principal: number, totalInterest: number): InstallmentPeriod[] {
  const interestPerPeriod = amounts.length > 0 ? totalInterest / amounts.length : 0;
  let balance = principal;
  return amounts.map((totalAmount, index) => {
    const interestAmount = round(index === amounts.length - 1 ? totalInterest - interestPerPeriod * index : interestPerPeriod);
    const principalAmount = round(index === amounts.length - 1 ? balance : Math.min(balance, totalAmount - interestAmount));
    balance = round(balance - principalAmount);
    return { number: index + 1, dueDate: addMonths(firstDueDate, index), principalAmount, interestAmount, totalAmount: round(totalAmount) };
  });
}

function generateAnnuityPeriods(principal: number, annualRate: number, totalPeriods: number, firstDueDate: string): InstallmentPeriod[] {
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyRate === 0
    ? principal / totalPeriods
    : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalPeriods));
  let balance = principal;
  return Array.from({ length: totalPeriods }, (_, index) => {
    const interestAmount = round(balance * monthlyRate);
    const principalAmount = index === totalPeriods - 1 ? balance : round(payment - interestAmount);
    const totalAmount = round(principalAmount + interestAmount);
    const dueDate = addMonths(firstDueDate, index);
    balance = round(balance - principalAmount);
    return { number: index + 1, dueDate, principalAmount, interestAmount, totalAmount };
  });
}

function generateEqualPrincipalPeriods(principal: number, annualRate: number, totalPeriods: number, firstDueDate: string): InstallmentPeriod[] {
  const monthlyRate = annualRate / 100 / 12;
  const fixedPrincipal = round(principal / totalPeriods);
  let balance = principal;
  return Array.from({ length: totalPeriods }, (_, index) => {
    const principalAmount = index === totalPeriods - 1 ? balance : fixedPrincipal;
    const interestAmount = round(balance * monthlyRate);
    const totalAmount = round(principalAmount + interestAmount);
    const dueDate = addMonths(firstDueDate, index);
    balance = round(balance - principalAmount);
    return { number: index + 1, dueDate, principalAmount, interestAmount, totalAmount };
  });
}
export function createInstallmentDraft(input: {
  debtName: string;
  remainingPrincipal: number;
  totalInterest: number;
  totalPeriods: number;
  paidPeriods?: number;
  annualRate?: number;
  repaymentType: InstallmentType;
  fixedPayment?: number;
  firstDueDate: string;
}): InstallmentDraft {
  if (!Number.isFinite(input.remainingPrincipal) || input.remainingPrincipal <= 0) throw new Error('installment-principal-invalid');
  if (!Number.isInteger(input.totalPeriods) || input.totalPeriods <= 0) throw new Error('installment-periods-invalid');
  const generated = input.annualRate != null && input.annualRate > 0
    ? input.repaymentType === 'annuity'
      ? generateAnnuityPeriods(input.remainingPrincipal, input.annualRate, input.totalPeriods, input.firstDueDate)
      : input.repaymentType === 'equal-principal'
        ? generateEqualPrincipalPeriods(input.remainingPrincipal, input.annualRate, input.totalPeriods, input.firstDueDate)
        : null
    : null;
  const amount = input.fixedPayment && input.fixedPayment > 0
    ? input.fixedPayment
    : (input.remainingPrincipal + input.totalInterest) / input.totalPeriods;
  const amounts = Array.from({ length: input.totalPeriods }, (_, index) =>
    index === input.totalPeriods - 1
      ? round(input.remainingPrincipal + input.totalInterest - amount * index)
      : round(amount));
  const periods = generated ?? makePeriods(amounts, input.firstDueDate, input.remainingPrincipal, input.totalInterest);
  const generatedInterest = round(periods.reduce((sum, period) => sum + period.interestAmount, 0));
  return {
    debtName: input.debtName.trim() || '分期欠款',
    remainingPrincipal: round(input.remainingPrincipal),
    totalInterest: generated ? generatedInterest : round(input.totalInterest),
    totalPeriods: input.totalPeriods,
    paidPeriods: input.paidPeriods ?? 0,
    annualRate: input.annualRate,
    repaymentType: input.repaymentType,
    fixedPayment: input.fixedPayment,
    firstDueDate: input.firstDueDate,
    periods,
  };
}

export function parseAlipayInstallmentText(text: string, now = new Date()): InstallmentDraft {
  const normalized = text.replace(/\s+/g, ' ');
  const remainingPrincipal = normalized.match(/剩余本金(?:[（(]元[）)])?\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];
  const totalInterest = normalized.match(/总利息\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];
  const totalRepayment = normalized.match(/(?:总应还|剩余应还总额)(?:[（(]元[）)])?\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];
  const remainingPeriods = normalized.match(/剩余\s*(\d+)\s*期/)?.[1];
  const debtName = /借呗/.test(normalized) ? '借呗分期' : /花呗/.test(normalized) ? '花呗分期' : /白条/.test(normalized) ? '白条分期' : '分期欠款';
  const periodMatches = [...normalized.matchAll(/(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})日应还\s*([\d,]+(?:\.\d{1,2})?)/g)];
  const firstMonth = periodMatches.length > 0 ? Number(periodMatches[0][2]) : now.getMonth() + 1;
  let currentYear = now.getFullYear() + (firstMonth < now.getMonth() + 1 ? 1 : 0);
  let previousMonth = 0;
  const periodDates = periodMatches.map((match) => {
    if (match[1]) currentYear = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
    const month = Number(match[2]);
    if (previousMonth > 0 && month < previousMonth) currentYear += 1;
    previousMonth = month;
    return `${currentYear}-${String(month).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
  });
  const periodAmounts = periodMatches.map((match) => parseMoney(match[4]));
  const periods = periodDates.length > 0 ? periodDates.map((dueDate, index) => ({ number: index + 1, dueDate, principalAmount: 0, interestAmount: 0, totalAmount: periodAmounts[index] })) : [];
  const visibleTotal = round(periodAmounts.reduce((sum, amount) => sum + amount, 0));
  const totalRepaymentAmount = totalRepayment ? parseMoney(totalRepayment) : visibleTotal;
  const principal = remainingPrincipal ? parseMoney(remainingPrincipal) : totalRepaymentAmount;
  const interest = totalInterest ? parseMoney(totalInterest) : 0;
  const periodsCount = remainingPeriods ? Number(remainingPeriods) : periods.length;
  const fixedPayment = periodAmounts[0] ?? (periodsCount > 0 ? round(totalRepaymentAmount / periodsCount) : undefined);
  if (principal <= 0 || periodsCount <= 0) throw new Error('installment-data-invalid');
  const draft = createInstallmentDraft({
    debtName, remainingPrincipal: principal, totalInterest: interest, totalPeriods: periodsCount,
    repaymentType: 'fixed-payment', fixedPayment, firstDueDate: periods[0]?.dueDate ?? toDateKey(now),
  });
  return periodAmounts.length >= periodsCount
    ? { ...draft, periods: makePeriods(periodAmounts.slice(0, periodsCount), periods[0].dueDate, principal, interest) }
    : draft;
}

export function toInstallmentPlan(draft: InstallmentDraft): InstallmentPlan {
  return {
    remainingPrincipal: draft.remainingPrincipal,
    totalPeriods: draft.paidPeriods + draft.periods.length,
    paidPeriods: draft.paidPeriods,
    annualRate: draft.annualRate,
    repaymentType: draft.repaymentType,
    periods: draft.periods,
  };
}