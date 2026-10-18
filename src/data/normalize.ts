import { Account, Allowance, AttendanceRecord, Debt, defaultSettings, EssentialItem, Goal, LedgerState, PendingTransaction, Settings, Transaction, WorkProfile } from '../core/model/finance';

export function normalizeLedgerState(value: unknown): LedgerState {
  if (!value || typeof value !== 'object') throw new Error('ledger-state-invalid');
  const state = value as Partial<LedgerState>;
  const rawSettings = state.settings && typeof state.settings === 'object' ? state.settings as Partial<Settings> : {};
  const accountDisplayOrder = Array.isArray(rawSettings.accountDisplayOrder)
    ? [...new Set(rawSettings.accountDisplayOrder.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : defaultSettings.accountDisplayOrder;
  const providerIconStyle = rawSettings.providerIconStyle === 'badge' || rawSettings.providerIconStyle === 'logo'
    ? rawSettings.providerIconStyle
    : defaultSettings.providerIconStyle;
  const accountMapping = normalizeAccountMapping(rawSettings.accountMapping);
  const essentialItems = normalizeEssentialItems(rawSettings.essentialItems, rawSettings.essentialMonthlyExpenses);
  const essentialMonthlyExpenses = essentialItemsTotal(essentialItems);
  const work = normalizeWorkProfile(rawSettings.work);
  return {
    accounts: Array.isArray(state.accounts) ? state.accounts : [],
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    pendingTransactions: Array.isArray(state.pendingTransactions) ? state.pendingTransactions.map(normalizePendingTransaction) : [],
    debts: normalizeDebts(state.debts),
    goal: normalizeGoal(state.goal, Array.isArray(state.accounts) ? state.accounts : [], Array.isArray(state.transactions) ? state.transactions : []),
    attendance: normalizeAttendance(state.attendance),
    settings: { ...defaultSettings, ...rawSettings, work, accountDisplayOrder, accountMapping, essentialItems, essentialMonthlyExpenses, providerIconStyle },
  };
}

function normalizePendingTransaction(value: unknown): PendingTransaction {
  const item = { ...(value as PendingTransaction & { rawText?: unknown }) };
  delete item.rawText;
  const eventKind = enumValue(item.eventKind, ['payment', 'repayment', 'proxy-repayment', 'repayment-reminder', 'repayment-failed', 'refund'] as const);
  const eventStatus = enumValue(item.eventStatus, ['success', 'reminder', 'failed'] as const);
  const provider = boundedText(item.provider, 80);
  const debtId = boundedText(item.debtId, 100);
  const counterparty = boundedText(item.counterparty, 80);
  const accountLabel = boundedText(item.accountLabel, 120);
  if (eventKind) item.eventKind = eventKind; else delete item.eventKind;
  if (eventStatus) item.eventStatus = eventStatus; else delete item.eventStatus;
  if (provider) item.provider = provider; else delete item.provider;
  if (debtId) item.debtId = debtId; else delete item.debtId;
  if (counterparty) item.counterparty = counterparty; else delete item.counterparty;
  if (accountLabel) item.accountLabel = accountLabel; else delete item.accountLabel;
  return item;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function normalizeEssentialItems(value: unknown, legacyTotal: unknown): EssentialItem[] {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    return value.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return [];
      const raw = item as Partial<EssentialItem>;
      const name = boundedText(raw.name, 40);
      if (!name) return [];
      let id = boundedText(raw.id, 80) ?? 'essential-' + index;
      if (seen.has(id)) id = id + '-' + index;
      seen.add(id);
      return [{
        id,
        name,
        amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? roundCurrency(Math.max(0, raw.amount)) : 0,
      }];
    });
  }
  if (typeof legacyTotal === 'number' && Number.isFinite(legacyTotal) && legacyTotal > 0) {
    return [{ id: 'legacy-other', name: '其他', amount: roundCurrency(legacyTotal) }];
  }
  return defaultSettings.essentialItems.map((item) => ({ ...item }));
}

function essentialItemsTotal(items: EssentialItem[]): number {
  return roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAccountMapping(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && entry[0].trim().length > 0 && typeof entry[1] === 'string' && entry[1].trim().length > 0)
    .map(([label, accountId]) => [label.trim().slice(0, 120), accountId.trim().slice(0, 100)]));
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}
function normalizeDebts(value: unknown): Debt[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    ...(item as Debt),
    repaymentMode: (item as { repaymentMode?: unknown }).repaymentMode === 'full' ? 'full' : 'minimum',
  }));
}

function normalizeGoal(value: unknown, accounts: Account[], transactions: Transaction[]): Goal | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Goal> & { savedAmount?: unknown };
  const currentBalance = accounts.reduce((sum, account) => account.kind === 'credit' ? sum : sum + Math.max(0, account.balance), 0);
  const income = transactions
    .filter((transaction) => transaction.type === 'income' && transaction.eventKind !== 'refund')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const legacySaved = typeof raw.savedAmount === 'number' ? raw.savedAmount : 0;
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    targetAmount: raw.targetAmount ?? 0,
    startBalance: typeof raw.startBalance === 'number' ? raw.startBalance : Math.round((currentBalance - income - legacySaved) * 100) / 100,
    startBalanceAt: typeof raw.startBalanceAt === 'string' ? raw.startBalanceAt : new Date(0).toISOString(),
    deadline: raw.deadline ?? '',
  };
}
function normalizeWorkProfile(value: unknown): WorkProfile {
  const raw = value && typeof value === 'object'
    ? value as Partial<WorkProfile> & { probationEndDate?: unknown }
    : {};
  const { probationEndDate: legacyRegularStartDate, ...work } = raw;
  const regularStartDate = typeof raw.regularStartDate === 'string'
    ? raw.regularStartDate
    : typeof legacyRegularStartDate === 'string'
      ? legacyRegularStartDate
      : defaultSettings.work.regularStartDate;
  const probationStartDate = typeof raw.probationStartDate === 'string'
    ? raw.probationStartDate
    : defaultSettings.work.probationStartDate;
  return {
    ...defaultSettings.work,
    ...work,
    probationStartDate,
    regularStartDate,
    allowances: Array.isArray(raw.allowances) ? raw.allowances.map(normalizeAllowance) : defaultSettings.work.allowances,
  };
}

function normalizeAllowance(value: unknown): Allowance {
  const raw = value && typeof value === 'object' ? value as Partial<Allowance> : {};
  return {
    name: typeof raw.name === 'string' ? raw.name : '补贴',
    amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : 0,
    mode: raw.mode === 'per-day' ? 'per-day' : 'fixed',
    phase: raw.phase === 'probation' || raw.phase === 'both' ? raw.phase : 'regular',
  };
}

function normalizeAttendance(value: unknown): AttendanceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AttendanceRecord => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Partial<AttendanceRecord>;
    return typeof record.date === 'string' && (record.status === 'worked' || record.status === 'rest' || record.status === 'leave');
  });
}
