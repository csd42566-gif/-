import { Account, BudgetGroup, LedgerState, PendingTransaction, Transaction } from '../../core/model/finance';
import { applyImportedTransactions } from '../ledger/ledger';
import { findDuplicateBill } from '../../core/import/dedupeKey';
import { parseAlipayStatement, StatementParseResult, StatementRow, StatementRowKind } from './alipayCsv';
import { parseGenericStatement } from './genericCsv';
import { isBankProvider, parseBankStatement } from './bankProviders';
import { StatementProvider, statementProviderLabels } from './statementTypes';

export interface StatementImportSummary {
  totalRows: number;
  expenseCount: number;
  expenseTotal: number;
  incomeCount: number;
  incomeTotal: number;
  refundCount: number;
  refundTotal: number;
  repaymentCount: number;
  transferCount: number;
  skippedClosed: number;
  skippedZero: number;
  skippedInvalid: number;
  duplicateRows: number;
  existingCount: number;
  importableCount: number;
}

export interface StatementImportResult {
  state: LedgerState;
  summary: StatementImportSummary;
}

export type AlipayImportSummary = StatementImportSummary;
export type AlipayImportResult = StatementImportResult;

const categoryMap: Record<string, { category: string; budgetGroup: BudgetGroup }> = {
  餐饮美食: { category: '餐饮', budgetGroup: 'essential' },
  餐饮: { category: '餐饮', budgetGroup: 'essential' },
  日用百货: { category: '日用', budgetGroup: 'essential' },
  交通出行: { category: '交通', budgetGroup: 'essential' },
  交通: { category: '交通', budgetGroup: 'essential' },
  医疗健康: { category: '医疗', budgetGroup: 'essential' },
  教育培训: { category: '教育', budgetGroup: 'essential' },
  住房物业: { category: '住房', budgetGroup: 'essential' },
  通讯: { category: '通讯', budgetGroup: 'essential' },
  生活缴费: { category: '生活', budgetGroup: 'essential' },
  商业服务: { category: '服务', budgetGroup: 'flexible' },
  文化休闲: { category: '休闲', budgetGroup: 'flexible' },
  数码电器: { category: '购物', budgetGroup: 'flexible' },
  购物: { category: '购物', budgetGroup: 'flexible' },
  家居家装: { category: '家居', budgetGroup: 'flexible' },
  爱车养车: { category: '汽车', budgetGroup: 'flexible' },
  投资理财: { category: '理财', budgetGroup: 'flexible' },
  信用借还: { category: '还款', budgetGroup: 'flexible' },
  转账红包: { category: '转账', budgetGroup: 'flexible' },
  转账: { category: '转账', budgetGroup: 'flexible' },
  红包: { category: '红包', budgetGroup: 'flexible' },
  充值: { category: '充值', budgetGroup: 'flexible' },
  亲友代付: { category: '代付', budgetGroup: 'flexible' },
  退款: { category: '退款', budgetGroup: 'flexible' },
  其他: { category: '其他', budgetGroup: 'flexible' },
};
function transactionId(providerKey: string, row: StatementRow): string {
  return `${providerKey}_${row.orderId}`;
}

function pendingId(providerKey: string, row: StatementRow): string {
  return `import_${providerKey}_${row.orderId}`;
}

