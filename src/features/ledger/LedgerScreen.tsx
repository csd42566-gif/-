import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Account, LedgerState, PendingTransaction, ProviderIconStyle, Transaction, TransactionType } from '../../core/model/finance';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, spacing, radius, providerColors } from '../../ui/theme';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';
import { StatementImportSummary } from '../statement-import/statementImport';
import { StatementImportSheet } from '../statement-import/StatementImportSheet';
import { StatementProvider } from '../statement-import/statementTypes';
import { batchBlockedReason, batchSelectionState, BatchReviewResult, isBatchablePending, selectedBatchSummary } from './batchReview';

type ReviewAction = 'accept' | 'dismiss';
type FilterType = 'all' | TransactionType;

const manualProvider = '手动记账';
const providerOrder = ['支付宝', '微信', '招商银行', '工商银行', '建设银行', '中国银行', '中信银行', '抖音', '得物', '京东', '美团', manualProvider];

export function LedgerScreen({ state, onAdd, onReviewPending, onBatchConfirmPending, onImportStatement }: {
  state: LedgerState;
  onAdd: () => void;
  onReviewPending: (id: string, action: ReviewAction, edits?: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category' | 'debtId' | 'counterparty'>>) => void;
  onBatchConfirmPending: (ids: Set<string>) => Promise<BatchReviewResult>;
  onImportStatement: (provider: StatementProvider, text: string) => Promise<StatementImportSummary>;
}) {
  const [type, setType] = useState<FilterType>('all');
  const [accountId, setAccountId] = useState('all');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [collapsedProviders, setCollapsedProviders] = useState<string[]>([]);
  const [editing, setEditing] = useState<PendingTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editDebtId, setEditDebtId] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [statementImportVisible, setStatementImportVisible] = useState(false);
  const now = new Date();
  const providers = useMemo(() => providerList(state.transactions), [state.transactions]);
  const visible = useMemo(() => state.transactions.filter((transaction) => {
    const date = new Date(transaction.occurredAt);
    return (type === 'all' || transaction.type === type)
      && (accountId === 'all' || transaction.accountId === accountId || transaction.toAccountId === accountId)
      && (period === 'all' || (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()))
      && (selectedProvider === 'all' || providerOf(transaction) === selectedProvider);
  }).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)), [state.transactions, type, accountId, period, selectedProvider]);
  const expenseTotal = visible.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0);
  const toggleProvider = (provider: string) => setCollapsedProviders((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]);
  const beginEdit = (item: PendingTransaction) => {
    setEditing(item);
    setEditAmount(String(item.amount));
    setEditCategory(item.category ?? '');
    setEditAccountId(item.accountId ?? state.accounts[0]?.id ?? '');
    setEditDebtId(item.debtId ?? state.debts[0]?.id ?? '');
    setEditCounterparty(item.counterparty ?? '');
  };
  const commitEdit = () => {
    const amount = Number(editAmount);
    if (!editing || !Number.isFinite(amount) || amount <= 0) return;
    if (!state.accounts.some((account) => account.id === editAccountId)) return;
    onReviewPending(editing.id, 'accept', {
      amount,
      accountId: editAccountId,
      category: editCategory.trim() || undefined,
      ...(isRepayment(editing) ? { debtId: editDebtId || undefined } : {}),
      ...(editing.eventKind === 'proxy-repayment' ? { counterparty: editCounterparty.trim() || undefined } : {}),
    });
    setEditing(null);
  };
  const confirmPending = (item: PendingTransaction) => {
    if (!isPostable(item)) return;
    if (isRepayment(item) || !item.accountId || !state.accounts.some((account) => account.id === item.accountId)) beginEdit(item);
    else onReviewPending(item.id, 'accept');
  };

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>本月账本</Text><Text style={styles.title}>交易明细</Text>
      <View style={styles.summary}><Text style={styles.label}>当前筛选支出</Text><Text style={styles.total}>¥{expenseTotal.toFixed(2)}</Text><Text style={styles.caption}>转账独立记录，不计入收入或消费</Text></View>
      <Pressable onPress={() => setStatementImportVisible(true)} accessibilityRole="button" style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}><Text style={styles.importButtonText}>导入账单</Text></Pressable>

      <PendingReviewSection state={state} onReviewPending={onReviewPending} onBatchConfirmPending={onBatchConfirmPending} onBeginEdit={beginEdit} onConfirm={confirmPending} />

      <SectionTitle>账单来源</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerFilters}>
        <Choice label="全部账单" selected={selectedProvider === 'all'} onPress={() => setSelectedProvider('all')} />
        {providers.map((provider) => <Choice key={provider} label={provider} selected={selectedProvider === provider} onPress={() => setSelectedProvider(provider)} />)}
      </ScrollView>

      <SectionTitle>筛选</SectionTitle>
      <View style={styles.filters}>
        <Choice label="本月" selected={period === 'month'} onPress={() => setPeriod('month')} />
        <Choice label="全部月份" selected={period === 'all'} onPress={() => setPeriod('all')} />
        {(['all', 'expense', 'income', 'transfer'] as FilterType[]).map((item) => <Choice key={item} label={{ all: '全部', expense: '支出', income: '收入', transfer: '转账' }[item]} selected={type === item} onPress={() => setType(item)} />)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountFilters}>
        <Choice label="全部账户" selected={accountId === 'all'} onPress={() => setAccountId('all')} />
        {state.accounts.map((account) => <Choice key={account.id} label={account.name} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />)}
      </ScrollView>

      <SectionTitle>交易 · {visible.length}</SectionTitle>
      {selectedProvider === 'all'
        ? <GroupedTransactions transactions={visible} accounts={state.accounts} iconStyle={state.settings.providerIconStyle} collapsedProviders={collapsedProviders} onToggleProvider={toggleProvider} />
        : visible.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} accounts={state.accounts} iconStyle={state.settings.providerIconStyle} />)}
      {!visible.length && <View style={styles.empty}><Text style={styles.caption}>这个筛选条件下还没有交易。</Text></View>}
      <Pressable onPress={onAdd} accessibilityRole="button" style={styles.add}><Text style={styles.addText}>＋ 记一笔</Text></Pressable>
    </ScrollView>

    <StatementImportSheet visible={statementImportVisible} state={state} onClose={() => setStatementImportVisible(false)} onImport={onImportStatement} />
    <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>{editing && isRepayment(editing) ? '核对还款记录' : '核对识别记录'}</Text><Text style={styles.label}>记入账户</Text><View style={styles.accountChoices}>{state.accounts.map((account) => <Choice key={account.id} label={account.name} selected={editAccountId === account.id} onPress={() => setEditAccountId(account.id)} />)}</View>{editing && isRepayment(editing) && <><Text style={styles.label}>对应欠款</Text><View style={styles.accountChoices}>{state.debts.map((debt) => <Choice key={debt.id} label={`${debt.name} ¥${debt.amount.toFixed(0)}`} selected={editDebtId === debt.id} onPress={() => setEditDebtId(debt.id)} />)}</View>{!state.debts.length && <Text style={styles.noticeText}>还没有欠款记录，先在“欠账”里添加后再确认还款。</Text>}</>}<Text style={styles.label}>金额</Text><TextInput value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" style={styles.input} /><Text style={styles.label}>分类</Text><TextInput value={editCategory} onChangeText={setEditCategory} style={styles.input} />{editing?.eventKind === 'proxy-repayment' && <><Text style={styles.label}>代还对象</Text><TextInput value={editCounterparty} onChangeText={setEditCounterparty} placeholder="例如：张三" placeholderTextColor={colors.muted} style={styles.input} /></>}<View style={styles.sheetActions}><Text onPress={() => setEditing(null)} style={styles.dismiss}>取消</Text><Text onPress={commitEdit} style={styles.accept}>确认并记账</Text></View></View></View>
    </Modal>
  </View>;
}

