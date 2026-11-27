/**
 * 首开引导 store（v2）：一次性引导完成标记 + 初始余额落库 + 种子分类落库。
 * 完成状态存 app_meta（SQLite），种子数据落 categories / accounts。
 * 幂等：种子只在分类表为空时落；引导完成标记与初始余额可重复覆盖（账户管理里也能改初始余额）。
 *
 * 种子里子类的 parentId 是「指向顶级分类的种子下标」（0 = 吃饭），不是数据库 id。
 * 落库必须按插入顺序建「种子下标 → 真实 id」映射再回填，直接拿下标当 parentId 会撞外键。
 */

import { create } from 'zustand';

import { count, eq } from 'drizzle-orm';
import { buildSeedCategories, SEED_ACCOUNTS } from '../../core/seeds';
import type { SeedCategory } from '../../core/seeds';
import { openDatabase } from '../../data/db';
import { accounts, appMeta, categories } from '../../data/schema';
import type { FeiyuDatabase } from '../../data/db';

const ONBOARDING_DONE_KEY = 'onboarding_done';

interface OnboardingState {
  /** null = 未加载；true = 已过引导；false = 首开待引导。 */
  done: boolean | null;
  loading: boolean;
  /** 检查 app_meta 的完成标记。 */
  checkDone: () => Promise<void>;
  /** 引导完成：落种子分类 + 三账户初始余额 + 完成标记。跳过时不传 balances。 */
  completeOnboarding: (balances?: Array<{ name: string; initialBalanceCents: number }>) => Promise<void>;
  /** 跳过引导：同样落种子分类与三账户，只是初始余额全为 0。 */
  skipOnboarding: () => Promise<void>;
  /** 直接写完成标记（恢复备份后调用，跳过余额与种子落库）。 */
  markOnboardingDone: () => Promise<void>;
}

let dbPromise: Promise<FeiyuDatabase> | null = null;
function getDb(): Promise<FeiyuDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

/** 分类表为空时落全套种子分类；子类的相对 parentId 换成真实 id。 */
async function seedCategoriesIfEmpty(db: FeiyuDatabase): Promise<void> {
  const existing = await db.select({ n: count() }).from(categories);
  if (existing[0].n > 0) return;

  const { categories: seedRows } = buildSeedCategories();
  const idBySeedIndex = new Map<number, number>();
  for (let i = 0; i < seedRows.length; i += 1) {
    const c: SeedCategory = seedRows[i];
    const isTop = c.parentId === null;
    const parentId = isTop ? null : idBySeedIndex.get(c.parentId as number) ?? null;
    const inserted = await db
      .insert(categories)
      .values({
        kind: c.kind,
        parentId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
      })
      .returning({ id: categories.id });
    if (isTop) idBySeedIndex.set(i, inserted[0].id);
  }
}

/** 三个默认账户不存在时补建（余额取 balanceFor 的结果）。 */
async function seedAccountsIfMissing(
  db: FeiyuDatabase,
  balanceFor: (name: string) => number,
): Promise<void> {
  const accountRows = await db.select().from(accounts);
  const now = Math.floor(Date.now() / 1000);
  for (const seed of SEED_ACCOUNTS) {
    if (accountRows.some((a) => a.name === seed.name)) continue;
    await db.insert(accounts).values({
      name: seed.name,
      icon: seed.icon,
      color: seed.color,
      initialBalanceCents: balanceFor(seed.name),
      initialCurrency: seed.initialCurrency,
      enabled: true,
      createdAt: now,
    });
  }
}

/** 写引导完成标记（幂等）。 */
async function markDone(db: FeiyuDatabase): Promise<void> {
  await db
    .insert(appMeta)
    .values({ key: ONBOARDING_DONE_KEY, value: '1' })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: '1' } });
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  done: null,
  loading: false,

  checkDone: async () => {
    const db = await getDb();
    const rows = await db
      .select({ value: appMeta.value })
      .from(appMeta)
      .where(eq(appMeta.key, ONBOARDING_DONE_KEY));
    set({ done: rows.length > 0 && rows[0].value === '1' });
  },

  completeOnboarding: async (balances) => {
    const db = await getDb();
    await seedCategoriesIfEmpty(db);
    const balanceFor = (name: string) =>
      balances?.find((b) => b.name === name)?.initialBalanceCents ??
      SEED_ACCOUNTS.find((s) => s.name === name)?.initialBalanceCents ??
      0;
    await seedAccountsIfMissing(db, balanceFor);
    // 已存在的账户按名字覆盖初始余额（引导可重复进入补填）。
    if (balances && balances.length > 0) {
      const accountRows = await db.select().from(accounts);
      for (const b of balances) {
        const hit = accountRows.find((a) => a.name === b.name);
        if (!hit) continue;
        await db
          .update(accounts)
          .set({ initialBalanceCents: b.initialBalanceCents })
          .where(eq(accounts.id, hit.id));
      }
    }
    await markDone(db);
    set({ done: true });
  },

  /** 跳过引导：仍然落种子分类与三账户（余额 0）——
   *  否则记账表单没有分类可挑、没有账户可选，App 直接不可用。 */
  skipOnboarding: async () => {
    const db = await getDb();
    await seedCategoriesIfEmpty(db);
    const zeroFor = (name: string) =>
      SEED_ACCOUNTS.find((s) => s.name === name)?.initialBalanceCents ?? 0;
    await seedAccountsIfMissing(db, zeroFor);
    await markDone(db);
    set({ done: true });
  },

  markOnboardingDone: async () => {
    const db = await getDb();
    await markDone(db);
    set({ done: true });
  },
}));
