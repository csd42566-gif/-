import { StatementParseResult, StatementRow, StatementRowKind } from './alipayCsv';
import { parseDelimitedRows } from './genericCsv';

type BankProvider = 'cmb' | 'icbc' | 'ccb' | 'boc' | 'citic';

interface BankConfig {
  date: string[];
  time?: string[];
  amount?: string[];
  income?: string[];
  expense?: string[];
  balance?: string[];
  description: string[];
  counterparty?: string[];
  status?: string[];
  orderId?: string[];
  cardTail?: string[];
  amountMode: 'signed' | 'separate';
  positive: 'income' | 'expense';
}

const bankConfigs: Record<BankProvider, BankConfig> = {
  cmb: {
    date: ['记账日期'], amount: ['交易金额'], balance: ['联机余额'],
    description: ['交易摘要', '客户摘要'], counterparty: ['对手信息'],
    amountMode: 'signed', positive: 'income',
  },
  boc: {
    date: ['记账日期'], time: ['记账时间'], amount: ['金额'], balance: ['余额'],
    description: ['交易名称', '附言'], counterparty: ['对方账户名'], status: ['交易状态'],
    amountMode: 'signed', positive: 'income',
  },
  icbc: {
    date: ['交易日期'], income: ['记账金额(收入)', '交易金额(收入)'], expense: ['记账金额(支出)', '交易金额(支出)'], balance: ['余额'],
    description: ['摘要'], counterparty: ['交易场所', '对方户名'], status: ['交易状态'],
    amountMode: 'separate', positive: 'income',
  },
  ccb: {
    date: ['交易日期'], time: ['交易时间'], income: ['收入'], expense: ['支出'], balance: ['账户余额'],
    description: ['摘要'], counterparty: ['对方户名'], status: ['交易状态'],
    amountMode: 'separate', positive: 'income',
  },
  citic: {
    date: ['交易日期'], amount: ['交易金额'], description: ['交易描述'], cardTail: ['卡末四位'],
    amountMode: 'signed', positive: 'expense',
  },
};

interface BankColumns {
  date: number; time: number; amount: number; income: number; expense: number; balance: number;
  description: number[]; counterparty: number[]; status: number; orderId: number; cardTail: number;
}

const transferPattern = /转账|汇款|网转|跨行|提现|存入|转入|转出/;
const repaymentPattern = /还款|偿还|自动转帐还款|自动还款/;
const refundPattern = /退款|退货|冲正|撤销|返还/;

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, '').replace(/\s+/g, '');
}

function findColumn(headers: string[], candidates: string[] = []): number {
  for (const candidate of candidates) {
    const index = headers.indexOf(normalizeHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[¥￥,\s元]/g, '');
  if (!cleaned || cleaned === '-') return 0;
  const negative = /^\(.*\)$/.test(cleaned);
  const amount = Number(cleaned.replace(/[()]/g, ''));
  return Number.isFinite(amount) ? (negative ? -Math.abs(amount) : amount) : NaN;
}

function parseDate(value: string): { year: string; month: string; day: string } | null {
  const trimmed = value.trim();
  const dashed = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dashed) return { year: dashed[1], month: dashed[2].padStart(2, '0'), day: dashed[3].padStart(2, '0') };
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return { year: compact[1], month: compact[2], day: compact[3] };
  return null;
}

function parseTime(value: string): string {
  const matched = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) return '00:00:00';
  return `${matched[1].padStart(2, '0')}:${matched[2]}:${(matched[3] ?? '00').padStart(2, '0')}`;
}

function toTimestamp(date: { year: string; month: string; day: string }, time: string): string {
  return `${date.year}-${date.month}-${date.day}T${time}.000+08:00`;
}

function classify(kind: 'income' | 'expense', description: string, provider: BankProvider): StatementRowKind {
  if (repaymentPattern.test(description)) return 'repayment';
  if (refundPattern.test(description)) return 'refund';
  if (transferPattern.test(description)) return 'transfer';
  if (provider === 'citic' && kind === 'income') return 'refund';
  return kind;
}

export function isBankProvider(provider: string): provider is BankProvider {
  return provider in bankConfigs;
}

