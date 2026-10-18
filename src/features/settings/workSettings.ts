import { defaultWorkProfile, WorkProfile } from '../../core/model/finance';

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

export function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function isDefaultWorkProfile(profile: WorkProfile): boolean {
  return profile.monthlyIncome === defaultWorkProfile.monthlyIncome
    && profile.probationIncome === defaultWorkProfile.probationIncome
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
