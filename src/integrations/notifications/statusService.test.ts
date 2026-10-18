import { createInitialLedgerState } from '../../data/initialState';
import { buildStatusNotificationPayload, formatStatusNotificationText } from './statusService';

test('从派生财务数据生成三列通知载荷', () => {
  const state = {
    ...createInitialLedgerState(),
    accounts: [{ id: 'bank', name: '银行卡', kind: 'bank' as const, balance: 1200 }],
    goal: {
      id: 'goal',
      name: '目标',
      targetAmount: 2000,
      startBalance: 0,
      startBalanceAt: '2026-01-01T00:00:00.000Z',
      deadline: '2026-12-31',
    },
  };
  const payload = buildStatusNotificationPayload(state, new Date(2026, 9, 18, 12));
  expect(payload).toEqual({ saved: '1200.00', targetRemaining: '800.00', monthGap: '0.00' });
});

test('通知正文使用已存、目标还差、本月缺口三列', () => {
  expect(formatStatusNotificationText({ saved: '1200.00', targetRemaining: '800.00', monthGap: '0.00' }))
    .toBe('已存 ¥1200.00 ｜ 目标还差 ¥800.00 ｜ 本月缺口 ¥0.00');
});