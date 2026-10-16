import { calculateGoalPlan } from '../../core/finance/calculations';
import { LedgerState, PendingTransaction, Transaction } from '../../core/model/finance';

export type DraftTransaction = Pick<Transaction, 'type' | 'amount' | 'accountId'>
  & Partial<Pick<Transaction, 'toAccountId' | 'category' | 'budgetGroup' | 'note'>>;

export function recordTransaction(state: LedgerState, draft: DraftTransaction): LedgerState {
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) throw new Error('transaction-amount-invalid');
  if (!state.accounts.some((account) => account.id === draft.accountId)) throw new Error('transaction-account-invalid');
  if (draft.type === 'transfer' && (!draft.toAccountId || draft.toAccountId === draft.accountId || !state.accounts.some((account) => account.id === draft.toAccountId))) throw new Error('transaction-transfer-account-invalid');
  const id = `tx_${Date.now().toString(36)}`;
  const transaction: Transaction = { ...draft, id, occurredAt: new Date().toISOString(), source: 'manual' };
  const accounts = state.accounts.map((account) => {
    if (account.id !== draft.accountId && !(draft.type === 'transfer' && account.id === draft.toAccountId)) return account;
    const delta = draft.type === 'income' ? draft.amount : draft.type === 'expense' ? -draft.amount : 0;
    const transferDelta = draft.type === 'transfer' ? (account.id === draft.accountId ? -draft.amount : draft.amount) : 0;
    return { ...account, balance: account.balance + delta + transferDelta };
  });
  return { ...state, accounts, transactions: [transaction, ...state.transactions] };
}

export function queueDetectedTransaction(state: LedgerState, candidate: PendingTransaction): LedgerState {
  const fingerprint = transactionFingerprint(candidate);
  const alreadyKnown = state.pendingTransactions.some((item) => transactionFingerprint(item) === fingerprint)
    || state.transactions.some((item) => transactionFingerprint(item) === fingerprint);
  if (alreadyKnown) return state;
  return { ...state, pendingTransactions: [candidate, ...state.pendingTransactions] };
}

export function reviewDetectedTransaction(
  state: LedgerState,
  id: string,
  action: 'accept' | 'dismiss',
  edits: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category' | 'note'>> = {},
): LedgerState {
  const candidate = state.pendingTransactions.find((item) => item.id === id);
  if (!candidate) return state;
  const pendingTransactions = state.pendingTransactions.filter((item) => item.id !== id);
  if (action === 'dismiss') return { ...state, pendingTransactions };

  const accepted: PendingTransaction = { ...candidate, ...edits };
  const next = recordTransaction(state, accepted);
  const transaction = { ...next.transactions[0], occurredAt: accepted.occurredAt, source: accepted.source };
  return { ...next, transactions: [transaction, ...state.transactions], pendingTransactions };
}

export function summarizeTransactionImpact(state: LedgerState, draft: DraftTransaction) {
  const next = recordTransaction(state, draft);
  const account = next.accounts.find((item) => item.id === draft.accountId);
  const goal = state.goal;
  return { amount: draft.amount, remainingBalance: account?.balance ?? 0, dailySave: goal ? calculateGoalPlan(goal).dailySave : 0 };
}

function transactionFingerprint(transaction: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'occurredAt'>): string {
  const occurred = new Date(transaction.occurredAt);
  const minute = Number.isNaN(occurred.getTime()) ? transaction.occurredAt.slice(0, 16) : occurred.toISOString().slice(0, 16);
  return `${transaction.type}|${transaction.accountId}|${transaction.amount.toFixed(2)}|${minute}`;
}
