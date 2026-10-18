import { defaultSettings, LedgerState } from '../../core/model/finance';
import { reviewDetectedTransaction } from '../ledger/ledger';
import { importInstallmentRepayment, importRepaymentText } from './repaymentImport';
import { createInstallmentDraft } from './installments';

const baseState: LedgerState = {
  accounts: [{ id: 'cash', name: '现金', kind: 'cash', balance: 500 }],
  transactions: [],
  pendingTransactions: [],
  debts: [{ id: 'debt-1', name: '花呗', amount: 200, dueDate: '2026-10-25', kind: 'credit', repaymentMode: 'minimum' }],
  goal: null,
  settings: { ...defaultSettings },
};
const text = '支付宝 2026/10/15 12:10 代还花呗金额：88.00元，付款成功';

test('导入结果进入待确认队列而不是直接入账', () => {
  const result = importRepaymentText(baseState, 'alipay', text);

  expect(result.duplicate).toBe(false);
  expect(result.state.accounts[0].balance).toBe(500);
  expect(result.state.transactions).toHaveLength(0);
  expect(result.state.pendingTransactions).toHaveLength(1);
  expect(result.state.pendingTransactions[0]).toMatchObject({
    source: 'import', type: 'expense', amount: 88, eventKind: 'proxy-repayment', eventStatus: 'success',
    provider: '支付宝', counterparty: '花呗',
  });
  expect(result.state.pendingTransactions[0].accountId).toBeUndefined();
  expect(result.state.pendingTransactions[0].debtId).toBeUndefined();
});

test('重复导入同一内容不新增待确认记录', () => {
  const first = importRepaymentText(baseState, 'alipay', text);
  const second = importRepaymentText(first.state, 'alipay', text);

  expect(second.duplicate).toBe(true);
  expect(second.state).toBe(first.state);
});

test('解析失败不改变账本状态', () => {
  expect(() => importRepaymentText(baseState, 'wechat', '微信支付 买早餐 12元')).toThrow('repayment-import-not-repayment');
  expect(baseState.pendingTransactions).toHaveLength(0);
});

test('用户选择账户和欠款后才入账并扣减欠款', () => {
  const imported = importRepaymentText(baseState, 'alipay', text).state;
  const id = imported.pendingTransactions[0].id;

  expect(() => reviewDetectedTransaction(imported, id, 'accept', { accountId: 'cash' })).toThrow('repayment-debt-invalid');
  const reviewed = reviewDetectedTransaction(imported, id, 'accept', { accountId: 'cash', debtId: 'debt-1' });

  expect(reviewed.accounts[0].balance).toBe(412);
  expect(reviewed.debts[0].amount).toBe(112);
  expect(reviewed.transactions[0]).toMatchObject({ source: 'import', eventKind: 'proxy-repayment' });
});

test('空文本被拒绝', () => {
  expect(() => importRepaymentText(baseState, 'other', '   ')).toThrow('repayment-import-not-repayment');
});

test('分期还款导入自动创建欠款并只按本金减少', () => {
  const state = { ...baseState, debts: [] };
  const draft = createInstallmentDraft({
    debtName: '借呗分期', remainingPrincipal: 1000, totalInterest: 30, totalPeriods: 3,
    repaymentType: 'fixed-payment', fixedPayment: 343.33, firstDueDate: '2026-11-14',
  });
  const result = importInstallmentRepayment(state, 'alipay', draft);

  expect(result.state.debts).toHaveLength(1);
  expect(result.state.debts[0]).toMatchObject({ name: '借呗分期', amount: 1000, installment: expect.objectContaining({ paidPeriods: 0 }) });
  expect(result.state.pendingTransactions[0]).toMatchObject({
    debtId: result.debtId, principalAmount: expect.any(Number), interestAmount: expect.any(Number), installmentNumber: 1, installmentCount: 3,
  });
  const reviewed = reviewDetectedTransaction(result.state, result.candidate.id, 'accept', { accountId: 'cash' });
  expect(reviewed.accounts[0].balance).toBe(500 - result.candidate.amount);
  expect(reviewed.debts[0].amount).toBe(1000 - (result.candidate.principalAmount ?? 0));
  expect(reviewed.debts[0].installment?.paidPeriods).toBe(1);
  expect(reviewed.transactions[0].interestAmount).toBe(result.candidate.interestAmount);
});
