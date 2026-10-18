import { motion } from './theme';

test('三档动效 token 满足约束', () => {
  expect(motion.levels.standard.duration).toBe(140);
  expect(motion.levels.standard.spring).toBeNull();
  expect(motion.levels.enhanced.spring).toMatchObject({ mass: 1, damping: 17, stiffness: 250 });
  expect(motion.levels.super.spring).toMatchObject({ mass: 1, damping: 10, stiffness: 300 });
  expect(motion.levels.enhanced.pressScale).toBe(0.97);
  expect(motion.levels.super.pressScale).toBe(0.95);
  expect(motion.levels.enhanced.spring?.damping).toBeGreaterThanOrEqual(8);
  expect(motion.levels.enhanced.spring?.damping).toBeLessThanOrEqual(20);
});