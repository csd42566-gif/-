import { buildSeedCategories, SEED_ACCOUNTS } from './seeds';

describe('seeds', () => {
  it('buildSeedCategories 返回顶级 + 小类 + 收入，小类 parentId 指向顶级索引', () => {
    const { categories, topLevelCount } = buildSeedCategories();
    expect(topLevelCount).toBe(6);
    const top = categories.filter((c) => c.parentId === null && c.kind === 'expense');
    expect(top).toHaveLength(6);
    const children = categories.filter((c) => c.parentId !== null);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(child.parentId).toBeGreaterThanOrEqual(0);
      expect(child.parentId).toBeLessThan(topLevelCount);
      expect(top[child.parentId!].name).toBeTruthy();
    }
    const income = categories.filter((c) => c.kind === 'income');
    expect(income).toHaveLength(4);
    for (const inc of income) expect(inc.parentId).toBeNull();
  });

  it('默认三账户齐全且币种 CNY', () => {
    expect(SEED_ACCOUNTS.map((a) => a.name)).toEqual(['微信', '支付宝', '银行卡']);
    for (const a of SEED_ACCOUNTS) {
      expect(a.initialCurrency).toBe('CNY');
      expect(a.initialBalanceCents).toBe(0);
    }
  });
});