export function parseBankStatement(provider: BankProvider, text: string): StatementParseResult {
  const config = bankConfigs[provider];
  const csvRows = parseDelimitedRows(text);
  let headerIndex = -1;
  let columns: BankColumns | null = null;
  for (let index = 0; index < csvRows.length; index += 1) {
    const headers = csvRows[index].map(normalizeHeader);
    const dateColumn = findColumn(headers, config.date);
    const amountColumn = findColumn(headers, config.amount);
    const incomeColumn = findColumn(headers, config.income);
    const expenseColumn = findColumn(headers, config.expense);
    const hasAmount = config.amountMode === 'signed' ? amountColumn >= 0 : incomeColumn >= 0 || expenseColumn >= 0;
    if (dateColumn < 0 || !hasAmount) continue;
    headerIndex = index;
    columns = {
      date: dateColumn, time: findColumn(headers, config.time),
      amount: amountColumn, income: incomeColumn, expense: expenseColumn,
      balance: findColumn(headers, config.balance),
      description: config.description.map((alias) => findColumn(headers, [alias])).filter((column) => column >= 0),
      counterparty: (config.counterparty ?? []).map((alias) => findColumn(headers, [alias])).filter((column) => column >= 0),
      status: findColumn(headers, config.status), orderId: findColumn(headers, config.orderId), cardTail: findColumn(headers, config.cardTail),
    };
    break;
  }
  if (headerIndex < 0 || !columns) throw new Error('statement-header-invalid');

  const rows: StatementRow[] = [];
  const seenOrderIds = new Set<string>();
  let skippedClosed = 0;
  let skippedZero = 0;
  let duplicateRows = 0;
  let skippedInvalid = 0;

  for (let index = headerIndex + 1; index < csvRows.length; index += 1) {
    const cells = csvRows[index];
    if (cells.every((cell) => cell.trim() === '')) continue;
    const read = (column: number) => column >= 0 ? (cells[column] ?? '').trim() : '';
    const readMany = (indexes: number[]) => indexes.map((column) => read(column)).filter(Boolean).join(' · ');
    const date = parseDate(read(columns.date));
    const time = parseTime(read(columns.time));
    const description = readMany(columns.description);
    const counterparty = readMany(columns.counterparty);
    const status = read(columns.status) || '交易成功';
    if (/关闭|失败|取消/.test(status)) { skippedClosed += 1; continue; }
    if (!date) { skippedInvalid += 1; continue; }

    let kind: 'income' | 'expense' | null = null;
    let amount = 0;
    if (config.amountMode === 'signed') {
      const signed = parseMoney(read(columns.amount));
      if (!Number.isFinite(signed)) { skippedInvalid += 1; continue; }
      if (signed === 0) { skippedZero += 1; continue; }
      amount = Math.abs(signed);
      const positiveKind = config.positive;
      kind = signed > 0 ? positiveKind : positiveKind === 'income' ? 'expense' : 'income';
    } else {
      const income = parseMoney(read(columns.income));
      const expense = parseMoney(read(columns.expense));
      if (!Number.isFinite(income) || !Number.isFinite(expense)) { skippedInvalid += 1; continue; }
      if (income > 0) { amount = income; kind = 'income'; }
      else if (expense > 0) { amount = expense; kind = 'expense'; }
      else { skippedZero += 1; continue; }
    }

    const balance = read(columns.balance).replace(/[¥￥,\s元]/g, '');
    const cardTail = read(columns.cardTail);
    const orderId = read(columns.orderId).replace(/\s+/g, '') || `${date.year}-${date.month}-${date.day}|${time}|${amount.toFixed(2)}|${balance}|${description}|${counterparty}|${cardTail}`;
    if (seenOrderIds.has(orderId)) { duplicateRows += 1; continue; }
    seenOrderIds.add(orderId);
    const occurredAt = toTimestamp(date, time);
    const classification = classify(kind, `${description} ${counterparty}`, provider);
    rows.push({
      occurredAt, category: description || '银行交易', counterparty, description,
      direction: kind === 'income' ? '收入' : '支出', amount, paymentMethod: '',
      status, orderId, kind: classification,
    });
  }
  return { rows, skippedClosed, skippedZero, duplicateRows, skippedInvalid };
}