function externalKeyOf(providerKey: string, row: StatementRow): string {
  return `${providerKey}|${row.orderId}|${row.occurredAt}|${row.amount.toFixed(2)}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function describeRow(row: StatementRow): string {
  const identity = row.counterparty && row.counterparty !== '/' ? `${row.counterparty} · ` : '';
  return `${identity}${row.description}`.slice(0, 80);
}

function categorizeRow(row: StatementRow, provider: StatementProvider): { category: string; budgetGroup: BudgetGroup } {
  const mapped = categoryMap[row.category];
  if (mapped) return mapped;
  if (!isBankProvider(provider)) return { category: row.category || '其他', budgetGroup: 'flexible' };
  const text = `${row.description} ${row.counterparty}`;
  if (/餐饮|美团|饿了么|麦当劳|肯德基|星巴克|咖啡|奶茶|餐厅|饭店/.test(text)) return { category: '餐饮', budgetGroup: 'essential' };
  if (/超市|便利店|淘宝|天猫|京东|拼多多|商场|购物/.test(text)) return { category: '购物', budgetGroup: 'flexible' };
  if (/滴滴|打车|铁路|12306|地铁|公交|机票|航空|加油|充电/.test(text)) return { category: '交通', budgetGroup: 'essential' };
  if (/电费|水费|燃气|物业|话费|宽带|生活缴费/.test(text)) return { category: '生活', budgetGroup: 'essential' };
  if (/医院|诊所|药房|药店|医疗/.test(text)) return { category: '医疗', budgetGroup: 'essential' };
  if (/工资|薪金|奖金/.test(text)) return { category: '工资', budgetGroup: 'flexible' };
  if (/还款|偿还/.test(text)) return { category: '还款', budgetGroup: 'flexible' };
  if (/退款|退货|冲正|撤销/.test(text)) return { category: '退款', budgetGroup: 'flexible' };
  if (/手续费|年费|管理费/.test(text)) return { category: '手续费', budgetGroup: 'flexible' };
  if (/利息/.test(text)) return { category: '利息', budgetGroup: 'flexible' };
  if (/保险/.test(text)) return { category: '保险', budgetGroup: 'flexible' };
  if (/基金|理财|证券/.test(text)) return { category: '理财', budgetGroup: 'flexible' };
  if (/转账|汇款|网转|跨行|提现/.test(text)) return { category: '转账', budgetGroup: 'flexible' };
  return { category: '银行交易', budgetGroup: 'flexible' };
}

function normalizePaymentMethod(value: string, providerLabel: string): string {
  const base = value.split('&')[0].trim();
  if (!base || base === '余额' || base === '账户余额') return providerLabel;
  return base;
}

function cardTail(value: string): string | null {
  const matches = value.match(/\d{4}/g);
  return matches?.[matches.length - 1] ?? null;
}

export function statementAccountLabel(paymentMethod: string, providerLabel: string): string {
  const name = normalizePaymentMethod(paymentMethod, providerLabel);
  return name === providerLabel ? providerLabel : providerLabel + ' · ' + name;
}

function findAccount(accounts: Account[], accountMapping: Record<string, string>, paymentMethod: string, providerLabel: string): Account | undefined {
  const accountLabel = statementAccountLabel(paymentMethod, providerLabel);
  const mapped = accounts.find((account) => account.id === accountMapping[accountLabel]);
  if (mapped) return mapped;
  const name = normalizePaymentMethod(paymentMethod, providerLabel);
  const exact = accounts.find((account) => account.name === name);
  if (exact) return exact;
  const tail = cardTail(paymentMethod);
  if (!tail) return undefined;
  return accounts.find((account) => account.name.includes(tail) || account.id.includes(tail));
}

function rowDedupeInput(row: StatementRow, providerLabel: string) {
  return {
    provider: providerLabel,
    type: row.kind === 'income' || row.kind === 'refund' ? 'income' as const : row.kind === 'transfer' ? 'transfer' as const : 'expense' as const,
    amount: row.amount,
    occurredAt: row.occurredAt,
  };
}
function summaryOf(rows: StatementRow[], state: LedgerState, providerKey: StatementProvider, skippedClosed: number, skippedZero: number, skippedInvalid: number, duplicateRows: number): StatementImportSummary {
  const sum = (kind: StatementRowKind) => roundCurrency(rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.amount, 0));
  const count = (kind: StatementRowKind) => rows.filter((row) => row.kind === kind).length;
  const transactionIds = new Set(state.transactions.map((transaction) => transaction.id));
  const transactionKeys = new Set(state.transactions.map((transaction) => transaction.externalKey).filter((key): key is string => !!key));
  const pendingIds = new Set(state.pendingTransactions.map((pending) => pending.id));
  const providerLabel = statementProviderLabels[providerKey];
  const existingCount = rows.filter((row) => transactionIds.has(transactionId(providerKey, row))
    || pendingIds.has(pendingId(providerKey, row))
    || transactionKeys.has(externalKeyOf(providerKey, row))
    || !!findDuplicateBill(state, rowDedupeInput(row, providerLabel))).length;
  const importable = rows.filter((row) => row.kind !== 'transfer').length;
  return {
    totalRows: rows.length,
    expenseCount: count('expense'), expenseTotal: sum('expense'),
    incomeCount: count('income'), incomeTotal: sum('income'),
    refundCount: count('refund'), refundTotal: sum('refund'),
    repaymentCount: count('repayment'), transferCount: count('transfer'),
    skippedClosed, skippedZero, skippedInvalid, duplicateRows, existingCount,
    importableCount: Math.max(0, importable - existingCount),
  };
}
function parseStatement(provider: StatementProvider, text: string): StatementParseResult {
  if (provider === 'alipay') return parseAlipayStatement(text);
  if (isBankProvider(provider)) return parseBankStatement(provider, text);
  return parseGenericStatement(text);
}

export function previewStatement(state: LedgerState, provider: StatementProvider, text: string): StatementImportSummary {
  const parsed = parseStatement(provider, text);
  return summaryOf(parsed.rows, state, provider, parsed.skippedClosed, parsed.skippedZero, parsed.skippedInvalid, parsed.duplicateRows);
}

export function previewAlipayStatement(state: LedgerState, text: string): AlipayImportSummary {
  return previewStatement(state, 'alipay', text);
}

export function importStatement(state: LedgerState, provider: StatementProvider, text: string): StatementImportResult {
  const parsed = parseStatement(provider, text);
  return importParsedStatement(state, parsed, provider, statementProviderLabels[provider]);
}

export function importAlipayStatement(state: LedgerState, text: string): AlipayImportResult {
  return importStatement(state, 'alipay', text);
}

function importParsedStatement(state: LedgerState, parsed: StatementParseResult, provider: StatementProvider, providerLabel: string): StatementImportResult {
  const summary = summaryOf(parsed.rows, state, provider, parsed.skippedClosed, parsed.skippedZero, parsed.skippedInvalid, parsed.duplicateRows);
  const transactions: Transaction[] = [];
  const pendingTransactions: PendingTransaction[] = [];
  const knownTransactionIds = new Set(state.transactions.map((transaction) => transaction.id));
  const knownTransactionKeys = new Set(state.transactions.map((transaction) => transaction.externalKey).filter((key): key is string => !!key));
  const knownPendingIds = new Set(state.pendingTransactions.map((pending) => pending.id));

  for (const row of parsed.rows) {
    if (row.kind === 'transfer') continue;
    if (findDuplicateBill(state, rowDedupeInput(row, providerLabel))) continue;
    const id = transactionId(provider, row);
    const pending = pendingId(provider, row);
    const externalKey = externalKeyOf(provider, row);
    if (knownTransactionIds.has(id) || knownTransactionKeys.has(externalKey) || knownPendingIds.has(pending)) continue;
    const mapping = categorizeRow(row, provider);
    const account = findAccount(state.accounts, state.settings.accountMapping, row.paymentMethod, providerLabel);
    const accountLabel = statementAccountLabel(row.paymentMethod, providerLabel);
    const note = describeRow(row);
    if (row.kind === 'repayment') {
      pendingTransactions.push({
        id: pending, type: 'expense', amount: row.amount, accountId: account?.id, accountLabel, category: '还款', note,
        occurredAt: row.occurredAt, source: 'import', confidence: 1, eventKind: 'repayment', eventStatus: 'success',
        provider: providerLabel, counterparty: row.counterparty === '/' ? undefined : row.counterparty, externalKey,
      });
      knownPendingIds.add(pending);
      continue;
    }
    if (!account) {
      pendingTransactions.push({
        id: pending,
        type: row.kind === 'income' || row.kind === 'refund' ? 'income' : 'expense',
        amount: row.amount,
        accountLabel,
        category: row.kind === 'refund' ? '退款' : mapping.category,
        note,
        occurredAt: row.occurredAt,
        source: 'import',
        confidence: 1,
        eventKind: row.kind === 'refund' ? 'refund' : undefined,
        eventStatus: row.kind === 'refund' ? 'success' : undefined,
        provider: providerLabel,
        counterparty: row.counterparty === '/' ? undefined : row.counterparty,
        externalKey,
      });
      knownPendingIds.add(pending);
      continue;
    }
    const transaction: Transaction = row.kind === 'refund'
      ? { id, type: 'income', amount: row.amount, accountId: account.id, category: '退款', note, occurredAt: row.occurredAt, source: 'import', eventKind: 'refund', provider: providerLabel, externalKey }
      : { id, type: row.kind, amount: row.amount, accountId: account.id, category: mapping.category, budgetGroup: mapping.budgetGroup, note, occurredAt: row.occurredAt, source: 'import', provider: providerLabel, externalKey };
    transactions.push(transaction);
    knownTransactionIds.add(id);
    knownTransactionKeys.add(externalKey);
  }

  transactions.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const next = applyImportedTransactions(state, transactions);
  return {
    state: { ...next, pendingTransactions: [...pendingTransactions, ...next.pendingTransactions] },
    summary,
  };
}