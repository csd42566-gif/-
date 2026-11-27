/**
 * 余额派生（v2）：余额永不落库，永远从流水逐笔累加派生。
 * 规则：balance = initial + Σ收入 − Σ支出 + Σ转账（带符号腿）
 * 转账采用「带符号两腿」模型：转出腿 amount 为负、转入腿 amount 为正，
 * 两腿 relatedId 互指、|amount| 相等，总余额不变。
 * 允许负余额（信用卡场景），只展示不惩罚。
 */

export interface AccountLike {
  id: number;
  initialBalanceCents: number;
}

export interface TransactionLike {
  kind: 'expense' | 'income' | 'transfer';
  /** expense/income 恒为正；transfer 转出腿为负、转入腿为正。 */
  amountCents: number;
  /** 该腿影响的账户（转账两腿各挂各的账户）。 */
  accountId: number;
  /** 转账另一腿的流水 id；普通交易为 null。 */
  relatedId: number | null;
}

/** 单账户余额：初始 + 收入 − 支出 + 转账腿（带符号直接累加）。 */
export function accountBalanceCents(
  account: AccountLike,
  transactions: TransactionLike[],
): number {
  let balance = account.initialBalanceCents;
  for (const tx of transactions) {
    if (tx.accountId !== account.id) continue;
    if (tx.kind === 'expense') {
      balance -= tx.amountCents;
    } else if (tx.kind === 'income') {
      balance += tx.amountCents;
    } else {
      balance += tx.amountCents; // transfer：腿自带符号
    }
  }
  return balance;
}

/** 所有账户总余额。转账正负腿抵消，总值不变。 */
export function totalBalanceCents(
  accounts: AccountLike[],
  transactions: TransactionLike[],
): number {
  return accounts.reduce(
    (sum, account) => sum + accountBalanceCents(account, transactions),
    0,
  );
}

/** 按币种分组的总余额（初始余额按账户声明币种归组，默认 CNY）。 */
export function totalBalanceByCurrencyCents(
  accounts: (AccountLike & { initialCurrency?: string })[],
  transactions: (TransactionLike & { currency: string })[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const account of accounts) {
    const currency = account.initialCurrency ?? 'CNY';
    result[currency] = (result[currency] ?? 0) + account.initialBalanceCents;
  }
  for (const tx of transactions) {
    if (tx.kind === 'expense') {
      result[tx.currency] = (result[tx.currency] ?? 0) - tx.amountCents;
    } else if (tx.kind === 'income') {
      result[tx.currency] = (result[tx.currency] ?? 0) + tx.amountCents;
    }
    // transfer 两腿同币种、正负抵消，不改变币种总余额，无需处理
  }
  return result;
}
