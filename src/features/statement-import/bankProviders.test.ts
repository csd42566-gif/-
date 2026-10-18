import { parseBankStatement } from './bankProviders';

const cmb = [
  '记账日期,货币,交易金额,联机余额,交易摘要,对手信息,客户摘要',
  '2024-01-01,CNY,"1,234.00","1,271.66",代发住房公积金,北京住房公积金管理中心1111111111,01月01日约定提取',
  '2024-01-27,CNY,-3.00,81.22,一网通支付,国网电力有限公司99999999999999,供电',
  '2024-01-27,CNY,-3.00,81.22,一网通支付,国网电力有限公司99999999999999,供电',
].join('\n');

test('招商银行按金额正负识别收支并去重', () => {
  const result = parseBankStatement('cmb', cmb);

  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ amount: 1234, kind: 'income', occurredAt: '2024-01-01T00:00:00.000+08:00' });
  expect(result.rows[1]).toMatchObject({ amount: 3, kind: 'expense' });
  expect(result.duplicateRows).toBe(1);
});

test('中国银行跳过标题行并解析交易时间', () => {
  const boc = [
    '中国银行交易流水明细单',
    '记账日期,记账时间,币别,金额,余额,交易名称,渠道,网点名称,附言,对方账户名,对方卡号/账号,对方开户行,借记卡号',
    '2025-08-22,17:57:17,人民币,-71.89,"3,240.28",无卡支付,卡组织线上/无卡交易,-------------------,----------,张三,6226******5669,-------------------,3167',
  ].join('\n');
  const result = parseBankStatement('boc', boc);

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ amount: 71.89, kind: 'expense', occurredAt: '2025-08-22T17:57:17.000+08:00', counterparty: '张三' });
});

test('工商银行解析收入支出分列并跳过元数据行', () => {
  const icbc = [
    '明细查询文件下载', '', '卡号: 1234****9876,"卡别名: 这是卡别名"', '', '子账户序号: 00000,子账户类别: 活期,"子账户别名: "',
    '交易日期,摘要,交易场所,交易国家或地区简称,钞/汇,交易金额(收入),交易金额(支出),交易币种,记账金额(收入),记账金额(支出),记账币种,余额,对方户名',
    '2023-05-02,"消费","广东三元麦当劳食品有","CHN",钞,"-","-",-,"","13.40",人民币,"xx,yyyy.zz","深圳市财付通支付科技有限公司"',
    '2023-04-22,"他行汇入","","CHN",钞,"-","-",-,"1,234.56","",人民币,"xx,yyyy.zz","李四"',
  ].join('\n');
  const result = parseBankStatement('icbc', icbc);

  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ amount: 13.4, kind: 'expense' });
  expect(result.rows[1]).toMatchObject({ amount: 1234.56, kind: 'income' });
});

test('建设银行解析 XLS 转出的收入支出列和时间', () => {
  const ccb = [
    'China Construction Bank', '开户机构：,xxx', '', '币　　种：,人民币', '账　　号：,xxxxx',
    '记账日,交易日期,交易时间,支出,收入,账户余额,币种,摘要,对方账号,对方户名,交易地点',
    '20250101,20250101,18:53:19,67.00,0.00,"2,176.91",人民币,消费,20883313166*****0156,中***融科技有限公司,支付宝-支付宝外部商户-中移动金融科技有限公司',
    '20250106,20250106,12:03:39,0.00,100.00,"2,300.00",人民币,工资,6222****,ABC公司,企业代发',
  ].join('\n');
  const result = parseBankStatement('ccb', ccb);

  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ amount: 67, kind: 'expense', occurredAt: '2025-01-01T18:53:19.000+08:00' });
  expect(result.rows[1]).toMatchObject({ amount: 100, kind: 'income' });
});

test('中信信用卡正数为支出、负数为退款', () => {
  const citic = [
    '本期账单明细(人民币)',
    '交易日期,入账日期,交易描述,卡末四位,交易币种,结算币种,交易金额,结算金额',
    '2024-11-09,2024-11-09,支付宝－北京嘀嘀无限科技发展有限公司,6688,人民币,人民币,5.90,5.90',
    '2024-11-09,2024-11-09,0.2元现金奖励-笔笔返0.2元,6688,人民币,人民币,-0.20,-0.20',
  ].join('\n');
  const result = parseBankStatement('citic', citic);

  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ amount: 5.9, kind: 'expense' });
  expect(result.rows[1]).toMatchObject({ amount: 0.2, kind: 'refund' });
});

test('无法识别银行表头时拒绝解析', () => {
  expect(() => parseBankStatement('cmb', '1,2,3')).toThrow('statement-header-invalid');
});