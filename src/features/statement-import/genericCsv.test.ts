import { parseGenericStatement } from './genericCsv';

const wechatCsv = [
  '微信支付账单明细',
  '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注',
  '2026-10-18 08:00:00,商户消费,早餐店,豆浆油条,支出,¥12.50,零钱,支付成功,WX-1,M-1,',
  '2026-10-17 09:00:00,转账,张三,转账备注,收入,20.00,零钱,已收款,WX-2,M-2,',
  '2026-10-16 10:00:00,商户消费,某店,退款-商品,/,¥5.00,零钱,已全额退款,WX-3,M-3,',
  '2026-10-15 11:00:00,商户消费,关闭店铺,已关闭,支出,9.00,零钱,交易关闭,WX-4,M-4,',
  '2026-10-18 08:00:00,商户消费,早餐店,豆浆油条,支出,¥12.50,零钱,支付成功,WX-1,M-1,',
  '',
].join('\n');

test('解析微信 CSV 并跳过关闭和重复交易', () => {
  const result = parseGenericStatement(wechatCsv);

  expect(result.rows).toHaveLength(3);
  expect(result.rows.map((row) => row.kind)).toEqual(['expense', 'income', 'refund']);
  expect(result.rows[0]).toMatchObject({ amount: 12.5, category: '商户消费', counterparty: '早餐店', paymentMethod: '零钱', orderId: 'WX-1' });
  expect(result.skippedClosed).toBe(1);
  expect(result.duplicateRows).toBe(1);
});

test('微信时间转为中国时区', () => {
  expect(parseGenericStatement(wechatCsv).rows[0].occurredAt).toBe('2026-10-18T08:00:00.000+08:00');
});

test('支持制表符分隔的账单文本', () => {
  const tsv = [
    '交易时间\t交易类型\t交易对方\t商品\t收/支\t金额(元)\t支付方式\t当前状态\t交易单号',
    '2026/10/18 12:30:00\t商户消费\t便利店\t饮料\t支出\t3.50\t零钱\t支付成功\tTSV-1',
  ].join('\n');
  const result = parseGenericStatement(tsv);

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ amount: 3.5, occurredAt: '2026-10-18T12:30:00.000+08:00' });
});

test('没有可识别表头时拒绝解析', () => {
  expect(() => parseGenericStatement('微信支付账单\n1,2,3')).toThrow('statement-header-invalid');
});

test('空金额被当作无效行而不是零元订单', () => {
  const csv = [
    '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号',
    '2026-10-18 12:30:00,商户消费,便利店,饮料,支出,,零钱,支付成功,BAD-1',
  ].join('\n');
  const result = parseGenericStatement(csv);

  expect(result.skippedInvalid).toBe(1);
  expect(result.skippedZero).toBe(0);
});