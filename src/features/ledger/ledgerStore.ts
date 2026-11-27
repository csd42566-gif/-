/**
 * 流水 store（v2）：流水 CRUD + 按天分组 + 月统计。
 * 全部操作落 SQLite；写后调 accounts.recalc 重算余额。
 * 删除转账：双腿同删（只删一腿会让另一腿无对冲，总余额漂移——验收 4）。
 */

import { create } from 'zustand';

import { accounts, transactions } from '../../data/schema';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { useAccountsStore } from '../accounts/accountsStore';
import { openDatabase } from '../../data/db';
import type { FeiyuDatabase } from '../../data/db';

export type { DayGroup } from '../../core/ledger/grouping';
export type TransactionKind = 'expense' | 'income' | 'transfer';

export interface TransactionInput {
  kind: TransactionKind;
  /** expense/income 恒为正；transfer 转出腿为负、转入腿为正。 */
  amountCents: number;
  currency: string;
  categoryId: number | null;
  accountId: number;
  /** 转账另一腿的交易 id（双腿互指）。 */
  relatedId: number | null;
  /** epoch 秒。 */
  occurredAt: number;
  note: string;
}

export interface TransactionRow extends TransactionInput {
  id: number;
  createdAt: number;
  updatedAt: number;
}

interface LedgerState {
  transactions: TransactionRow[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: TransactionInput) => Promise<number>;
  /** 转账专用：一次写两腿（转出负、转入正），返回 [转出腿 id, 转入腿 id]。 */
  addTransfer: (input: {
    amountCents: number;
    currency: string;
    fromAccountId: number;
    toAccountId: number;
    occurredAt: number;
    note: string;
  }) => Promise<[number, number]>;
  update: (id: number, patch: Partial<TransactionInput>) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

let dbPromise: Promise<FeiyuDatabase> | null = null;
function getDb(): Promise<FeiyuDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export const useLedgerStore = create<LedgerState>()((set, get) => ({
  transactions: [],
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select().from(transactions).orderBy(desc(transactions.occurredAt));
    set({ transactions: rows as TransactionRow[], loaded: true });
  },

  add: async (input) => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .insert(transactions)
      .values({ ...input, createdAt: now, updatedAt: now })
      .returning({ id: transactions.id });
    const id = res[0].id;
    set({ transactions: [{ id, ...input, createdAt: now, updatedAt: now }, ...get().transactions] });
    await useAccountsStore.getState().recalc(db);
    return id;
  },

  addTransfer: async (input) => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    // 先插转出腿（负），拿 id；再插转入腿（正），relatedId 互指。
    const outRes = await db
      .insert(transactions)
      .values({
        kind: 'transfer',
        amountCents: -input.amountCents,
        currency: input.currency,
        categoryId: null,
        accountId: input.fromAccountId,
        relatedId: null,
        occurredAt: input.occurredAt,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: transactions.id });
    const outId = outRes[0].id;
    const inRes = await db
      .insert(transactions)
      .values({
        kind: 'transfer',
        amountCents: input.amountCents,
        currency: input.currency,
        categoryId: null,
        accountId: input.toAccountId,
        relatedId: outId,
        occurredAt: input.occurredAt,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: transactions.id });
    const inId = inRes[0].id;
    await db.update(transactions).set({ relatedId: inId }).where(eq(transactions.id, outId));
    await useLedgerStore.getState().load();
    await useAccountsStore.getState().recalc(db);
    return [outId, inId];
  },

  update: async (id, patch) => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(transactions)
      .set({ ...patch, updatedAt: now })
      .where(eq(transactions.id, id));
    set({
      transactions: get().transactions.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: now } : t,
      ),
    });
    await useAccountsStore.getState().recalc(db);
  },

  remove: async (id) => {
    const db = await getDb();
    const target = get().transactions.find((t) => t.id === id);
    // 转账双腿同删：只删一腿会让另一腿无对冲，总余额漂移（验收 4）。
    const idsToDelete = new Set<number>([id]);
    if (target?.kind === 'transfer' && target.relatedId != null) {
      idsToDelete.add(target.relatedId);
    }
    await db.delete(transactions).where(inArray(transactions.id, [...idsToDelete]));
    set({ transactions: get().transactions.filter((t) => !idsToDelete.has(t.id)) });
    await useAccountsStore.getState().recalc(db);
  },
}));

/** selector：从 store 拿某月流水（epoch 秒区间），避免整表订阅。 */
export function selectTransactionsByRange(state: LedgerState, from: number, to: number): TransactionRow[] {
  return state.transactions.filter((t) => t.occurredAt >= from && t.occurredAt < to);
}
