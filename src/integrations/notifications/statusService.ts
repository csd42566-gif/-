import { LedgerState } from '../../core/model/finance';
import { deriveFinancials } from '../../core/finance/derive';

export interface StatusNotificationPayload {
  saved: string;
  targetRemaining: string;
  monthGap: string;
}

export function buildStatusNotificationPayload(state: LedgerState, now = new Date()): StatusNotificationPayload {
  const financials = deriveFinancials(state, now);
  return {
    saved: financials.goalSaved.toFixed(2),
    targetRemaining: financials.goalRemaining.toFixed(2),
    monthGap: financials.shortfall.toFixed(2),
  };
}

export function formatStatusNotificationText(payload: StatusNotificationPayload): string {
  return `已存 ¥${payload.saved} ｜ 目标还差 ¥${payload.targetRemaining} ｜ 本月缺口 ¥${payload.monthGap}`;
}