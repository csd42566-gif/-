import { defaultSettings, LedgerState } from '../core/model/finance';

export function normalizeLedgerState(value: unknown): LedgerState {
  if (!value || typeof value !== 'object') throw new Error('ledger-state-invalid');
  const state = value as Partial<LedgerState>;
  return {
    accounts: Array.isArray(state.accounts) ? state.accounts : [],
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    pendingTransactions: Array.isArray(state.pendingTransactions) ? state.pendingTransactions : [],
    debts: Array.isArray(state.debts) ? state.debts : [],
    goal: state.goal ?? null,
    settings: { ...defaultSettings, ...(state.settings ?? {}) },
  };
}
