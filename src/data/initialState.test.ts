import { createInitialLedgerState } from './initialState';

describe('initial ledger state', () => {
  test('starts empty with default settings', () => {
    expect(createInitialLedgerState().settings.reminderMode).toBe('punish');
    expect(createInitialLedgerState()).toEqual({
      accounts: [],
      transactions: [],
      pendingTransactions: [],
      debts: [],
      goal: null,
      attendance: [],
      settings: expect.objectContaining({ monthlyIncome: expect.any(Number) }),
    });
  });
});
