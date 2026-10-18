import { Account } from '../../core/model/finance';

export function calculateExistingSavings(accounts: Account[]): number {
  return accounts.reduce((total, account) => {
    if (account.kind === 'credit') return total;
    return total + Math.max(0, account.balance);
  }, 0);
}
