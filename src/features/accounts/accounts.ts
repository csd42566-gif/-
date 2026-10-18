import { Account, AccountKind } from '../../core/model/finance';

export function createAccount(
  draft: { name: string; kind: AccountKind; balance: number },
  id = `account_${Date.now().toString(36)}`,
): Account {
  const name = draft.name.trim();
  if (!name) throw new Error('account-name-invalid');
  if (!Number.isFinite(draft.balance) || (draft.kind !== 'credit' && draft.balance < 0)) throw new Error('account-balance-invalid');
  return { id, name, kind: draft.kind, balance: draft.balance };
}

export function setAccountBalance(account: Account, balance: number): Account {
  if (!Number.isFinite(balance) || (account.kind !== 'credit' && balance < 0)) {
    throw new Error('account-balance-invalid');
  }
  return { ...account, balance };
}
