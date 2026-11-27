/**
 * 账户 store（v2）：账户 CRUD + 余额派生。
 * 余额不落库——由流水（含初始余额）派生，见 src/core/balance.ts。
 * 余额符号规则：收入加、支出减、转账腿带符号直接累加（expense 存正数，必须减）。
 */

import { create } from 'zustand';

import { accountBalanceCents } from '../../core/balance';
import type { CurrencyCode } from '../../core/currency';
import { openDatabase } from '../../data/db';
import { accounts, transactions } from '../../data/schema';
import { asc, eq } from 'drizzle-orm';
import type { FeiyuDatabase } from '../../data/db';

export interface AccountRow {
  id: number;
  name: string;
  icon: string;
  color: string;
  initialBalanceCents: number;
  initialCurrency: CurrencyCode;
  enabled: boolean;
  createdAt: number;
}

export interface AccountWithBalance extends AccountRow {
  balanceCents: number;
}

interface AccountsState {
  accounts: AccountWithBalance[];
  loaded: boolean;
  load: () => Promise<void>;
  addAccount: (input: {
    name: string;
    icon: string;
    color: string;
    initialBalanceCents: number;
    initialCurrency: CurrencyCode;
  }) => Promise<number>;
  renameAccount: (id: number, patch: Partial<Pick<AccountRow, 'name' | 'icon' | 'color'>>) => Promise<void>;
  /** 对账修正：改初始余额基准（决策：不直接改当前余额）。 */
  setInitialBalance: (id: number, initialBalanceCents: number) => Promise<void>;
  setEnabled: (id: number, enabled: boolean) => Promise<void>;
  removeAccount: (id: number) => Promise<void>;
  /** 全量重算所有账户余额（流水变化后调用）。 */
  recalc: (db: FeiyuDatabase) => Promise<void>;
}

function rowToAccount(row: typeof accounts.$inferSelect): AccountRow {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    initialBalanceCents: row.initialBalanceCents,
    initialCurrency: row.initialCurrency as CurrencyCode,
    enabled: row.enabled,
    createdAt: row.createdAt,
  };
}

let dbPromise: Promise<FeiyuDatabase> | null = null;
function getDb(): Promise<FeiyuDatabase> {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export const useAccountsStore = create<AccountsState>()((set, get) => ({
  accounts: [],
  loaded: false,

  load: async () => {
    const db = await getDb();
    const rows = await db.select().from(accounts).orderBy(asc(accounts.id));
    const txRows = await db
      .select({
        accountId: transactions.accountId,
        amountCents: transactions.amountCents,
        kind: transactions.kind,
        relatedId: transactions.relatedId,
      })
      .from(transactions);
    const list = rows.map((r) => {
      const base = rowToAccount(r);
      return {
        ...base,
        balanceCents: accountBalanceCents(
          { id: base.id, initialBalanceCents: base.initialBalanceCents },
          txRows,
        ),
      };
    });
    set({ accounts: list, loaded: true });
  },

  addAccount: async (input) => {
    const db = await getDb();
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .insert(accounts)
      .values({
        name: input.name,
        icon: input.icon,
        color: input.color,
        initialBalanceCents: input.initialBalanceCents,
        initialCurrency: input.initialCurrency,
        enabled: true,
        createdAt: now,
      })
      .returning({ id: accounts.id });
    const id = res[0].id;
    const newAccount: AccountWithBalance = {
      id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      initialBalanceCents: input.initialBalanceCents,
      initialCurrency: input.initialCurrency,
      enabled: true,
      createdAt: now,
      balanceCents: input.initialBalanceCents,
    };
    set({ accounts: [...get().accounts, newAccount] });
    return id;
  },

  renameAccount: async (id, patch) => {
    const db = await getDb();
    await db.update(accounts).set(patch).where(eq(accounts.id, id));
    set({
      accounts: get().accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  },

  setEnabled: async (id, enabled) => {
    const db = await getDb();
    await db.update(accounts).set({ enabled }).where(eq(accounts.id, id));
    set({
      accounts: get().accounts.map((a) => (a.id === id ? { ...a, enabled } : a)),
    });
  },

  setInitialBalance: async (id, initialBalanceCents) => {
    const db = await getDb();
    await db
      .update(accounts)
      .set({ initialBalanceCents })
      .where(eq(accounts.id, id));
    await useAccountsStore.getState().recalc(db);
  },

  removeAccount: async (id) => {
    const db = await getDb();
    await db.delete(accounts).where(eq(accounts.id, id));
    set({ accounts: get().accounts.filter((a) => a.id !== id) });
  },

  recalc: async (db) => {
    const txRows = await db
      .select({
        accountId: transactions.accountId,
        amountCents: transactions.amountCents,
        kind: transactions.kind,
        relatedId: transactions.relatedId,
      })
      .from(transactions);
    set({
      accounts: get().accounts.map((a) => ({
        ...a,
        balanceCents: accountBalanceCents(
          { id: a.id, initialBalanceCents: a.initialBalanceCents },
          txRows,
        ),
      })),
    });
  },
}));
