import * as XLSX from 'xlsx';
import { parseGenericStatement } from './genericCsv';
import { xlsxToStatementText } from './xlsx';

test('从微信 xlsx 提取账单并解析', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['微信支付账单明细'],
    ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号'],
    ['2026-10-18 08:00:00', '商户消费', '早餐店', '豆浆', '支出', '12.50', '零钱', '支付成功', 'WX-XLSX-1'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const text = xlsxToStatementText(new Uint8Array(buffer));
  const result = parseGenericStatement(text);

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ amount: 12.5, orderId: 'WX-XLSX-1', kind: 'expense' });
});