function PendingReviewSection({ state, onReviewPending, onBatchConfirmPending, onBeginEdit, onConfirm }: {
  state: LedgerState;
  onReviewPending: (id: string, action: ReviewAction) => void;
  onBatchConfirmPending: (ids: Set<string>) => Promise<BatchReviewResult>;
  onBeginEdit: (item: PendingTransaction) => void;
  onConfirm: (item: PendingTransaction) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchReviewResult | null>(null);
  const [batchError, setBatchError] = useState('');
  const eligible = useMemo(() => state.pendingTransactions.filter((item) => isBatchablePending(item) && isPostable(item)), [state.pendingTransactions]);
  const eligibleIds = eligible.map((item) => item.id);
  const selectionState = batchSelectionState(eligibleIds, selectedIds);
  const summary = selectedBatchSummary(eligible, selectedIds);
  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => eligibleIds.includes(id)));
      return next.size === current.size ? current : next;
    });
  }, [state.pendingTransactions]);
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds(selectionState === 'all' ? new Set() : new Set(eligibleIds));
  };
  const executeBatch = async () => {
    setBatchBusy(true);
    setBatchError('');
    setBatchResult(null);
    try {
      const result = await onBatchConfirmPending(new Set(selectedIds));
      setBatchResult(result);
      setSelectedIds(new Set());
    } catch {
      setBatchError('批量确认失败，请稍后重试。');
    } finally {
      setBatchBusy(false);
    }
  };
  const confirmBatch = () => {
    if (!summary.count) return;
    Alert.alert('批量确认', `将入账 ${summary.count} 笔，支出 ¥${summary.expense.toFixed(2)} · 收入 ¥${summary.income.toFixed(2)}，确认后不可撤销`, [
      { text: '取消', style: 'cancel' },
      { text: '确认入账', onPress: () => { void executeBatch(); } },
    ]);
  };  return <><SectionTitle>待确认识别 · {state.pendingTransactions.length}</SectionTitle>
    {!!state.pendingTransactions.length && <View style={styles.batchBar}>
      <Pressable disabled={!eligibleIds.length || batchBusy} onPress={toggleAll} accessibilityRole="checkbox" accessibilityState={{ checked: selectionState === 'all' }} style={styles.batchSelectAll}>
        <BatchCheckbox state={selectionState} disabled={!eligibleIds.length || batchBusy} />
        <Text style={styles.batchSelectText}>全选</Text>
      </Pressable>
      <Text style={styles.batchSummary}>已选 {summary.count} 笔 · 支出 ¥{summary.expense.toFixed(2)} · 收入 ¥{summary.income.toFixed(2)}</Text>
      <Pressable disabled={!summary.count || batchBusy} onPress={confirmBatch} style={({ pressed }) => [styles.batchButton, (!summary.count || batchBusy) && styles.disabled, pressed && styles.pressed]}><Text style={styles.batchButtonText}>批量确认</Text></Pressable>
    </View>}
    {!!batchResult && <View style={[styles.batchResult, batchResult.failures.length > 0 ? styles.batchResultError : undefined]}>
      <Text style={styles.batchResultText}>成功 {batchResult.successCount} 笔，失败 {batchResult.failures.length} 笔</Text>
      {batchResult.failures.map((failure) => <Text key={failure.id} style={styles.batchFailure}>{failure.label}：{failure.reason}</Text>)}
    </View>}
    {!!batchError && <Text style={styles.error}>{batchError}</Text>}
    {state.pendingTransactions.length ? state.pendingTransactions.map((item) => {
      const batchable = isBatchablePending(item) && isPostable(item);
      const blockedReason = !item.accountId ? '需选择账户' : item.eventKind === 'repayment' ? '需选择欠款后确认' : !isPostable(item) ? '该记录不可批量入账' : '';
      return <PressableCard key={item.id} style={[styles.pending, !isPostable(item) && styles.pendingNotice]}>
        <View style={styles.pendingHeading}>
          <Pressable disabled={!batchable || batchBusy} onPress={() => toggleSelected(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selectedIds.has(item.id), disabled: !batchable }} style={styles.batchCheckTarget}>
            <BatchCheckbox state={selectedIds.has(item.id) ? 'all' : 'none'} disabled={!batchable || batchBusy} />
          </Pressable>
          <View style={styles.pendingContent}>
            <View style={styles.row}><Text style={styles.name}>{pendingTitle(item)}</Text><Text style={styles.amount}>¥{item.amount.toFixed(2)}</Text></View>
            <Text style={styles.caption}>{item.provider ? `${item.provider} · ` : ''}{item.counterparty ? `对象：${item.counterparty} · ` : ''}{item.note || '识别到一笔交易'} · 置信度 {Math.round(item.confidence * 100)}% · {item.source === 'notification' ? '通知' : item.source === 'import' ? '导入' : item.source}</Text>
            {!batchable && <Text style={styles.blockedReason}>{blockedReason}</Text>}
          </View>
        </View>
        {!isPostable(item) && <Text style={styles.noticeText}>{item.eventKind === 'repayment-failed' ? '还款未成功，仅作失败记录，不会扣减欠款。' : '这是待还提醒，不会直接记为支出。'}</Text>}
        <View style={styles.actions}><Text onPress={() => onReviewPending(item.id, 'dismiss')} style={styles.dismiss}>忽略</Text>{isPostable(item) && <><Text onPress={() => onBeginEdit(item)} style={styles.edit}>编辑</Text><Text onPress={() => onConfirm(item)} style={styles.accept}>确认</Text></>}</View>
      </PressableCard>;
    }) : <View style={styles.empty}><Text style={styles.emptyTitle}>没有待确认记录</Text><Text style={styles.caption}>短信、通知和账单接入后，识别结果会先在这里核对。</Text></View>}
  </>;
}

