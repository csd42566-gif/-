import { createInitialLedgerState } from '../../data/initialState';
import { buildBackupFileName, createClearedLedgerState } from './escape';

test('清空后的 state 等于 createInitialLedgerState()', () => {
  expect(createClearedLedgerState()).toEqual(createInitialLedgerState());
});

test('备份文件名使用本地时间格式', () => {
  expect(buildBackupFileName(new Date(2026, 9, 18, 7, 8, 9))).toBe('shenfa-backup-20261018-070809.json');
});