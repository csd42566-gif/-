/**
 * 分类树操作（v2）：支出两级（大类→小类），收入一级。
 * 删除分类后旧流水落「未分类」（categoryId = null），统计单列。
 */

export interface Category {
  id: number;
  kind: 'expense' | 'income';
  parentId: number | null; // 支出小类的父大类 id；一级分类为 null
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

/** 顶级分类（大类 / 收入类）。 */
export function topLevelCategories(categories: Category[]): Category[] {
  return categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** 某大类下的全部小类。 */
export function childrenOf(categories: Category[], parentId: number): Category[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** 构建两级树。 */
export interface CategoryNode extends Category {
  children: Category[];
}

export function categoryTree(categories: Category[]): CategoryNode[] {
  return topLevelCategories(categories).map((top) => ({
    ...top,
    children: childrenOf(categories, top.id),
  }));
}

/** 校验：收入分类不允许有父；支出小类必须有父且父是支出大类；每个无效分类只报首个错误。 */
export function validateCategoryStructure(categories: Category[]): string[] {
  const errors: string[] = [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const c of categories) {
    if (c.kind === 'income' && c.parentId !== null) {
      errors.push(`收入分类「${c.name}」(id=${c.id}) 不允许有父分类`);
      continue;
    }
    if (c.parentId !== null) {
      const parent = byId.get(c.parentId);
      if (!parent) {
        errors.push(`分类「${c.name}」(id=${c.id}) 的父分类 id=${c.parentId} 不存在`);
      } else if (parent.parentId !== null) {
        errors.push(`分类「${c.name}」(id=${c.id}) 的父「${parent.name}」不是顶级分类（不允许三级）`);
      } else if (parent.kind !== c.kind) {
        errors.push(`分类「${c.name}」(id=${c.id}) 与父分类「${parent.name}」的 kind 不一致`);
      }
    }
  }
  return errors;
}

/** 删除某分类后，其下流水与子分类的处理标记。 */
export interface DeleteCategoryPlan {
  /** 需要把流水置空的分类 id 列表（含子分类）。 */
  affectedIds: number[];
  /** 关联小类（若删的是大类）。 */
  removedChildIds: number[];
}

export function planCategoryDeletion(categories: Category[], targetId: number): DeleteCategoryPlan {
  const childIds = categories
    .filter((c) => c.parentId === targetId)
    .map((c) => c.id);
  return {
    affectedIds: [targetId, ...childIds],
    removedChildIds: childIds,
  };
}
