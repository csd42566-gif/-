import { accountBalanceCents, totalBalanceCents, totalBalanceByCurrencyCents } from './balance';
import type { AccountLike, TransactionLike } from './balance';

const wx: AccountLike = { id: 1, initialBalanceCents: 100000 }; // ¥1,000
const card: AccountLike = { id: 2, initialBalanceCents: 500000 }; // ¥5,000
const cash: AccountLike = { id: 3, initialBalanceCents: 0 };

describe('余额派生（流水累加，永不落库）', () => {
  test('支出减少账户余额', () => {
    const txs: TransactionLike[] = [
      { kind: 'expense', amountCents: 5000, accountId: 1, relatedId: null },
    ];
    expect(accountBalanceCents(wx, txs)).toBe(95000);
  });

  test('收入增加账户余额', () => {
    const txs: TransactionLike[] = [
      { kind: 'income', amountCents: 800000, accountId: 2, relatedId: null },
    ];
    expect(accountBalanceCents(card, txs)).toBe(1300000);
  });

  test('转账：带符号两腿、总余额不变', () => {
    const txs: TransactionLike[] = [
      { kind: 'transfer', amountCents: -200000, accountId: 2, relatedId: 2 },
      { kind: 'transfer', amountCents: 200000, accountId: 1, relatedId: 1 },
    ];
    const before = totalBalanceCents([wx, card], []);
    const after = totalBalanceCents([wx, card], txs);
    expect(accountBalanceCents(card, txs)).toBe(300000);
    expect(accountBalanceCents(wx, txs)).toBe(300000);
    expect(after).toBe(before);
  });

  test('允许负余额（信用卡）', () => {
    const txs: TransactionLike[] = [
      { kind: 'expense', amountCents: 7000, accountId: 3, relatedId: null },
    ];
    expect(accountBalanceCents(cash, txs)).toBe(-7000);
  });

  test('总余额按币种分组', () => {
    const txs: (TransactionLike & { currency: string })[] = [
      { kind: 'expense', amountCents: 5000, accountId: 1, relatedId: null, currency: 'CNY' },
      { kind: 'expense', amountCents: 2000, accountId: 1, relatedId: null, currency: 'USD' },
    ];
    const byCurrency = totalBalanceByCurrencyCents([wx], txs);
    expect(byCurrency['CNY']).toBe(95000);
    expect(byCurrency['USD']).toBe(-2000);
  });
});