function BatchCheckbox({ state, disabled }: { state: 'none' | 'partial' | 'all'; disabled: boolean }) {
  return <View style={[styles.checkbox, state !== 'none' && styles.checkboxChecked, disabled && styles.checkboxDisabled]}>
    <Text style={styles.checkboxGlyph}>{state === 'all' ? '✓' : state === 'partial' ? '−' : ''}</Text>
  </View>;
}
function GroupedTransactions({ transactions, accounts, iconStyle, collapsedProviders, onToggleProvider }: {
  transactions: Transaction[];
  accounts: Account[];
  iconStyle: ProviderIconStyle;
  collapsedProviders: string[];
  onToggleProvider: (provider: string) => void;
}) {
  const groups = providerList(transactions).map((provider) => ({ provider, transactions: transactions.filter((transaction) => providerOf(transaction) === provider) }));
  return <>{groups.map((group) => {
    const collapsed = collapsedProviders.includes(group.provider);
    return <View key={group.provider} style={styles.group}>
      <Pressable onPress={() => onToggleProvider(group.provider)} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}>
        <View style={styles.groupIdentity}><ProviderIcon provider={group.provider} iconStyle={iconStyle} /><Text style={styles.groupName}>{group.provider}</Text><Text style={styles.groupCount}>{group.transactions.length} 笔</Text></View>
        <View style={styles.groupMeta}><Text style={styles.groupTotal}>-¥{expenseSum(group.transactions).toFixed(2)}</Text><Text style={styles.groupChevron}>{collapsed ? '›' : '⌄'}</Text></View>
      </Pressable>
      {!collapsed && group.transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} accounts={accounts} iconStyle={iconStyle} />)}
    </View>;
  })}</>;
}

