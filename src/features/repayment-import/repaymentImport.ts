import { LedgerState, PendingTransaction } from '../../core/model/finance';
import { queueDetectedTransaction } from '../ledger/ledger';
import { parseRepaymentText, ParsedRepayment, RepaymentProvider, repaymentProviderLabels } from './parsers';
import { InstallmentDraft, toInstallmentPlan } from './installments';

export interface ImportRepaymentResult {
  state: LedgerState;
  candidate: PendingTransaction;
  duplicate: boolean;
}

export interface ImportInstallmentResult extends ImportRepaymentResult {
  debtId: string;
}

// 对规范化文本做 djb2 哈希，保证同一内容重复导入得到同一个 ID
function hashText(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

function toPendingTransaction(parsed: ParsedRepayment, text: string): PendingTransaction {
  const fingerprint = hashText(`${parsed.provider}|${parsed.amount}|${parsed.occurredAt}|${text.replace(/\s+/g, '')}`);
  return {
    id: `import_${parsed.provider}_${fingerprint}`,
    type: 'expense',
    amount: parsed.amount,
    occurredAt: parsed.occurredAt,
    note: parsed.note,
    source: 'import',
    confidence: parsed.confidence,
    eventKind: parsed.eventKind,
    eventStatus: parsed.eventStatus,
    provider: repaymentProviderLabels[parsed.provider],
    counterparty: parsed.counterparty,
  };
}

export function previewRepaymentText(provider: RepaymentProvider, text: string, importedAt?: string): PendingTransaction {
  return toPendingTransaction(parseRepaymentText(provider, text, importedAt), text);
}

export function importRepaymentText(state: LedgerState, provider: RepaymentProvider, text: string, importedAt?: string): ImportRepaymentResult {
  const candidate = previewRepaymentText(provider, text, importedAt);
  const next = queueDetectedTransaction(state, candidate);
  return { state: next, candidate, duplicate: next === state };
}

export function importInstallmentRepayment(
  state: LedgerState,
  provider: RepaymentProvider,
  draft: InstallmentDraft,
): ImportInstallmentResult {
  const plan = toInstallmentPlan(draft);
  const currentPeriod = plan.periods[0];
  if (!currentPeriod) throw new Error('installment-data-invalid');
  const existingDebt = state.debts.find((debt) => debt.name === draft.debtName);
  const debtId = existingDebt?.id ?? `debt_${hashText(draft.debtName)}`;
  const debt = {
    id: debtId,
    name: draft.debtName,
    amount: plan.remainingPrincipal,
    dueDate: currentPeriod.dueDate,
    minimumPayment: currentPeriod.totalAmount,
    kind: 'loan' as const,
    repaymentMode: existingDebt?.repaymentMode ?? 'minimum',
    installment: plan,
  };
  const debts = existingDebt
    ? state.debts.map((item) => item.id === debtId ? debt : item)
    : [...state.debts, debt];
  const candidate: PendingTransaction = {
    id: `import_installment_${provider}_${hashText(`${draft.debtName}|${currentPeriod.dueDate}|${currentPeriod.totalAmount}|${plan.remainingPrincipal}`)}`,
    type: 'expense',
    amount: currentPeriod.totalAmount,
    occurredAt: `${currentPeriod.dueDate}T00:00:00.000+08:00`,
    note: `${draft.debtName} 第${plan.paidPeriods + 1}/${plan.totalPeriods}期，本金 ¥${currentPeriod.principalAmount.toFixed(2)}，利息 ¥${currentPeriod.interestAmount.toFixed(2)}`,
    source: 'import',
    confidence: 1,
    eventKind: 'repayment',
    eventStatus: 'success',
    provider: repaymentProviderLabels[provider],
    counterparty: draft.debtName,
    debtId,
    principalAmount: currentPeriod.principalAmount,
    interestAmount: currentPeriod.interestAmount,
    installmentNumber: plan.paidPeriods + 1,
    installmentCount: plan.totalPeriods,
  };
  const next = queueDetectedTransaction({ ...state, debts }, candidate);
  return { state: next, candidate, duplicate: next.pendingTransactions === state.pendingTransactions, debtId };
}
