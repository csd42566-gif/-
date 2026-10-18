import { LedgerState } from '../../core/model/finance';
import { queueDetectedTransaction } from '../../features/ledger/ledger';
import { NativeNotificationEvent, normalizeNotificationCandidate } from './parser';

export function mergeNotificationCandidates(state: LedgerState, events: NativeNotificationEvent[]): LedgerState {
  return events.reduce((current, event) => {
    const candidate = normalizeNotificationCandidate(event);
    return candidate ? queueDetectedTransaction(current, candidate) : current;
  }, state);
}
