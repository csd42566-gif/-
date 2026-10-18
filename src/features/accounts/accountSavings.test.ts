import { Account } from '../../core/model/finance';
import { calculateExistingSavings } from './accountSavings';

describe('existing savings', () => {
  test('sums cash, bank and wallet balances while excluding credit accounts', () => {
    const accounts: Account[] = [
      { id: 'alipay', name: 'Alipay', kind: 'wallet', balance: 1800 },
      { id: 'wechat', name: 'WeChat', kind: 'wallet', balance: 1200 },
      { id: 'bank', name: 'Bank', kind: 'bank', balance: 5000 },
      { id: 'cash', name: 'Cash', kind: 'cash', balance: 200 },
      { id: 'credit', name: 'Credit', kind: 'credit', balance: -600 },
    ];

    expect(calculateExistingSavings(accounts)).toBe(8200);
  });

  test('does not turn invalid negative non-credit balances into savings', () => {
    const accounts: Account[] = [
      { id: 'legacy-bank', name: 'Legacy Bank', kind: 'bank', balance: -100 },
      { id: 'wallet', name: 'Wallet', kind: 'wallet', balance: 50 },
    ];

    expect(calculateExistingSavings(accounts)).toBe(50);
  });
});
