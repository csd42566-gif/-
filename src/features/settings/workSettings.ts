import { defaultWorkProfile, WorkProfile } from '../../core/model/finance';
import { addLocalDays, isValidDateKey, normalizeDateKey, parseLocalDateKey } from '../../core/time/dateKey';

export { isValidDateKey } from '../../core/time/dateKey';

const MEAL_ALLOWANCE_NAME = '餐补';

export function mealAllowanceAmount(profile: WorkProfile): number {
  return profile.allowances.find((allowance) => allowance.name === MEAL_ALLOWANCE_NAME)?.amount ?? 0;
}

export function withMealAllowance(profile: WorkProfile, amount: number): WorkProfile {
  const meal = { name: MEAL_ALLOWANCE_NAME, amount, mode: 'fixed' as const, phase: 'regular' as const };
  const index = profile.allowances.findIndex((allowance) => allowance.name === MEAL_ALLOWANCE_NAME);
  const allowances = index < 0
    ? [...profile.allowances, meal]
    : profile.allowances.map((allowance, allowanceIndex) => allowanceIndex === index ? meal : allowance);
  return { ...profile, allowances };
}

export function probationPeriodEnd(profile: WorkProfile): string {
  return addLocalDays(profile.regularStartDate ?? '', -1) ?? '';
}

export function withProbationPeriod(profile: WorkProfile, startDate: string, endDate: string): WorkProfile | null {
  const normalizedStart = normalizeDateKey(startDate);
  const normalizedEnd = normalizeDateKey(endDate);
  const start = parseLocalDateKey(startDate);
  const regularStartDate = normalizedEnd ? addLocalDays(normalizedEnd, 1) : null;
  if (!normalizedStart || !normalizedEnd || !start || !regularStartDate || normalizedEnd < normalizedStart) return null;
  return {
    ...profile,
    probationStartDate: normalizedStart,
    cycleStartDay: start.getDate(),
    regularStartDate,
  };
}

export function isDefaultWorkProfile(profile: WorkProfile): boolean {
  return profile.monthlyIncome === defaultWorkProfile.monthlyIncome
    && profile.probationIncome === defaultWorkProfile.probationIncome
    && profile.probationStartDate === defaultWorkProfile.probationStartDate
    && profile.regularStartDate === defaultWorkProfile.regularStartDate
    && profile.restDaysPerMonth === defaultWorkProfile.restDaysPerMonth
    && profile.workHoursPerDay === defaultWorkProfile.workHoursPerDay
    && profile.payday === defaultWorkProfile.payday
    && profile.cycleStartDay === defaultWorkProfile.cycleStartDay
    && profile.fullAttendanceBonus === defaultWorkProfile.fullAttendanceBonus
    && profile.allowances.length === defaultWorkProfile.allowances.length
    && profile.allowances.every((allowance, index) => {
      const expected = defaultWorkProfile.allowances[index];
      return allowance.name === expected.name
        && allowance.amount === expected.amount
        && allowance.mode === expected.mode
        && allowance.phase === expected.phase;
    });
}
