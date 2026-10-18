import { parseRepaymentText, RepaymentProvider } from './parsers';

const cases: Array<{ provider: RepaymentProvider; text: string; amount: number; counterparty: string; occurredAt: string }> = [
  { provider: 'douyin', text: '抖音商城 2026-10-16 08:30 帮张三还款 128.50元，支付成功', amount: 128.5, counterparty: '张三', occurredAt: '2026-10-16T08:30:00.000+08:00' },
  { provider: 'alipay', text: '支付宝 2026/10/15 12:10 代还花呗金额：88.00元，付款成功', amount: 88, counterparty: '花呗', occurredAt: '2026-10-15T12:10:00.000+08:00' },
  { provider: 'wechat', text: '微信支付 2026年10月14日 19:20 替李四偿还 66元，已完成', amount: 66, counterparty: '李四', occurredAt: '2026-10-14T19:20:00.000+08:00' },
  { provider: 'dew', text: '得物 2026-10-13 09:05 代付白条 ¥45.60 成功', amount: 45.6, counterparty: '白条', occurredAt: '2026-10-13T09:05:00.000+08:00' },
  { provider: 'jd', text: '京东 2026/10/12 21:15 代还京东白条 33.20元，还款成功', amount: 33.2, counterparty: '京东白条', occurredAt: '2026-10-12T21:15:00.000+08:00' },
];

test.each(cases)('解析 $provider 的代还文本', ({ provider, text, amount, counterparty, occurredAt }) => {
  const result = parseRepaymentText(provider, text);

  expect(result).toMatchObject({ provider, amount, counterparty, occurredAt, eventKind: 'proxy-repayment', eventStatus: 'success' });
  expect(result.note).toContain(text.slice(0, 2));
});

test('缺少时间时使用导入时间', () => {
  const result = parseRepaymentText('alipay', '支付宝代还花呗 99.90元，支付成功', '2026-10-17T10:20:00.000Z');

  expect(result.occurredAt).toBe('2026-10-17T10:20:00.000Z');
});

test('拒绝普通消费文本', () => {
  expect(() => parseRepaymentText('wechat', '微信支付 2026-10-16 08:30 购买早餐 12元')).toThrow('repayment-import-not-repayment');
});

test('拒绝无法识别金额的还款文本', () => {
  expect(() => parseRepaymentText('jd', '京东白条 2026-10-16 08:30 还款成功')).toThrow('repayment-import-amount-invalid');
});