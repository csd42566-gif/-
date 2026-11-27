/**
 * 储蓄目标 store（v2）：目标名 + 目标金额 + 已存金额。
 * 目标不挂账户、不进流水——它是「我想攒到 X」的独立记录，已存金额由用户手填。
 * 余额派生与此无关，所以增删改都不需要 recalc。
 */

import { create } from 'zustand';

import { goals } from '../../data/schema';
import { asc, eq } from 'drizzle-orm';
import { openDatabase } from '../../data/db';
import type { FeiyuDatabase } from '../../data/db';

export interface GoalRow {
  id: number;
  name: string;
  targetCents: number;
  savedCents: number;
  currency: string;
  createdAt: number;
  /** 到期日（epoch 秒）。0 表示没设。 */
  dueAt: number;
  /** 一句话说明。空串表示没写。 */
  note: string;
}

export interface GoalInput {
  name: string;
  targetCents: number;
  savedCents: number;
  currency: string;
  dueAt: number;
  note: string;
}

interface GoalsState {
  goals: GoalRow[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: GoalInput) => Promise<number>;
  update: (id: number, patch: Partial<GoalInput>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

let dbPromise: Promise<FeiyuDatabase> | null = null;
function getDb(): Promise<FeiyuDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export const useGoalsStore = create<GoalsState>()((set, get) => ({
  goals: [],
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select().from(goals).orderBy(asc(goals.id));
    set({ goals: rows as GoalRow[], loaded: true });
  },

  add: async (input) => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .insert(goals)
      .values({ ...input, createdAt: now })
      .returning({ id: goals.id });
    const id = res[0].id;
    set({ goals: [...get().goals, { id, ...input, createdAt: now }] });
    return id;
  },
  update: async (id, patch) => {
    const db = await getDb();
    await db.update(goals).set(patch).where(eq(goals.id, id));
    set({ goals: get().goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  },

  remove: async (id) => {
    const db = await getDb();
    await db.delete(goals).where(eq(goals.id, id));
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },
}));

/**
 * goalPercent 已移到 src/core/goals.ts（纯函数 + 单测）。
 * 这里保留 re-export，避免已有的 `from '../features/goals/goalsStore'` 引用断掉。
 */
export { goalPercent } from '../../core/goals';
