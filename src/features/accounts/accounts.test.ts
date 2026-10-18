import { createAccount, setAccountBalance } from './accounts';

describe('account creation', () => {
  test('creates a user-named account with the chosen kind and opening balance', () => {
    expect(createAccount({ name: 'Daily cash', kind: 'cash', balance: 0 }, 'account-1')).toEqual({
      id: 'account-1',
      name: 'Daily cash',
      kind: 'cash',
      balance: 0,
    });
  });

  test('rejects empty names and invalid balances', () => {
    expect(() => createAccount({ name: ' ', kind: 'bank', balance: 0 })).toThrow('account-name-invalid');
    expect(() => createAccount({ name: 'Bank', kind: 'bank', balance: -1 })).toThrow('account-balance-invalid');
  });

  test('allows a negative opening balance for an existing credit-card liability', () => {
    expect(createAccount({ name: 'Credit card', kind: 'credit', balance: -250 }, 'credit-1').balance).toBe(-250);
  });

  test('updates an account balance without changing its identity or kind', () => {
    const account = { id: 'bank-1', name: 'Main bank', kind: 'bank' as const, balance: 120 };

    expect(setAccountBalance(account, 250)).toEqual({ ...account, balance: 250 });
  });

  test('rejects negative balances for non-credit accounts', () => {
    const account = { id: 'cash-1', name: 'Cash', kind: 'cash' as const, balance: 120 };

    expect(() => setAccountBalance(account, -1)).toThrow('account-balance-invalid');
  });

  test('allows a negative balance for credit accounts', () => {
    const account = { id: 'credit-1', name: 'Credit card', kind: 'credit' as const, balance: 0 };

    expect(setAccountBalance(account, -320).balance).toBe(-320);
  });
});
