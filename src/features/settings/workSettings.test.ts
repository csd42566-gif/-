import { defaultWorkProfile, WorkProfile } from '../../core/model/finance';
import { isDefaultWorkProfile, isValidDateKey, mealAllowanceAmount, withMealAllowance } from './workSettings';

test('修改餐补时保留其他补贴项并固定为转正固定补贴', () => {
  const profile: WorkProfile = {
    ...defaultWorkProfile,
    allowances: [
      { name: '餐补', amount: 500, mode: 'fixed', phase: 'regular' },
      { name: '交通补', amount: 120, mode: 'fixed', phase: 'both' },
    ],
  };

  const updated = withMealAllowance(profile, 650);

  expect(mealAllowanceAmount(updated)).toBe(650);
  expect(updated.allowances).toHaveLength(2);
  expect(updated.allowances[0]).toEqual({ name: '餐补', amount: 650, mode: 'fixed', phase: 'regular' });
  expect(updated.allowances[1]).toEqual(profile.allowances[1]);
});

test('缺少餐补时新增一项且不改原对象', () => {
  const profile: WorkProfile = { ...defaultWorkProfile, allowances: [] };
  const updated = withMealAllowance(profile, 300);

  expect(updated).not.toBe(profile);
  expect(profile.allowances).toEqual([]);
  expect(updated.allowances).toEqual([{ name: '餐补', amount: 300, mode: 'fixed', phase: 'regular' }]);
});

test('只接受真实存在的本地日期键', () => {
  expect(isValidDateKey('2026-11-10')).toBe(true);
  expect(isValidDateKey('2026-02-30')).toBe(false);
  expect(isValidDateKey('2026-1-10')).toBe(false);
});

test('逐字段判断工资配置是否仍为默认值', () => {
  expect(isDefaultWorkProfile(defaultWorkProfile)).toBe(true);
  expect(isDefaultWorkProfile({ ...defaultWorkProfile, monthlyIncome: 5001 })).toBe(false);
  expect(isDefaultWorkProfile({ ...defaultWorkProfile, allowances: [{ name: '餐补', amount: 600, mode: 'fixed', phase: 'regular' }] })).toBe(false);
});
