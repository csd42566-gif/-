import { defaultSettings, LedgerState } from '../core/model/finance';

export function createInitialLedgerState(): LedgerState {
  return {
    accounts: [],
    transactions: [],
    pendingTransactions: [],
    debts: [],
    goal: null,
    attendance: [],
    settings: { ...defaultSettings },
  };
}
