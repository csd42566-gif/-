import { LedgerState } from '../../core/model/finance';
import { createInitialLedgerState } from '../../data/initialState';

export function createClearedLedgerState(): LedgerState {
  return createInitialLedgerState();
}

export function buildBackupFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `shenfa-backup-${day}-${time}.json`;
}