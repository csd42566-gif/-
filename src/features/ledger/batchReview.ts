import { LedgerState, PendingTransaction } from '../../core/model/finance';
import { reviewDetectedTransaction } from './ledger';

export type BatchSelectionState = 'none' | 'partial' | 'all';
export interface BatchFailure { id: string; label: string; reason: string }
export interface BatchReviewResult { state: LedgerState; successCount: number; failures: BatchFailure[] }

export function isBatchablePending(item: PendingTransaction): boolean {
  return !!item.accountId && item.eventKind !== 'repayment';
}

export function batchSelectionState(eligibleIds: string[], selectedIds: Set<string>): BatchSelectionState {
  if (eligibleIds.length === 0) return 'none';
  const selectedCount = eligibleIds.filter((id) => selectedIds.has(id)).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === eligibleIds.length) return 'all';
  return 'partial';
}

export function selectedBatchSummary(items: PendingTransaction[], selectedIds: Set<string>): { count: number; expense: number; income: number } {
  return items.filter((item) => selectedIds.has(item.id)).reduce((summary, item) => {
    summary.count += 1;
    if (item.type === 'expense') summary.expense += item.amount;
    if (item.type === 'income') summary.income += item.amount;
    return summary;
  }, { count: 0, expense: 0, income: 0 });
}

export function reviewPendingBatch(state: LedgerState, selectedIds: Set<string>): BatchReviewResult {
  let next = state;
  let successCount = 0;
  const failures: BatchFailure[] = [];
  for (const id of selectedIds) {
    const item = state.pendingTransactions.find((candidate) => candidate.id === id);
    if (!item) continue;
    if (!isBatchablePending(item)) {
      failures.push({ id, label: pendingLabel(item), reason: batchBlockedReason(item) });
      continue;
    }
    try {
      next = reviewDetectedTransaction(next, id, 'accept');
      const created = next.transactions[0];
      const existingIds = new Set(next.transactions.slice(1).map((transaction) => transaction.id));
      if (existingIds.has(created.id)) {
        let suffix = successCount + 1;
        let uniqueId = created.id + '_batch_' + suffix;
        while (existingIds.has(uniqueId)) {
          suffix += 1;
          uniqueId = created.id + '_batch_' + suffix;
        }
        next = { ...next, transactions: [{ ...created, id: uniqueId }, ...next.transactions.slice(1)] };
      }
      successCount += 1;
    } catch (error) {
      failures.push({ id, label: pendingLabel(item), reason: failureReason(error) });
    }
  }
  return { state: next, successCount, failures };
}

export function batchBlockedReason(item: PendingTransaction): string {
  if (!item.accountId) return '需选择账户';
  if (item.eventKind === 'repayment') return '需选择欠款后确认';
  return '该记录不可批量确认';
}

function pendingLabel(item: PendingTransaction): string {
  return item.provider ? `${item.provider} · ${item.category ?? item.type}` : item.category ?? item.id;
}

function failureReason(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'transaction-account-invalid') return '需选择账户';
  if (code === 'repayment-debt-invalid') return '需选择欠款后确认';
  if (code === 'detected-event-not-postable') return '该识别记录不可入账';
  return code || '入账失败';
}