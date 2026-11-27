/**
 * 加密备份格式层（v2 决策 38）：与 schema.ts 三表字段一一对齐的快照。
 * 本文件只定义格式与校验，不碰 IO、不碰加密原语（jest node 环境可测）。
 * 加密原语在 features/backup/backupStore.ts 用 expo-crypto AES-GCM + SHA-256 密码派生。
 */

export const BACKUP_MAGIC = 'FEIYU-BACKUP';
export const BACKUP_VERSION = 1;

export interface BackupAccount {
  id: number;
  name: string;
  icon: string;
  color: string;
  initialBalanceCents: number;
  initialCurrency: string;
  enabled: boolean;
  createdAt: number;
}

export interface BackupCategory {
  id: number;
  kind: 'expense' | 'income';
  parentId: number | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface BackupTransaction {
  id: number;
  kind: 'expense' | 'income' | 'transfer';
  amountCents: number;
  currency: string;
  categoryId: number | null;
  accountId: number;
  relatedId: number | null;
  occurredAt: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

/** 备份明文载荷：三表快照。 */
export interface BackupPayload {
  exportedAt: number;
  accounts: BackupAccount[];
  categories: BackupCategory[];
  transactions: BackupTransaction[];
}

/** 备份文件外层（落盘的 JSON）。 */
export interface BackupEnvelope {
  magic: typeof BACKUP_MAGIC;
  version: number;
  /** AES-256-GCM：base64(iv) + '.' + base64(ciphertext+tag)。 */
  cipher: string;
}

export function buildEnvelope(cipher: string): BackupEnvelope {
  return { magic: BACKUP_MAGIC, version: BACKUP_VERSION, cipher };
}

export function serializePayload(payload: BackupPayload): string {
  return JSON.stringify(payload);
}

export function parseBackupEnvelope(text: string): BackupEnvelope {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('备份文件不是有效 JSON');
  }
  if (typeof data !== 'object' || data === null) throw new Error('备份文件内容不是对象');
  const env = data as Partial<BackupEnvelope>;
  if (env.magic !== BACKUP_MAGIC) throw new Error('不是肥鱼的米饭备份文件');
  if (env.version !== BACKUP_VERSION) throw new Error(`备份版本 ${env.version} 不受支持`);
  if (typeof env.cipher !== 'string' || env.cipher === '') throw new Error('备份文件缺少加密数据');
  return { magic: env.magic, version: env.version, cipher: env.cipher };
}

/** 把 cipher 拆成 iv 与密文（base64）。 */
export function splitCipher(cipher: string): { ivB64: string; ctB64: string } {
  const dot = cipher.indexOf('.');
  if (dot <= 0) throw new Error('备份数据格式损坏');
  return { ivB64: cipher.slice(0, dot), ctB64: cipher.slice(dot + 1) };
}

export function joinCipher(ivB64: string, ctB64: string): string {
  return `${ivB64}.${ctB64}`;
}

/** 解密后 payload 的语义校验（防错文件/截断/字段缺失），返回规范化后的 BackupPayload。 */
export function validatePayload(value: unknown): BackupPayload {
  if (typeof value !== 'object' || value === null) throw new Error('备份内容不是对象');
  const p = value as Partial<BackupPayload>;
  if (typeof p.exportedAt !== 'number') throw new Error('备份内容缺少导出时间');
  if (!Array.isArray(p.accounts)) throw new Error('备份内容缺少账户');
  if (!Array.isArray(p.categories)) throw new Error('备份内容缺少分类');
  if (!Array.isArray(p.transactions)) throw new Error('备份内容缺少流水');
  for (const a of p.accounts as unknown[]) {
    const acc = a as Partial<BackupAccount>;
    if (typeof acc.id !== 'number' || typeof acc.name !== 'string' || typeof acc.initialBalanceCents !== 'number') {
      throw new Error('备份内容里的账户字段不完整');
    }
  }
  for (const c of p.categories as unknown[]) {
    const cat = c as Partial<BackupCategory>;
    if (typeof cat.id !== 'number' || typeof cat.name !== 'string' || (cat.kind !== 'expense' && cat.kind !== 'income')) {
      throw new Error('备份内容里的分类字段不完整');
    }
  }
  for (const t of p.transactions as unknown[]) {
    const tx = t as Partial<BackupTransaction>;
    if (typeof tx.id !== 'number' || typeof tx.amountCents !== 'number' || typeof tx.accountId !== 'number') {
      throw new Error('备份内容里的流水字段不完整');
    }
  }
  return p as BackupPayload;
}
