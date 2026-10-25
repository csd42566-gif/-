import { LedgerState, Transaction } from '../../core/model/finance';
import { roundMoney } from '../../core/finance/money';

export interface BalanceReconcileEntry {
  accountId: string;
  actualValue: number;
}

export interface BalanceReconciliationSummary {
  occurredAt: string;
  totalAdjustment: number;
}

export function reconcileAccountBalances(
  state: LedgerState,
  entries: BalanceReconcileEntry[],
  now = new Date(),
): LedgerState {
  const entriesByAccount = new Map(entries.map((entry) => [entry.accountId, entry]));
  const adjustments: Transaction[] = [];
  const accounts = state.accounts.map((account, index) => {
    const entry = entriesByAccount.get(account.id);
    if (!entry) return account;
    if (!Number.isFinite(entry.actualValue) || entry.actualValue < 0) throw new Error('account-reconcile-value-invalid');
    const actualBalance = account.kind === 'credit' && entry.actualValue !== 0 ? -Math.abs(entry.actualValue) : entry.actualValue;
    const difference = roundMoney(actualBalance - account.balance);
    if (difference === 0) return account;
    const recordedDisplay = account.kind === 'credit' ? Math.abs(account.balance) : account.balance;
    const actualDisplay = account.kind === 'credit' ? Math.abs(entry.actualValue) : entry.actualValue;
    const label = account.kind === 'credit' ? '欠款' : '余额';
    adjustments.push({
      id: `reconcile_${account.id}_${now.getTime()}_${index}`,
      type: difference > 0 ? 'income' : 'expense',
      amount: Math.abs(difference),
      accountId: account.id,
      category: '余额校准',
      note: `校准：记录${label} ${formatMoney(recordedDisplay)} → 实际${label} ${formatMoney(actualDisplay)}`,
      occurredAt: now.toISOString(),
      source: 'manual',
    });
    return { ...account, balance: actualBalance };
  });
  if (adjustments.length === 0) return state;
  return { ...state, accounts, transactions: [...adjustments, ...state.transactions] };
}

export function lastBalanceReconciliation(state: LedgerState): BalanceReconciliationSummary | null {
  const adjustments = state.transactions.filter((transaction) => transaction.category === '余额校准');
  if (adjustments.length === 0) return null;
  const latest = adjustments.reduce((current, transaction) => (
    new Date(transaction.occurredAt).getTime() > new Date(current.occurredAt).getTime() ? transaction : current
  ));
  const latestTime = new Date(latest.occurredAt).getTime();
  const batch = adjustments.filter((transaction) => new Date(transaction.occurredAt).getTime() === latestTime);
  const totalAdjustment = batch.reduce((sum, transaction) => sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0);
  return { occurredAt: latest.occurredAt, totalAdjustment: roundMoney(totalAdjustment) };
}

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}