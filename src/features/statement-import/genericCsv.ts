import { StatementParseResult, StatementRow, StatementRowKind } from './alipayCsv';

const aliases = {
  time: ['交易时间', '时间', '日期', '付款时间', '交易创建时间', '创建时间'],
  category: ['交易分类', '交易类型', '类型', '分类', '业务类型'],
  counterparty: ['交易对方', '对方', '商户名称', '收款方', '交易对象'],
  description: ['商品说明', '商品', '商品名称', '交易说明', '备注', '摘要'],
  direction: ['收/支', '收支', '收支类型', '收/支类型'],
  amount: ['金额', '金额(元)', '交易金额', '付款金额', '支付金额'],
  payment: ['收/付款方式', '支付方式', '付款方式', '收付款方式'],
  status: ['交易状态', '当前状态', '状态', '交易结果'],
  orderId: ['交易订单号', '交易单号', '订单号', '交易号', '商户单号'],
};

const headerKeys = Object.keys(aliases) as Array<keyof typeof aliases>;

export function parseDelimitedRows(text: string): string[][] {
  const delimiter = detectDelimiter(text);
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
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function detectDelimiter(text: string): string {
  const firstContentLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  return firstContentLine.includes('\t') ? '\t' : ',';
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '').replace(/\s+/g, '');
}

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

function parseTime(value: string): string | null {
  const normalized = value.trim().replace(/\//g, '-').replace(/年|月/g, '-').replace(/日/g, '');
  const matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) return null;
  const [, year, month, day, hour, minute, second = '00'] = matched;
  const pad = (part: string) => part.padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:${second}.000+08:00`;
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/[¥￥,\s元]/g, '');
  return cleaned ? Math.abs(Number(cleaned)) : NaN;
}

function classify(direction: string, category: string, description: string, status: string): StatementRowKind {
  if (status.includes('退款') || category.includes('退款')) return 'refund';
  if (status.includes('还款') || /还款|偿还/.test(description)) return 'repayment';
  if (direction.includes('收入')) return 'income';
  if (direction.includes('支出')) return 'expense';
  if (status.includes('收款')) return 'income';
  if (status.includes('付款') || status.includes('支付')) return 'expense';
  return 'transfer';
}

export function parseGenericStatement(text: string): StatementParseResult {
  const csvRows = parseDelimitedRows(text);
  let headerIndex = -1;
  let columns: Record<string, number> = {};
  for (let index = 0; index < csvRows.length; index += 1) {
    const headers = csvRows[index].map(normalizeHeader);
    const timeColumn = findColumn(headers, aliases.time);
    const amountColumn = findColumn(headers, aliases.amount);
    if (timeColumn < 0 || amountColumn < 0) continue;
    headerIndex = index;
    columns = Object.fromEntries(headerKeys.map((key) => [key, findColumn(headers, aliases[key])])) as Record<string, number>;
    break;
  }
  if (headerIndex < 0) throw new Error('statement-header-invalid');

  const rows: StatementRow[] = [];
  const seenOrderIds = new Set<string>();
  let skippedClosed = 0;
  let skippedZero = 0;
  let duplicateRows = 0;
  let skippedInvalid = 0;

  for (const cells of csvRows.slice(headerIndex + 1)) {
    if (cells.every((cell) => cell.trim() === '')) continue;
    const read = (key: keyof typeof aliases) => columns[key] >= 0 ? (cells[columns[key]] ?? '').trim() : '';
    const occurredAt = parseTime(read('time'));
    const amount = parseAmount(read('amount'));
    const status = read('status') || '交易成功';
    const category = read('category') || '其他';
    const description = read('description');
    const orderId = read('orderId').replace(/\s+/g, '') || `${occurredAt}|${amount}|${description}`;
    if (status.includes('关闭') || status.includes('失败') || status.includes('取消')) { skippedClosed += 1; continue; }
    if (amount === 0) { skippedZero += 1; continue; }
    if (!occurredAt || !Number.isFinite(amount) || amount < 0) { skippedInvalid += 1; continue; }
    if (seenOrderIds.has(orderId)) { duplicateRows += 1; continue; }
    seenOrderIds.add(orderId);
    rows.push({
      occurredAt, category, counterparty: read('counterparty'), description,
      direction: read('direction'), amount, paymentMethod: read('payment'),
      status, orderId, kind: classify(read('direction'), category, description, status),
    });
  }
  return { rows, skippedClosed, skippedZero, duplicateRows, skippedInvalid };
}
