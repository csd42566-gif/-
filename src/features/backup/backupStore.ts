/**
 * 加密备份 store（v2 决策 38）：导出加密备份 + 导入恢复。
 * 密钥派生：SHA-256(用户密码)，AES-256-GCM 加密 payload；格式见 src/core/backup.ts。
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import {
  buildEnvelope,
  parseBackupEnvelope,
  serializePayload,
  splitCipher,
  validatePayload,
  type BackupPayload,
} from '../../core/backup';
import { openDatabase } from '../../data/db';
import { accounts, categories, transactions } from '../../data/schema';
import { useAccountsStore } from '../accounts/accountsStore';
import { useCategoriesStore } from '../categories/categoriesStore';
import { useLedgerStore } from '../ledger/ledgerStore';
import { useOnboardingStore } from '../onboarding/onboardingStore';

const BACKUP_FILE_NAME = 'feiyu-ledger-backup.json';

/** 用户密码 → 32 字节 AES 密钥（SHA-256 派生）。 */
async function deriveKey(password: string): Promise<Crypto.AESEncryptionKey> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return Crypto.AESEncryptionKey.import(digest, 'hex');
}

/** 收集当前库三表快照为 payload。 */
export async function buildPayload(): Promise<BackupPayload> {
  const db = await openDatabase();
  const [accountRows, categoryRows, transactionRows] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(transactions),
  ]);
  return {
    exportedAt: Math.floor(Date.now() / 1000),
    accounts: accountRows.map((a) => ({ ...a, enabled: a.enabled })),
    categories: categoryRows.map((c) => ({ ...c })),
    transactions: transactionRows.map((t) => ({ ...t })),
  };
}

/** 导出：提示用户输入密码 → 加密 → 写 cache → 分享。成功返回 true，用户取消导出返回 false。 */
export async function exportEncryptedBackup(password: string): Promise<boolean> {
  const payload = await buildPayload();
  const key = await deriveKey(password);
  const plaintext = serializePayload(payload);
  // plaintext 需 base64（BinaryInput 的 string 必须是 base64）
  const plaintextB64 = encodeBase64(plaintext);
  const sealed = await Crypto.aesEncryptAsync(plaintextB64, key, { nonce: { length: 12 }, tagLength: 16 });
  const ivB64 = (await sealed.iv('base64')) as string;
  const ctB64 = (await sealed.ciphertext({ includeTag: true, encoding: 'base64' })) as string;
  const envelope = buildEnvelope(`${ivB64}.${ctB64}`);
  const file = new FileSystem.File(FileSystem.Paths.cache, BACKUP_FILE_NAME);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(envelope), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  } else {
    throw new Error('当前设备不支持分享，请改用 CSV 导出');
  }
  return true;
}

/** 选文件 + 读文本 + 解密 + 语义校验，返回 payload。 */
export async function importEncryptedBackup(password: string): Promise<BackupPayload> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error('未选择文件');
  }
  const asset = result.assets[0];
  const text = await new FileSystem.File(asset.uri).text();
  const envelope = parseBackupEnvelope(text);
  const { ivB64, ctB64 } = splitCipher(envelope.cipher);
  const key = await deriveKey(password);
  const sealed = Crypto.AESSealedData.fromParts(ivB64, ctB64, 16);
  const plaintextB64 = (await Crypto.aesDecryptAsync(sealed, key, { output: 'base64' })) as string;
  const plaintext = decodeBase64(plaintextB64);
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error('密码错误或备份文件损坏');
  }
  return validatePayload(parsed);
}

/** 把备份 payload 写回本地库（覆盖当前数据）。 */
export async function restorePayload(payload: BackupPayload): Promise<void> {
  const db = await openDatabase();
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  const now = Math.floor(Date.now() / 1000);
  for (const a of payload.accounts) {
    await db.insert(accounts).values({
      id: a.id,
      name: a.name,
      icon: a.icon,
      color: a.color,
      initialBalanceCents: a.initialBalanceCents,
      initialCurrency: a.initialCurrency,
      enabled: a.enabled,
      createdAt: a.createdAt,
    });
  }
  for (const c of payload.categories) {
    await db.insert(categories).values({
      id: c.id,
      kind: c.kind,
      parentId: c.parentId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
    });
  }
  for (const t of payload.transactions) {
    await db.insert(transactions).values({
      id: t.id,
      kind: t.kind,
      amountCents: t.amountCents,
      currency: t.currency,
      categoryId: t.categoryId,
      accountId: t.accountId,
      relatedId: t.relatedId,
      occurredAt: t.occurredAt,
      note: t.note,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt ?? now,
    });
  }
  await useAccountsStore.getState().load();
  await useCategoriesStore.getState().load();
  await useLedgerStore.getState().load();
  await useOnboardingStore.getState().markOnboardingDone();
}

// ---- base64 辅助（UTF-8 安全，处理中文 payload） ----

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return globalThis.btoa(binary);
}

function decodeBase64(b64: string): string {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
