import {
  BACKUP_MAGIC,
  BACKUP_VERSION,
  buildEnvelope,
  joinCipher,
  parseBackupEnvelope,
  serializePayload,
  splitCipher,
  validatePayload,
  type BackupPayload,
} from './backup';

const payload: BackupPayload = {
  exportedAt: 1732000000,
  accounts: [
    { id: 1, name: '微信', icon: '', color: '', initialBalanceCents: 0, initialCurrency: 'CNY', enabled: true, createdAt: 1731000000 },
  ],
  categories: [
    { id: 1, kind: 'expense', parentId: null, name: '吃饭', icon: '🍚', color: '#F5A524', sortOrder: 0 },
  ],
  transactions: [
    { id: 1, kind: 'expense', amountCents: 1600, currency: 'CNY', categoryId: 1, accountId: 1, relatedId: null, occurredAt: 1731000000, note: '午饭', createdAt: 1731000000, updatedAt: 1731000000 },
  ],
};

describe('serializePayload', () => {
  it('序列化可逆', () => {
    const text = serializePayload(payload);
    expect(validatePayload(JSON.parse(text)).transactions).toHaveLength(1);
  });
});

describe('buildEnvelope / parseBackupEnvelope', () => {
  it('正常往返', () => {
    const env = buildEnvelope('a.b');
    const parsed = parseBackupEnvelope(JSON.stringify(env));
    expect(parsed.magic).toBe(BACKUP_MAGIC);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.cipher).toBe('a.b');
  });

  it('magic 不对拒绝', () => {
    expect(() => parseBackupEnvelope('{"magic":"OTHER","version":1,"cipher":"a.b"}')).toThrow(
      '不是肥鱼的米饭备份文件',
    );
  });

  it('版本不支持拒绝', () => {
    expect(() => parseBackupEnvelope(JSON.stringify({ magic: BACKUP_MAGIC, version: 99, cipher: 'a.b' }))).toThrow(
      '备份版本 99 不受支持',
    );
  });

  it('缺 cipher 拒绝', () => {
    expect(() => parseBackupEnvelope(JSON.stringify({ magic: BACKUP_MAGIC, version: 1 }))).toThrow(
      '备份文件缺少加密数据',
    );
  });

  it('非 JSON 拒绝', () => {
    expect(() => parseBackupEnvelope('not json')).toThrow('备份文件不是有效 JSON');
  });
});

describe('cipher split/join', () => {
  it('拆分与合并互逆', () => {
    const cipher = joinCipher('aGVsbG8=', 'd29ybGQ=');
    const { ivB64, ctB64 } = splitCipher(cipher);
    expect(ivB64).toBe('aGVsbG8=');
    expect(ctB64).toBe('d29ybGQ=');
    expect(joinCipher(ivB64, ctB64)).toBe(cipher);
  });

  it('无分隔符时报格式损坏', () => {
    expect(() => splitCipher('nodot')).toThrow('备份数据格式损坏');
  });
});

describe('validatePayload', () => {
  it('合法 payload 通过', () => {
    expect(validatePayload(payload).accounts).toHaveLength(1);
  });

  it('缺数组拒绝', () => {
    expect(() => validatePayload({ exportedAt: 1, accounts: [], categories: [] })).toThrow('备份内容缺少流水');
  });

  it('账户字段不完整拒绝', () => {
    expect(() =>
      validatePayload({ exportedAt: 1, accounts: [{ id: 1 }], categories: [], transactions: [] }),
    ).toThrow('备份内容里的账户字段不完整');
  });

  it('分类字段不完整拒绝', () => {
    expect(() =>
      validatePayload({ exportedAt: 1, accounts: [], categories: [{ id: 1, name: 'x' }], transactions: [] }),
    ).toThrow('备份内容里的分类字段不完整');
  });

  it('流水字段不完整拒绝', () => {
    expect(() =>
      validatePayload({ exportedAt: 1, accounts: [], categories: [], transactions: [{ id: 1 }] }),
    ).toThrow('备份内容里的流水字段不完整');
  });
});
