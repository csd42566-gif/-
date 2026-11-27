import {
  topLevelCategories,
  childrenOf,
  categoryTree,
  validateCategoryStructure,
  planCategoryDeletion,
} from './categories';
import type { Category } from './categories';

const cats: Category[] = [
  { id: 1, kind: 'expense', parentId: null, name: '吃饭', icon: '🍚', color: '#FF8A00', sortOrder: 0 },
  { id: 2, kind: 'expense', parentId: 1, name: '外卖', icon: '🛵', color: '#FF8A00', sortOrder: 0 },
  { id: 3, kind: 'expense', parentId: 1, name: '聚餐', icon: '🍻', color: '#FF8A00', sortOrder: 1 },
  { id: 4, kind: 'expense', parentId: null, name: '购物', icon: '🛍️', color: '#FF5A5F', sortOrder: 1 },
  { id: 5, kind: 'income', parentId: null, name: '工资', icon: '💰', color: '#4CD964', sortOrder: 0 },
];

describe('分类树（支出两级 / 收入一级）', () => {
  test('顶级分类只含 parentId=null', () => {
    const tops = topLevelCategories(cats);
    expect(tops.map((c) => c.name).sort()).toEqual(['吃饭', '工资', '购物']);
  });

  test('childrenOf 取某大类小类', () => {
    expect(childrenOf(cats, 1).map((c) => c.name)).toEqual(['外卖', '聚餐']);
  });

  test('categoryTree 构建两级树', () => {
    const tree = categoryTree(cats);
    const food = tree.find((n) => n.name === '吃饭');
    expect(food?.children.map((c) => c.name)).toEqual(['外卖', '聚餐']);
    const salary = tree.find((n) => n.name === '工资');
    expect(salary?.children).toEqual([]);
  });

  test('结构校验：收入不许有父、不许三级', () => {
    expect(validateCategoryStructure(cats)).toEqual([]);
    const bad: Category[] = [
      { id: 10, kind: 'income', parentId: 1, name: '报销', icon: '', color: '', sortOrder: 0 },
      { id: 11, kind: 'expense', parentId: 2, name: '三级', icon: '', color: '', sortOrder: 0 },
    ];
    const errors = validateCategoryStructure([...cats, ...bad]);
    expect(errors.length).toBe(2);
    expect(errors.some((e) => e.includes('不允许有父分类'))).toBe(true);
    expect(errors.some((e) => e.includes('不允许三级'))).toBe(true);
  });

  test('删除大类时连带子分类，流水落未分类', () => {
    const plan = planCategoryDeletion(cats, 1);
    expect(plan.affectedIds.sort()).toEqual([1, 2, 3]);
    expect(plan.removedChildIds.sort()).toEqual([2, 3]);
  });
});
