import { normalizeLedgerState } from './normalize';

describe('ledger state migration', () => {
  test('fills settings introduced after the first local schema without losing user data', () => {
    const legacyState = {
      accounts: [{ id: 'cash', name: 'Cash', kind: 'cash', balance: 420 }],
      transactions: [],
      debts: [],
      goal: null,
      settings: { riskCardMode: 'always', reminderMode: 'strict' },
    };

    expect(normalizeLedgerState(legacyState)).toEqual({
      ...legacyState,
      pendingTransactions: [],
      attendance: [],
      settings: expect.objectContaining({
        riskCardMode: 'always',
        reminderMode: 'strict',
        monthlyIncome: expect.any(Number),
        essentialMonthlyExpenses: expect.any(Number),
        essentialItems: expect.any(Array),
        workDaysPerMonth: expect.any(Number),
        workHoursPerDay: expect.any(Number),
        strictMode: expect.any(Boolean),
        repaymentReminders: expect.any(Boolean),
        reducedMotion: expect.any(Boolean),
        motionLevel: 'enhanced',
        hapticsEnabled: true,
        providerIconStyle: 'logo',
        accountMapping: {},
        billSource: 'notification',
      }),
    });
  });
  test('defaults a missing detected-transaction queue when loading a legacy ledger', () => {
    const normalized = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null });
    expect(normalized.pendingTransactions).toEqual([]);
  });

  test('migrates legacy probationEndDate to regularStartDate', () => {
    const normalized = normalizeLedgerState({
      accounts: [],
      transactions: [],
      debts: [],
      goal: null,
      settings: { work: { probationEndDate: '2026-11-10' } },
    });

    expect(normalized.settings.work.regularStartDate).toBe('2026-11-10');
    expect(normalized.settings.work.probationStartDate).toBeUndefined();
    expect(normalized.settings.work).not.toHaveProperty('probationEndDate');
  });

  test('normalizes loose work date keys before storing them', () => {
    const normalized = normalizeLedgerState({
      accounts: [], transactions: [], debts: [], goal: null,
      settings: { work: { probationStartDate: '2026-1-1', regularStartDate: '20260110' } },
    });

    expect(normalized.settings.work.probationStartDate).toBe('2026-01-01');
    expect(normalized.settings.work.regularStartDate).toBe('2026-01-10');
  });

  test('migrates legacy goal progress and debt repayment mode', () => {
    const normalized = normalizeLedgerState({
      accounts: [{ id: 'cash', name: 'Cash', kind: 'cash', balance: 1000 }],
      transactions: [{ id: 'income', type: 'income', amount: 200, accountId: 'cash', occurredAt: '2026-01-01T00:00:00.000Z', source: 'manual' }],
      debts: [{ id: 'debt', name: '信用卡', amount: 500, dueDate: '2026-10-20', kind: 'credit' }],
      goal: { id: 'goal', name: 'Target', targetAmount: 1000, savedAmount: 100, deadline: '2026-12-31' },
    });

    expect(normalized.goal).toMatchObject({ startBalance: 700, startBalanceAt: '1970-01-01T00:00:00.000Z' });
    expect(normalized.debts[0].repaymentMode).toBe('minimum');
  });

  test('falls back to logo icons when the saved icon style is invalid', () => {
    const normalized = normalizeLedgerState({
      accounts: [], transactions: [], debts: [], goal: null,
      settings: { providerIconStyle: 'invalid' },
    });

    expect(normalized.settings.providerIconStyle).toBe('logo');
  });
  test('migrates legacy essential monthly expenses into an Other item', () => {
    const normalized = normalizeLedgerState({
      accounts: [], transactions: [], debts: [], goal: null,
      settings: { essentialMonthlyExpenses: 1500 },
    });

    expect(normalized.settings.essentialItems).toEqual([{ id: 'legacy-other', name: '其他', amount: 1500 }]);
    expect(normalized.settings.essentialMonthlyExpenses).toBe(1500);
  });

  test('uses essential item details as the source of the monthly total', () => {
    const normalized = normalizeLedgerState({
      accounts: [], transactions: [], debts: [], goal: null,
      settings: {
        essentialMonthlyExpenses: 999,
        essentialItems: [
          { id: 'food', name: '吃', amount: 20 },
          { id: 'video', name: '视频会员', amount: 25 },
        ],
      },
    });

    expect(normalized.settings.essentialItems).toHaveLength(2);
    expect(normalized.settings.essentialMonthlyExpenses).toBe(45);
  });

  test('migrates balanced and light reminder modes to normal', () => {
    const balanced = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { reminderMode: 'balanced' } });
    const light = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { reminderMode: 'light' } });
    expect(balanced.settings.reminderMode).toBe('normal');
    expect(light.settings.reminderMode).toBe('normal');
  });

  test('migrates legacy strictMode under normal into strict', () => {
    const normalized = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { reminderMode: 'normal', strictMode: true } });
    expect(normalized.settings.reminderMode).toBe('strict');
  });

  test('migrates reducedMotion into motionLevel and preserves explicit levels', () => {
    const reduced = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { reducedMotion: true } });
    const full = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { reducedMotion: false } });
    const superLevel = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { motionLevel: 'super', reducedMotion: true } });
    expect(reduced.settings.motionLevel).toBe('standard');
    expect(full.settings.motionLevel).toBe('enhanced');
    expect(superLevel.settings.motionLevel).toBe('super');
  });

  test('defaults haptics on for old data and preserves an explicit opt-out', () => {
    const legacy = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null });
    const disabled = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { hapticsEnabled: false } });

    expect(legacy.settings.hapticsEnabled).toBe(true);
    expect(disabled.settings.hapticsEnabled).toBe(false);
  });

  test('sanitizes account mapping and drops invalid entries', () => {
    const normalized = normalizeLedgerState({
      accounts: [], transactions: [], debts: [], goal: null,
      settings: { accountMapping: { '支付宝 · 储蓄卡': 'cash', '': 'bad', '微信': 42 } },
    });

    expect(normalized.settings.accountMapping).toEqual({ '支付宝 · 储蓄卡': 'cash' });
  });

  test('cleans duplicate and invalid account display order values', () => {
    const normalized = normalizeLedgerState({
      accounts: [],
      transactions: [],
      debts: [],
      goal: null,
      settings: { accountDisplayOrder: ['alipay', '', 'alipay', 42, 'wechat'] },
    });

    expect(normalized.settings.accountDisplayOrder).toEqual(['alipay', 'wechat']);
  });

  test('keeps valid repayment metadata and removes unsafe event values', () => {
    const normalized = normalizeLedgerState({
      accounts: [],
      transactions: [],
      pendingTransactions: [
        { id: 'repayment', type: 'expense', amount: 120, source: 'notification', occurredAt: '2026-10-17T08:00:00.000Z', confidence: 0.9, eventKind: 'repayment', eventStatus: 'success', provider: '花呗', debtId: 'debt-1', counterparty: '张三' },
        { id: 'unsafe', type: 'expense', amount: 10, source: 'notification', occurredAt: '2026-10-17T08:00:00.000Z', confidence: 0.5, eventKind: 'execute-code', eventStatus: 'unknown', provider: 'x'.repeat(300) },
      ],
      debts: [],
      goal: null,
    });

    expect(normalized.pendingTransactions[0]).toMatchObject({ eventKind: 'repayment', eventStatus: 'success', provider: '花呗', debtId: 'debt-1', counterparty: '张三' });
    expect(normalized.pendingTransactions[1]).not.toHaveProperty('eventKind');
    expect(normalized.pendingTransactions[1]).not.toHaveProperty('eventStatus');
    expect(normalized.pendingTransactions[1].provider).toHaveLength(80);
  });
});
test('normalizes billSource and preserves pending source and external key', () => {
  const normalized = normalizeLedgerState({
    accounts: [],
    transactions: [],
    debts: [],
    goal: null,
    pendingTransactions: [{
      id: 'auto-1', type: 'expense', amount: 12.3, occurredAt: '2026-10-20T01:02:00.000Z',
      source: 'autoaccounting', externalKey: 'ORDER-1', confidence: 1,
    }],
    settings: { billSource: 'both' },
  });
  const invalid = normalizeLedgerState({ accounts: [], transactions: [], debts: [], goal: null, settings: { billSource: 'unknown' } });

  expect(normalized.settings.billSource).toBe('both');
  expect(normalized.pendingTransactions[0]).toMatchObject({ source: 'autoaccounting', externalKey: 'ORDER-1' });
  expect(invalid.settings.billSource).toBe('notification');
});
