import { defaultSettings, LedgerState } from '../../core/model/finance';
import { importAlipayStatement, importStatement, previewAlipayStatement } from './statementImport';

const csv = [
  '导出信息：',
  '共7笔记录',
  '交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注,',
  '2026-10-18 07:11:05,日用百货,一代鲜生,/,"蔬菜,水果",支出,7.00,招商银行储蓄卡(7997),交易成功,ORDER-1,M-1,,',
  '2026-10-17 10:00:00,餐饮美食,关闭店铺,/,已关闭订单,支出,19.00,余额宝,交易关闭,ORDER-CLOSED,M-2,,',
  '2026-10-16 09:00:00,转账红包,张三,/,收到转账,收入,10.00,账户余额,交易成功,ORDER-2,M-3,,',
  '2026-10-15 08:00:00,退款,某商户,/,退款-商品,不计收支,50.00,,退款成功,ORDER-3,M-4,,',
  '2026-10-14 07:00:00,信用借还,花呗,/,花呗主动还款,不计收支,136.34,余额宝,还款成功,ORDER-4,M-5,,',
  '2026-10-13 06:00:00,投资理财,余额宝,/,余额宝转出,不计收支,100.00,余额宝,交易成功,ORDER-5,M-6,,',
  '',
].join('\n');

function createState(): LedgerState {
  return {
    accounts: [
      { id: 'existing-alipay', name: '支付宝', kind: 'wallet', balance: 1000 },
      { id: 'existing-wallet', name: '余额宝', kind: 'wallet', balance: 500 },
    ],
    transactions: [],
    pendingTransactions: [],
    debts: [{ id: 'debt-1', name: '花呗', amount: 500, dueDate: '2026-10-25', kind: 'credit', repaymentMode: 'minimum' }],
    goal: null,
    settings: { ...defaultSettings },
  };
}

test('预览统计支出、收入、退款、还款和跳过的交易', () => {
  const summary = previewAlipayStatement(createState(), csv);

  expect(summary).toMatchObject({
    expenseCount: 1, expenseTotal: 7, incomeCount: 1, incomeTotal: 10,
    refundCount: 1, refundTotal: 50, repaymentCount: 1, transferCount: 1,
    skippedClosed: 1, duplicateRows: 0, importableCount: 4,
  });
});

test('导入匹配账户并同步更新余额', () => {
  const state = createState();
  const result = importAlipayStatement(state, csv);

  expect(state.accounts[0].balance).toBe(1000);
  expect(result.state.accounts.find((account) => account.id === 'existing-alipay')?.balance).toBe(1060);
  expect(result.state.transactions).toHaveLength(2);
  expect(result.state.pendingTransactions).toHaveLength(2);
  expect(result.state.transactions.every((transaction) => transaction.provider === '支付宝')).toBe(true);
  expect(result.state.transactions.every((transaction) => !!transaction.externalKey)).toBe(true);
});

test('退款记为冲减支出的收入记录', () => {
  const result = importAlipayStatement(createState(), csv);
  const refund = result.state.transactions.find((transaction) => transaction.id.includes('ORDER-3'));

  expect(refund).toMatchObject({ type: 'income', amount: 50, eventKind: 'refund', category: '退款', source: 'import' });
});

test('还款进入待确认并预填匹配账户', () => {
  const result = importAlipayStatement(createState(), csv);
  const repayment = result.state.pendingTransactions.find((pending) => pending.eventKind === 'repayment');
  const account = result.state.accounts.find((item) => item.id === repayment?.accountId);

  expect(repayment).toMatchObject({ eventKind: 'repayment', eventStatus: 'success', provider: '支付宝', amount: 136.34, source: 'import' });
  expect(account?.name).toBe('余额宝');
});

test('匹配不到支付账户时进入待确认且不创建账户', () => {
  const result = importAlipayStatement(createState(), csv);
  const unmatched = result.state.pendingTransactions.find((pending) => pending.amount === 7);

  expect(unmatched).toMatchObject({ amount: 7, provider: '支付宝' });
  expect(unmatched?.accountId).toBeUndefined();
  expect(result.state.accounts.some((account) => account.name === '招商银行储蓄卡(7997)')).toBe(false);
});

test('按卡尾号匹配账户并扣减余额', () => {
  const state = createState();
  state.accounts.push({ id: 'cmb-7997', name: '招商银行储蓄卡(7997)', kind: 'bank', balance: 1000 });
  const result = importAlipayStatement(state, csv);
  const transaction = result.state.transactions.find((item) => item.id.includes('ORDER-1'));

  expect(transaction).toMatchObject({ accountId: 'cmb-7997', amount: 7, type: 'expense' });
  expect(result.state.accounts.find((account) => account.id === 'cmb-7997')?.balance).toBe(993);
});

test('招商银行账单匹配不到账户时进入待确认', () => {
  const cmbCsv = [
    '记账日期,货币,交易金额,联机余额,交易摘要,对手信息,客户摘要',
    '2024-01-01,CNY,"1,234.00","1,271.66",代发住房公积金,北京住房公积金管理中心,约定提取',
    '2024-01-27,CNY,-3.00,81.22,一网通支付,国网电力有限公司,供电',
  ].join('\n');
  const result = importStatement(createState(), 'cmb', cmbCsv);

  expect(result.state.transactions).toHaveLength(0);
  expect(result.state.pendingTransactions).toHaveLength(2);
  expect(result.state.accounts.some((account) => account.name === '招商银行')).toBe(false);
});

test('中信信用卡账单匹配不到账户时进入待确认', () => {
  const citicCsv = [
    '交易日期,入账日期,交易描述,卡末四位,交易币种,结算币种,交易金额,结算金额',
    '2024-11-09,2024-11-09,支付宝－北京嘀嘀无限科技发展有限公司,6688,人民币,人民币,5.90,5.90',
  ].join('\n');
  const result = importStatement(createState(), 'citic', citicCsv);

  expect(result.state.pendingTransactions).toHaveLength(1);
  expect(result.state.accounts.some((account) => account.name === '中信银行')).toBe(false);
});

test('微信账单匹配不到零钱账户时进入待确认', () => {
  const wechatCsv = [
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号',
    '2026-10-18 08:00:00,商户消费,早餐店,豆浆油条,支出,12.50,零钱,支付成功,WX-1',
  ].join('\n');
  const result = importStatement(createState(), 'wechat', wechatCsv);

  expect(result.state.pendingTransactions[0]).toMatchObject({ provider: '微信', amount: 12.5, category: '商户消费' });
  expect(result.state.accounts.some((account) => account.name === '零钱')).toBe(false);
});

test('重复导入不新增交易或待确认记录', () => {
  const first = importAlipayStatement(createState(), csv);
  const second = importAlipayStatement(first.state, csv);

  expect(second.state.transactions).toHaveLength(2);
  expect(second.state.pendingTransactions).toHaveLength(2);
  expect(second.state.accounts.find((account) => account.id === 'existing-alipay')?.balance).toBe(1060);
  expect(second.summary.existingCount).toBe(4);
});