import { parseAlipayStatement } from './alipayCsv';

const csv = [
  '导出信息：',
  '姓名：测试用户',
  '共7笔记录',
  '---------------- 支付宝电子客户回单 ----------------',
  '交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注,',
  '2026-10-18 07:11:05,日用百货,一代鲜生,/,"蔬菜,水果",支出,7.00,招商银行储蓄卡(7997),交易成功,ORDER-1,M-1,,',
  '2026-10-17 10:00:00,餐饮美食,关闭店铺,/,已关闭订单,支出,19.00,余额宝,交易关闭,ORDER-CLOSED,M-2,,',
  '2026-10-16 09:00:00,转账红包,张三,/,收到转账,收入,10.00,余额,交易成功,ORDER-2,M-3,,',
  '2026-10-15 08:00:00,退款,某商户,/,退款-商品,不计收支,50.00,,退款成功,ORDER-3,M-4,,',
  '2026-10-14 07:00:00,信用借还,花呗,/,花呗主动还款,不计收支,136.34,余额宝,还款成功,ORDER-4,M-5,,',
  '2026-10-13 06:00:00,投资理财,余额宝,/,余额宝转出,不计收支,100.00,余额宝,交易成功,ORDER-5,M-6,,',
  '2026-10-18 07:11:05,日用百货,一代鲜生,/,"蔬菜,水果",支出,7.00,招商银行储蓄卡(7997),交易成功,ORDER-1,M-1,,',
  '',
].join('\n');

test('解析支付宝 CSV 并过滤关闭和重复交易', () => {
  const result = parseAlipayStatement(csv);

  expect(result.skippedClosed).toBe(1);
  expect(result.duplicateRows).toBe(1);
  expect(result.rows).toHaveLength(5);
  expect(result.rows[0]).toMatchObject({ orderId: 'ORDER-1', amount: 7, category: '日用百货', description: '蔬菜,水果', kind: 'expense' });
});

test('识别退款、还款和普通不计收支', () => {
  const kinds = parseAlipayStatement(csv).rows.map((row) => row.kind);

  expect(kinds).toEqual(['expense', 'income', 'refund', 'repayment', 'transfer']);
});

test('交易时间带固定中国时区偏移', () => {
  const row = parseAlipayStatement(csv).rows[0];

  expect(row.occurredAt).toBe('2026-10-18T07:11:05.000+08:00');
});

test('零元先用后付订单单独统计', () => {
  const zeroCsv = csv + '\n2026-10-11 06:00:00,日用百货,拼多多,/,"先用后付,0元订单",支出,0.00,,支付成功,ORDER-ZERO,M-8,,';
  const result = parseAlipayStatement(zeroCsv);

  expect(result.skippedZero).toBe(1);
  expect(result.rows).toHaveLength(5);
  expect(result.skippedInvalid).toBe(0);
});
test('没有支付宝表头时拒绝解析', () => {
  expect(() => parseAlipayStatement('姓名：测试\n1,2,3')).toThrow('alipay-statement-header-invalid');
});

test('金额或订单号无效的行被跳过', () => {
  const result = parseAlipayStatement(csv + '\n2026-10-12 06:00:00,日用百货,坏数据,/,无金额,支出,abc,余额宝,交易成功,ORDER-BAD,M-7,,');

  expect(result.rows).toHaveLength(5);
  expect(result.skippedInvalid).toBe(1);
});