function TransactionRow({ transaction, accounts, iconStyle }: { transaction: Transaction; accounts: Account[]; iconStyle: ProviderIconStyle }) {
  const account = accounts.find((item) => item.id === transaction.accountId)?.name ?? '账户已移除';
  return <PressableCard style={styles.transaction}>
    <View style={styles.transactionIdentity}>
      <ProviderIcon provider={providerOf(transaction)} iconStyle={iconStyle} />
      <View style={styles.transactionMain}>
        <View style={styles.row}><Text style={styles.name}>{transaction.category ?? (transaction.type === 'income' ? '收入' : transaction.type === 'transfer' ? '账户转账' : '未分类')}</Text><Text style={[styles.amount, transaction.type === 'income' ? styles.income : transaction.type === 'expense' ? styles.expense : styles.transfer]}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '↔'}¥{transaction.amount.toFixed(2)}</Text></View>
        <Text style={styles.caption}>{transaction.occurredAt.slice(0, 16).replace('T', ' ')} · {account}{transaction.note ? ` · ${transaction.note}` : ''}</Text>
      </View>
    </View>
  </PressableCard>;
}

type FontAwesomeName = React.ComponentProps<typeof FontAwesome5>['name'];

const providerLogos: Record<string, { name: FontAwesomeName; color: string }> = {
  支付宝: { name: 'alipay', color: providerColors.alipay },
  微信: { name: 'weixin', color: providerColors.wechat },
  招商银行: { name: 'university', color: providerColors.cmb },
  工商银行: { name: 'university', color: providerColors.icbc },
  建设银行: { name: 'university', color: providerColors.ccb },
  中国银行: { name: 'university', color: providerColors.boc },
  中信银行: { name: 'credit-card', color: providerColors.citic },
  抖音: { name: 'tiktok', color: providerColors.douyin },
  京东: { name: 'shopping-cart', color: providerColors.jd },
  得物: { name: 'shopping-bag', color: providerColors.dewu },
  美团: { name: 'utensils', color: providerColors.meituan },
  手动记账: { name: 'edit', color: colors.accent },
};

