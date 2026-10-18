import { Account } from '../../core/model/finance';
import { appendAccountId, moveAccountId, orderAccounts } from './accountOrder';

const accounts: Account[] = [
  { id: 'other', name: '得物余额', kind: 'wallet', balance: 300 },
  { id: 'bank', name: '银行卡', kind: 'bank', balance: 5000 },
  { id: 'wechat', name: '微信', kind: 'wallet', balance: 1200 },
  { id: 'cash', name: '现金', kind: 'cash', balance: 200 },
  { id: 'alipay', name: '支付宝', kind: 'wallet', balance: 1800 },
];

describe('account display order', () => {
  test('uses the requested provider order for first-time display', () => {
    expect(orderAccounts(accounts, []).map((account) => account.id)).toEqual([
      'alipay', 'wechat', 'bank', 'cash', 'other',
    ]);
  });

  test('keeps the saved order and appends a new account', () => {
    const ordered = orderAccounts(accounts, ['other', 'cash', 'wechat']);
    expect(ordered.map((account) => account.id)).toEqual([
      'other', 'cash', 'wechat', 'alipay', 'bank',
    ]);
  });

  test('moves a dragged account to the target position', () => {
    expect(moveAccountId(['alipay', 'wechat', 'bank'], 'bank', 'alipay')).toEqual([
      'bank', 'alipay', 'wechat',
    ]);
  });

  test('ignores an unknown drag target', () => {
    expect(moveAccountId(['alipay', 'wechat'], 'wechat', 'missing')).toEqual([
      'alipay', 'wechat',
    ]);
  });

  test('appends a newly created account after the existing display order', () => {
    expect(appendAccountId(accounts.slice(1, 4), [], 'alipay')).toEqual([
      'wechat', 'bank', 'cash', 'alipay',
    ]);
  });
});
