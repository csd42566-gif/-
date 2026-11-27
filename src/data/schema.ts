/**
 * drizzle schema（v2）：4 表 + 索引。
 * 金额一律整数分（amount_cents），币种存在交易行。
 * 余额永不落库，从流水派生（见 src/core/balance.ts）。
 */

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  color: text('color').notNull().default(''),
  initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
  initialCurrency: text('initial_currency').notNull().default('CNY'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  parentId: integer('parent_id').references((): AnySQLiteColumn => categories.id),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  color: text('color').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['expense', 'income', 'transfer'] }).notNull(),
  /** expense/income 恒为正；transfer 转出腿为负、转入腿为正。 */
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('CNY'),
  categoryId: integer('category_id').references((): AnySQLiteColumn => categories.id),
  accountId: integer('account_id').notNull().references((): AnySQLiteColumn => accounts.id),
  relatedId: integer('related_id').references((): AnySQLiteColumn => transactions.id),
  occurredAt: integer('occurred_at').notNull(), // epoch 秒（本地记账，记当天零点或时刻均可）
  note: text('note').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * 储蓄目标：纯记录账本之外的「想攒的钱」，不挂账户、不动流水。
 * 已存金额由用户手填（存入/取出时改这个数），所以是独立一列而非派生。
 */
export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetCents: integer('target_cents').notNull(),
  savedCents: integer('saved_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  createdAt: integer('created_at').notNull(),
  /** 到期日（epoch 秒）。0 表示没设，卡片上不显示。 */
  dueAt: integer('due_at').notNull().default(0),
  /** 一句话备注（「攒一台相机」这种动机说明）。空串表示没写。 */
  note: text('note').notNull().default(''),
});

export const txOccurredIdx = sql`CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at)`;
export const txAccountIdx = sql`CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id)`;
export const txCategoryIdx = sql`CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)`;
