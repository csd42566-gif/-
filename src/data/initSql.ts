/**
 * 建库 DDL（v2）：与 src/data/schema.ts 的 drizzle 表定义一一对应。
 * 单一事实源是 schema.ts——改表结构时两处同步改，并保证字段名一致。
 * 不用 drizzle-kit（避免新增依赖）；drizzle 只做查询构建，建表走这份手写 DDL。
 */

export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  initial_currency TEXT NOT NULL DEFAULT 'CNY',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
  parent_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  category_id INTEGER REFERENCES categories(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  related_id INTEGER REFERENCES transactions(id),
  occurred_at INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CNY',
  created_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
-- 老库补列：CREATE TABLE IF NOT EXISTS 对已存在的表不生效，
-- 所以 due_at / note 必须用 ALTER 补；SQLite 没有 IF NOT EXISTS 的 ADD COLUMN，
-- 靠 db.ts 的 applyColumnMigrations 先查 PRAGMA table_info 再决定加不加。
CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
`;
