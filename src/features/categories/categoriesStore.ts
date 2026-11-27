/**
 * 分类 store（v2）：支出两级 / 收入一级的 CRUD。
 * 删除规则（决策 18）：删大类连带删其小类；被删分类下的流水 categoryId 置 null（落「未分类」）。
 * 分类结构校验走 src/core/categories.ts 的纯函数，错误不吞。
 */

import { create } from 'zustand';

import { eq, inArray } from 'drizzle-orm';
import { planCategoryDeletion } from '../../core/categories';
import { openDatabase } from '../../data/db';
import { categories, transactions } from '../../data/schema';
import type { FeiyuDatabase } from '../../data/db';

export type CategoryKind = 'expense' | 'income';

export interface CategoryRow {
  id: number;
  kind: CategoryKind;
  parentId: number | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface CategoryInput {
  kind: CategoryKind;
  parentId: number | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface CategoriesState {
  categories: CategoryRow[];
  loaded: boolean;
  load: () => Promise<void>;
  addCategory: (input: CategoryInput) => Promise<number>;
  renameCategory: (
    id: number,
    patch: Partial<Pick<CategoryRow, 'name' | 'icon' | 'color' | 'sortOrder'>>,
  ) => Promise<void>;
  /** 删除分类（含其小类），受影响流水落「未分类」。返回受影响流水数。 */
  removeCategory: (id: number) => Promise<number>;
}

let dbPromise: Promise<FeiyuDatabase> | null = null;
function getDb(): Promise<FeiyuDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export const useCategoriesStore = create<CategoriesState>()((set, get) => ({
  categories: [],
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select().from(categories);
    set({
      categories: rows.map((r) => ({
        id: r.id,
        kind: r.kind as CategoryKind,
        parentId: r.parentId,
        name: r.name,
        icon: r.icon,
        color: r.color,
        sortOrder: r.sortOrder,
      })),
      loaded: true,
    });
  },

  addCategory: async (input) => {
    const db = await getDb();
    const res = await db.insert(categories).values(input).returning({ id: categories.id });
    const id = res[0].id;
    set({ categories: [...get().categories, { id, ...input }] });
    return id;
  },

  renameCategory: async (id, patch) => {
    const db = await getDb();
    await db.update(categories).set(patch).where(eq(categories.id, id));
    set({
      categories: get().categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  },

  removeCategory: async (id) => {
    const db = await getDb();
    const plan = planCategoryDeletion(get().categories, id);
    if (plan.affectedIds.length === 0) return 0;
    const affected = await db
      .update(transactions)
      .set({ categoryId: null })
      .where(inArray(transactions.categoryId, plan.affectedIds))
      .returning({ id: transactions.id });
    await db.delete(categories).where(inArray(categories.id, plan.affectedIds));
    const affectedIds = new Set(plan.affectedIds);
    set({
      categories: get().categories.filter((c) => !affectedIds.has(c.id)),
    });
    return affected.length;
  },
}));
