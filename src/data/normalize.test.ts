import { normalizeLedgerState } from './normalize';

describe('ledger state migration', () => {
  test('fills settings introduced after the first local schema without losing user data', () => {
    const legacyState = {
      accounts: [{ id: 'cash', name: 'Cash', kind: 'cash', balance: 420 }],
      transactions: [],
      debts: [],
      goal: null,
      settings: { riskCardMode: 'always', reminderMode: 'strict' },
    };

    expect(normalizeLedgerState(legacyState)).toEqual({
      ...legacyState,
      pendingTransactions: [],
      settings: expect.objectContaining({
        riskCardMode: 'always',
        reminderMode: 'strict',
        monthlyIncome: expect.any(Number),
        essentialMonthlyExpenses: expect.any(Number),
        workDaysPerMonth: expect.any(Number),
        workHoursPerDay: expect.any(Number),
        strictMode: expect.any(Boolean),
        repaymentReminders: expect.any(Boolean),
        reducedMotion: expect.any(Boolean),
      }),
    });
  });
  test('defaults a missing detected-transaction queue when loading a legacy ledger', () => {
    const normalized = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null });
    expect(normalized.pendingTransactions).toEqual([]);
  });
});
