import { LedgerState, PendingTransaction, Transaction } from '../../core/model/finance';

export type DraftTransaction = Pick<Transaction, 'type' | 'amount' | 'accountId'>
  & Partial<Pick<Transaction, 'toAccountId' | 'category' | 'budgetGroup' | 'note' | 'eventKind' | 'eventStatus' | 'provider' | 'debtId' | 'counterparty' | 'principalAmount' | 'interestAmount' | 'installmentNumber' | 'installmentCount' | 'externalKey'>>;

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

export function applyImportedTransactions(state: LedgerState, imported: Transaction[]): LedgerState {
  if (imported.length === 0) return state;
  const knownIds = new Set(state.transactions.map((transaction) => transaction.id));
  const knownExternalKeys = new Set(state.transactions.map((transaction) => transaction.externalKey).filter((key): key is string => !!key));
  const accepted: Transaction[] = [];
  for (const transaction of imported) {
    if (knownIds.has(transaction.id)) continue;
    if (transaction.externalKey && knownExternalKeys.has(transaction.externalKey)) continue;
    accepted.push(transaction);
    knownIds.add(transaction.id);
    if (transaction.externalKey) knownExternalKeys.add(transaction.externalKey);
  }
  if (accepted.length === 0) return state;
  const accounts = state.accounts.map((account) => {
    let balance = account.balance;
    for (const transaction of accepted) {
      if (transaction.type === 'expense' && transaction.accountId === account.id) balance -= transaction.amount;
      if (transaction.type === 'income' && transaction.accountId === account.id) balance += transaction.amount;
      if (transaction.type === 'transfer' && transaction.accountId === account.id) balance -= transaction.amount;
      if (transaction.type === 'transfer' && transaction.toAccountId === account.id) balance += transaction.amount;
    }
    return balance === account.balance ? account : { ...account, balance: Math.round(balance * 100) / 100 };
  });
  return { ...state, accounts, transactions: [...accepted, ...state.transactions] };
}

export function queueDetectedTransaction(state: LedgerState, candidate: PendingTransaction): LedgerState {
  const fingerprint = transactionFingerprint(candidate, false);
  const alreadyKnown = state.pendingTransactions.some((item) => transactionFingerprint(item, false) === fingerprint)
    || state.transactions.some((item) => item.source === candidate.source && transactionFingerprint(item, false) === fingerprint);
  if (alreadyKnown) return state;
  return { ...state, pendingTransactions: [candidate, ...state.pendingTransactions] };
}

export function reviewDetectedTransaction(
  state: LedgerState,
  id: string,
  action: 'accept' | 'dismiss',
  edits: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category' | 'note' | 'debtId' | 'counterparty' | 'principalAmount' | 'interestAmount' | 'installmentNumber' | 'installmentCount'>> = {},
): LedgerState {
  const candidate = state.pendingTransactions.find((item) => item.id === id);
  if (!candidate) return state;
  if (action === 'dismiss') return { ...state, pendingTransactions: state.pendingTransactions.filter((item) => item.id !== id) };

  const accepted: PendingTransaction = { ...candidate, ...edits };
  if (accepted.eventStatus && accepted.eventStatus !== 'success') throw new Error('detected-event-not-postable');
  if (accepted.eventKind === 'repayment-reminder' || accepted.eventKind === 'repayment-failed') throw new Error('detected-event-not-postable');
  if (!accepted.accountId || !state.accounts.some((account) => account.id === accepted.accountId)) throw new Error('transaction-account-invalid');
  const isRepayment = accepted.eventKind === 'repayment' || accepted.eventKind === 'proxy-repayment';
  const debt = isRepayment ? state.debts.find((item) => item.id === accepted.debtId) : undefined;
  if (isRepayment && !debt) throw new Error('repayment-debt-invalid');
  const principalAmount = accepted.principalAmount ?? accepted.amount;
  const next = recordTransaction(state, {
    type: accepted.type,
    amount: accepted.amount,
    accountId: accepted.accountId,
    category: accepted.category ?? (isRepayment ? '还款' : undefined),
    note: accepted.note,
    eventKind: accepted.eventKind,
    eventStatus: accepted.eventStatus,
    provider: accepted.provider,
    debtId: accepted.debtId,
    counterparty: accepted.counterparty,
    principalAmount: accepted.principalAmount,
    interestAmount: accepted.interestAmount,
    installmentNumber: accepted.installmentNumber,
    installmentCount: accepted.installmentCount,
  });
  const transaction = { ...next.transactions[0], occurredAt: accepted.occurredAt, source: accepted.source };
  const debts = debt ? state.debts.map((item) => {
    if (item.id !== debt.id) return item;
    const remainingPrincipal = Math.max(0, item.amount - principalAmount);
    if (!item.installment) return { ...item, amount: remainingPrincipal };
    const periods = item.installment.periods.slice(1);
    return {
      ...item,
      amount: remainingPrincipal,
      dueDate: periods[0]?.dueDate ?? item.dueDate,
      minimumPayment: periods[0]?.totalAmount,
      installment: {
        ...item.installment,
        remainingPrincipal,
        paidPeriods: Math.min(item.installment.totalPeriods, item.installment.paidPeriods + 1),
        periods,
      },
    };
  }) : state.debts;
  return { ...next, debts, transactions: [transaction, ...state.transactions], pendingTransactions: state.pendingTransactions.filter((item) => item.id !== id) };
}

function transactionFingerprint(transaction: Pick<Transaction, 'type' | 'amount' | 'occurredAt'> & { accountId?: string; note?: string }, includeAccount = true): string {
  const occurred = new Date(transaction.occurredAt);
  const minute = Number.isNaN(occurred.getTime()) ? transaction.occurredAt.slice(0, 16) : occurred.toISOString().slice(0, 16);
  return [transaction.type, transaction.amount.toFixed(2), minute, transaction.note ?? '', includeAccount ? transaction.accountId ?? '' : ''].join('|');
}