function ProviderIcon({ provider, iconStyle }: { provider: string; iconStyle: ProviderIconStyle }) {
  return iconStyle === 'logo' ? <ProviderLogo provider={provider} /> : <ProviderBadge provider={provider} />;
}

function ProviderLogo({ provider }: { provider: string }) {
  const logo = providerLogos[provider] ?? { name: 'ellipsis-h' as const, color: colors.muted };
  return <View style={[styles.providerLogo, { borderColor: logo.color }]}><FontAwesome5 name={logo.name} size={17} color={logo.color} /></View>;
}

function ProviderBadge({ provider }: { provider: string }) {
  const badge = providerBadge(provider);
  return <View style={[styles.providerBadge, { backgroundColor: badge.background }]}><Text style={styles.providerBadgeText}>{badge.label}</Text></View>;
}

function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function providerOf(transaction: Transaction): string {
  return transaction.provider?.trim() || manualProvider;
}

function providerList(transactions: Transaction[]): string[] {
  const present = Array.from(new Set(transactions.map(providerOf)));
  return present.sort((left, right) => {
    const leftIndex = providerOrder.indexOf(left);
    const rightIndex = providerOrder.indexOf(right);
    return (leftIndex < 0 ? providerOrder.length : leftIndex) - (rightIndex < 0 ? providerOrder.length : rightIndex);
  });
}

function expenseSum(transactions: Transaction[]): number {
  return transactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0);
}

function providerBadge(provider: string): { label: string; background: string } {
  const badges: Record<string, { label: string; background: string }> = {
    支付宝: { label: '支', background: providerColors.alipay },
    微信: { label: '微', background: providerColors.wechat },
    招商银行: { label: '招', background: providerColors.cmb },
    工商银行: { label: '工', background: providerColors.icbc },
    建设银行: { label: '建', background: providerColors.ccb },
    中国银行: { label: '中', background: providerColors.boc },
    中信银行: { label: '信', background: providerColors.citic },
    抖音: { label: '抖', background: providerColors.douyin },
    得物: { label: '得', background: providerColors.dewu },
    京东: { label: '京', background: providerColors.jd },
    美团: { label: '美', background: providerColors.meituan },
    [manualProvider]: { label: '记', background: colors.accent },
  };
  return badges[provider] ?? { label: provider.slice(0, 1) || '账', background: colors.muted };
}

