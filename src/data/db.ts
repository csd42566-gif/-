/**
 * db（v2）：expo-sqlite + drizzle，SQLCipher 加密。
 * 密钥由 SecureStore 保管；首次启动生成随机 raw key 并落地。
 * PRAGMA key 必须在任何查询前执行。
 */

import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import * as schema from './schema';
import { INIT_SQL } from './initSql';

const DB_NAME = 'feiyu-ledger.db';
const KEY_STORE_KEY = 'feiyu-db-key-v1';

export type FeiyuDatabase = ReturnType<typeof drizzle<typeof schema>>;

let dbPromise: Promise<FeiyuDatabase> | null = null;

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORE_KEY);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  // 只存纯 hex，PRAGMA key 时再包成 "x'...'"（SQLCipher 要求 raw key 用引号包裹）。
  await SecureStore.setItemAsync(KEY_STORE_KEY, hex);
  return hex;
}

/** 真正的打开逻辑，串成单一 Promise 避免并发重复初始化（多 store 同时 load 会并发调用 openDatabase）。 */
async function doOpen(): Promise<FeiyuDatabase> {
  const sqlite = await SQLite.openDatabaseAsync(DB_NAME);
  const key = await getOrCreateKey();
  // SQLCipher raw key：必须以 "x'hex'" 双引号包裹的字符串传入，裸 x'...' 是 SQLite blob 字面量会语法错误。
  await sqlite.execAsync(`PRAGMA key = "x'${key}'"`);
  await sqlite.execAsync('PRAGMA foreign_keys = ON');
  await sqlite.execAsync('PRAGMA journal_mode = WAL');
  await sqlite.execAsync(INIT_SQL);
  await applyColumnMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

/**
 * 给已存在的老表补新列。
 *
 * `CREATE TABLE IF NOT EXISTS` 对已建好的表完全不管用，所以在 initSql 里加列只会创建新库时生效；
 * 已经装过 App 的机器得靠这里 ALTER。SQLite 的 ADD COLUMN 不支持 IF NOT EXISTS，
 * 只能先 PRAGMA table_info 查一遍再决定加不加。
 */
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  { table: 'goals', column: 'due_at', ddl: 'ALTER TABLE goals ADD COLUMN due_at INTEGER NOT NULL DEFAULT 0' },
  { table: 'goals', column: 'note', ddl: "ALTER TABLE goals ADD COLUMN note TEXT NOT NULL DEFAULT ''" },
];

async function applyColumnMigrations(sqlite: SQLite.SQLiteDatabase): Promise<void> {
  for (const m of COLUMN_MIGRATIONS) {
    const info = await sqlite.getAllAsync<{ name: string }>(`PRAGMA table_info(${m.table})`);
    if (info.some((c) => c.name === m.column)) continue;
    await sqlite.execAsync(m.ddl);
  }
}

/** 打开（或创建）加密数据库。返回 drizzle 实例。共享同一个 Promise，避免并发重复初始化。 */
export async function openDatabase(): Promise<FeiyuDatabase> {
  if (!dbPromise) {
    dbPromise = doOpen().catch((err) => {
      dbPromise = null; // 失败后允许重试
      throw err;
    });
  }
  return dbPromise;
}

/** 测试/重置用：清空全部业务表。 */
export async function resetDatabase(db: FeiyuDatabase): Promise<void> {
  await db.delete(schema.transactions);
  await db.delete(schema.categories);
  await db.delete(schema.accounts);
  await db.delete(schema.appMeta);
}
