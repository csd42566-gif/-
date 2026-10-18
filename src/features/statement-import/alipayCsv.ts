export type StatementRowKind = 'expense' | 'income' | 'refund' | 'repayment' | 'transfer';

export interface StatementRow {
  occurredAt: string;
  category: string;
  counterparty: string;
  description: string;
  direction: string;
  amount: number;
  paymentMethod: string;
  status: string;
  orderId: string;
  kind: StatementRowKind;
}

export interface StatementParseResult {
  rows: StatementRow[];
  skippedClosed: number;
  skippedZero: number;
  duplicateRows: number;
  skippedInvalid: number;
}

const requiredHeaders = ['交易时间', '交易分类', '交易对方', '商品说明', '收/支', '金额', '收/付款方式', '交易状态', '交易订单号'];

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toChinaTimestamp(value: string): string | null {
  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!matched) return null;
  const [, year, month, day, hour, minute, second] = matched;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000+08:00`;
}

function classifyRow(row: Omit<StatementRow, 'kind'>): StatementRowKind {
  if (row.status.includes('退款') || row.category === '退款') return 'refund';
  if (row.status.includes('还款') || /还款|偿还/.test(row.description)) return 'repayment';
  if (row.direction === '支出') return 'expense';
  if (row.direction === '收入') return 'income';
  return 'transfer';
}

export function parseAlipayStatement(text: string): StatementParseResult {
  const csvRows = parseCsvRows(text);
  const headerIndex = csvRows.findIndex((row) => row[0]?.trim() === '交易时间' && row.some((cell) => cell.trim() === '交易订单号'));
  if (headerIndex < 0) throw new Error('alipay-statement-header-invalid');
  const headers = csvRows[headerIndex].map((cell) => cell.trim());
  if (requiredHeaders.some((header) => !headers.includes(header))) throw new Error('alipay-statement-header-invalid');

  const column = (header: string) => headers.indexOf(header);
  const rows: StatementRow[] = [];
  const seenOrderIds = new Set<string>();
  let skippedClosed = 0;
  let skippedZero = 0;
  let duplicateRows = 0;
  let skippedInvalid = 0;

  for (const cells of csvRows.slice(headerIndex + 1)) {
    if (cells.every((cell) => cell.trim() === '')) continue;
    const read = (header: string) => (cells[column(header)] ?? '').trim();
    const occurredAt = toChinaTimestamp(read('交易时间'));
    const amount = Number(read('金额').replace(/,/g, ''));
    const status = read('交易状态');
    const orderId = read('交易订单号').replace(/\s+/g, '');
    if (status.includes('关闭')) { skippedClosed += 1; continue; }
    if (Number.isFinite(amount) && amount === 0) { skippedZero += 1; continue; }
    if (!occurredAt || !Number.isFinite(amount) || amount < 0 || !orderId) { skippedInvalid += 1; continue; }
    if (seenOrderIds.has(orderId)) { duplicateRows += 1; continue; }
    seenOrderIds.add(orderId);
    const base = {
      occurredAt,
      category: read('交易分类'),
      counterparty: read('交易对方'),
      description: read('商品说明'),
      direction: read('收/支'),
      amount,
      paymentMethod: read('收/付款方式'),
      status,
      orderId,
    };
    rows.push({ ...base, kind: classifyRow(base) });
  }

  return { rows, skippedClosed, skippedZero, duplicateRows, skippedInvalid };
}