function isRepayment(item: PendingTransaction): boolean {
  return item.eventKind === 'repayment' || item.eventKind === 'proxy-repayment';
}

function isPostable(item: PendingTransaction): boolean {
  return item.eventKind !== 'repayment-reminder' && item.eventKind !== 'repayment-failed' && item.eventStatus !== 'reminder' && item.eventStatus !== 'failed';
}

function pendingTitle(item: PendingTransaction): string {
  if (item.eventKind === 'repayment') return '还款成功';
  if (item.eventKind === 'proxy-repayment') return '代还成功';
  if (item.eventKind === 'repayment-reminder') return '待还提醒';
  if (item.eventKind === 'repayment-failed') return '还款失败';
  return item.category ?? (item.type === 'income' ? '识别收入' : '识别支出');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 90 },
  kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 25, fontWeight: '800', color: colors.ink, marginTop: 4 },
  summary: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 12, color: colors.muted },
  total: { fontSize: 30, fontWeight: '900', color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 11, color: colors.muted, marginTop: 5 },
  pending: { marginBottom: 8, borderColor: colors.warning }, pendingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, pendingContent: { flex: 1 }, batchBar: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line }, batchSelectAll: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }, batchSelectText: { fontSize: 11, color: colors.ink, fontWeight: '700' }, batchSummary: { flex: 1, minWidth: 160, fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] }, batchButton: { minHeight: 40, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.accent }, batchButtonText: { fontSize: 11, color: colors.surface, fontWeight: '800' }, batchCheckTarget: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.muted, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, checkboxDisabled: { opacity: 0.35 }, checkboxGlyph: { fontSize: 13, color: colors.accent, fontWeight: '900' }, blockedReason: { fontSize: 10, color: colors.warning, marginTop: spacing.xxs }, batchResult: { marginVertical: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.successSoft }, batchResultError: { backgroundColor: colors.dangerSoft }, batchResultText: { fontSize: 11, color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }, batchFailure: { fontSize: 10, color: colors.danger, marginTop: spacing.xxs },
  pendingNotice: { borderColor: colors.line },
  noticeText: { fontSize: 11, color: colors.warning, marginTop: 8, lineHeight: 16 },
  transaction: { marginBottom: 8 },
  transactionIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transactionMain: { flex: 1 },
  providerBadge: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  providerLogo: { width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  providerBadgeText: { fontSize: 14, fontWeight: '900', color: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  amount: { fontSize: 13, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  income: { color: colors.success },
  expense: { color: colors.danger },
  transfer: { color: colors.accent },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 12 },
  dismiss: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  edit: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  accept: { fontSize: 12, color: colors.success, fontWeight: '800' },
  empty: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  emptyTitle: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  providerFilters: { gap: 6, paddingVertical: 9 },
  accountFilters: { gap: 6, paddingVertical: 9 },
  accountChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 12 },
  choice: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  choiceSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceText: { fontSize: 11, color: colors.muted },
  choiceTextSelected: { color: colors.ink, fontWeight: '800' },
  group: { marginBottom: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  groupIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupName: { fontSize: 13, fontWeight: '800', color: colors.ink },
  groupCount: { fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTotal: { fontSize: 12, fontWeight: '800', color: colors.danger, fontVariant: ['tabular-nums'] },
  groupChevron: { fontSize: 16, color: colors.muted },
  add: { alignItems: 'center', padding: 16 },
  addText: { fontSize: 13, fontWeight: '800', color: colors.accent },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { padding: 20, paddingBottom: 30, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 16 },
  input: { height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, color: colors.ink, marginTop: 6, marginBottom: 12 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22, marginTop: 8 },
  importButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40, marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  importButtonText: { fontSize: 12, fontWeight: '800', color: colors.accent },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 }, disabled: { opacity: 0.45 }, error: { fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});