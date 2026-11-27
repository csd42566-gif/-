/**
 * 默认分类树与默认账户（v2 种子数据）。
 * 纯数据 + 纯函数，供首次启动引导页与重置功能复用。
 */

export interface SeedCategory {
  kind: 'expense' | 'income';
  parentId: number | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface SeedAccount {
  name: string;
  icon: string;
  color: string;
  initialBalanceCents: number;
  initialCurrency: string;
}

/** 支出两级分类：parentId 指向 SEED_EXPENSE_CATEGORIES 中 id=0 起的大类。 */
export const SEED_EXPENSE_CATEGORIES: SeedCategory[] = [
  // 大类（sortOrder 0–5）
  { kind: 'expense', parentId: null, name: '吃饭', icon: 'rice', color: '#F59E0B', sortOrder: 0 },
  { kind: 'expense', parentId: null, name: '交通', icon: 'bus', color: '#3B82F6', sortOrder: 1 },
  { kind: 'expense', parentId: null, name: '购物', icon: 'bag', color: '#EC4899', sortOrder: 2 },
  { kind: 'expense', parentId: null, name: '日用', icon: 'home', color: '#10B981', sortOrder: 3 },
  { kind: 'expense', parentId: null, name: '娱乐', icon: 'game', color: '#8B5CF6', sortOrder: 4 },
  { kind: 'expense', parentId: null, name: '其他', icon: 'more', color: '#64748B', sortOrder: 5 },
  // 吃饭小类（父=吃饭）
  { kind: 'expense', parentId: 0, name: '早饭', icon: 'sunrise', color: '#F59E0B', sortOrder: 0 },
  { kind: 'expense', parentId: 0, name: '午饭', icon: 'sun', color: '#F59E0B', sortOrder: 1 },
  { kind: 'expense', parentId: 0, name: '晚饭', icon: 'moon', color: '#F59E0B', sortOrder: 2 },
  { kind: 'expense', parentId: 0, name: '外卖', icon: 'delivery', color: '#F59E0B', sortOrder: 3 },
  { kind: 'expense', parentId: 0, name: '聚餐', icon: 'people', color: '#F59E0B', sortOrder: 4 },
  // 交通小类（父=交通）
  { kind: 'expense', parentId: 1, name: '公交地铁', icon: 'metro', color: '#3B82F6', sortOrder: 0 },
  { kind: 'expense', parentId: 1, name: '打车', icon: 'car', color: '#3B82F6', sortOrder: 1 },
  { kind: 'expense', parentId: 1, name: '加油', icon: 'gas', color: '#3B82F6', sortOrder: 2 },
  // 购物小类（父=购物）
  { kind: 'expense', parentId: 2, name: '衣服', icon: 'shirt', color: '#EC4899', sortOrder: 0 },
  { kind: 'expense', parentId: 2, name: '数码', icon: 'phone', color: '#EC4899', sortOrder: 1 },
  { kind: 'expense', parentId: 2, name: '家居', icon: 'sofa', color: '#EC4899', sortOrder: 2 },
  // 日用小类（父=日用）
  { kind: 'expense', parentId: 3, name: '水电燃气', icon: 'bolt', color: '#10B981', sortOrder: 0 },
  { kind: 'expense', parentId: 3, name: '日用品', icon: 'soap', color: '#10B981', sortOrder: 1 },
  // 娱乐小类（父=娱乐）
  { kind: 'expense', parentId: 4, name: '游戏', icon: 'joystick', color: '#8B5CF6', sortOrder: 0 },
  { kind: 'expense', parentId: 4, name: '视频会员', icon: 'video', color: '#8B5CF6', sortOrder: 1 },
  { kind: 'expense', parentId: 4, name: '运动健身', icon: 'barbell', color: '#8B5CF6', sortOrder: 2 },
];

/** 收入分类（一级，parentId 恒 null）。 */
export const SEED_INCOME_CATEGORIES: SeedCategory[] = [
  { kind: 'income', parentId: null, name: '工资', icon: 'salary', color: '#FBBF24', sortOrder: 0 },
  { kind: 'income', parentId: null, name: '副业', icon: 'laptop', color: '#34D399', sortOrder: 1 },
  { kind: 'income', parentId: null, name: '报销', icon: 'receipt', color: '#60A5FA', sortOrder: 2 },
  { kind: 'income', parentId: null, name: '其他', icon: 'more', color: '#94A3B8', sortOrder: 3 },
];

/** 默认三账户。 */
export const SEED_ACCOUNTS: SeedAccount[] = [
  { name: '微信', icon: 'wechat', color: '#22C55E', initialBalanceCents: 0, initialCurrency: 'CNY' },
  { name: '支付宝', icon: 'alipay', color: '#3B82F6', initialBalanceCents: 0, initialCurrency: 'CNY' },
  { name: '银行卡', icon: 'bank', color: '#F59E0B', initialBalanceCents: 0, initialCurrency: 'CNY' },
];

/**
 * 把「种子内相对 parentId（指向 SEED_EXPENSE_CATEGORIES 的下标）」展开成完整分类清单，
 * 其中 parentId 用真实的相对坐标：顶级分类的行号从 0 起。
 * 返回的 SeedCategory.parentId 为 null（顶级）或「父分类在顶级列表中的索引」。
 */
export function buildSeedCategories(): { categories: SeedCategory[]; topLevelCount: number } {
  const expenseTop = SEED_EXPENSE_CATEGORIES.filter((c) => c.parentId === null);
  const expenseChildren = SEED_EXPENSE_CATEGORIES.filter((c) => c.parentId !== null);
  const categories: SeedCategory[] = [
    ...expenseTop.map((c) => ({ ...c })),
    ...expenseChildren.map((c) => ({ ...c })),
    ...SEED_INCOME_CATEGORIES.map((c) => ({ ...c })),
  ];
  return { categories, topLevelCount: expenseTop.length };
}
