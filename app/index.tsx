import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { ActivityIndicator, Animated, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { HomeScreen } from '../src/features/home/HomeScreen';
import { QPressable } from '../src/ui/components/QPressable';
import { LedgerScreen } from '../src/features/ledger/LedgerScreen';
import { DebtsScreen } from '../src/features/debts/DebtsScreen';
import { GoalsScreen } from '../src/features/goals/GoalsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { BottomNav, Tab } from '../src/ui/components/BottomNav';
import { colors, spacing, radius } from '../src/ui/theme';
import { BudgetGroup, LedgerState, PendingTransaction, RepaymentMode, RiskCardMode, Settings, TransactionType, WorkProfile } from '../src/core/model/finance';
import { deriveFinancials } from '../src/core/finance/derive';
import { calculateEarnings } from '../src/core/work/attendance';
import { loadState, saveState } from '../src/data/storage';
import { recordTransaction, reviewDetectedTransaction } from '../src/features/ledger/ledger';
import { GoalDraft, updateGoal } from '../src/features/goals/goals';
import { logger } from '../src/core/logging/logger';
import { createAccount } from '../src/features/accounts/accounts';
import { BalanceReconcileEntry, reconcileAccountBalances } from '../src/features/accounts/reconcile';
import { createClearedLedgerState } from '../src/features/settings/escape';
import { appendAccountId } from '../src/features/accounts/accountOrder';
import { nativeFinance } from '../src/integrations/notifications/nativeFinance';
import { mergeNotificationCandidates } from '../src/integrations/notifications/sync';
import { isModuleControlDeepLink } from '../src/integrations/magisk/module';
import { RepaymentProvider } from '../src/features/repayment-import/parsers';
import { importInstallmentRepayment, importRepaymentText } from '../src/features/repayment-import/repaymentImport';
import { InstallmentDraft } from '../src/features/repayment-import/installments';
import { importStatement as importProviderStatement, StatementImportSummary } from '../src/features/statement-import/statementImport';
import { StatementProvider } from '../src/features/statement-import/statementTypes';
import { clockInAttendance, clockOutAttendance, markAttendanceRest, undoAttendanceRest } from '../src/features/attendance/attendance';
import { evaluateTransaction, PunishmentResult } from '../src/features/ledger/punishment';
import { buildStatusNotificationPayload, formatStatusNotificationText } from '../src/integrations/notifications/statusService';
import { BatchReviewResult, reviewPendingBatch as applyPendingBatch } from '../src/features/ledger/batchReview';

type Draft = { type: TransactionType; amount: number; accountId: string; toAccountId?: string; category?: string; budgetGroup?: BudgetGroup; note?: string };

export default function Index() {
  const [state, setState] = useState<LedgerState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [modulePanelRequested, setModulePanelRequested] = useState(false);
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('餐饮');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [budgetGroup, setBudgetGroup] = useState<BudgetGroup>('flexible');
  const [impact, setImpact] = useState<{ balance: number; dailySpend: number; goalDailySave: number; goalRemaining: number; shortfall: number; extraWorkHours: number } | null>(null);
  const [punishment, setPunishment] = useState<PunishmentResult | null>(null);
  const [homeAmountPulse, setHomeAmountPulse] = useState(0);
  const [error, setError] = useState('');
  const anim = useRef(new Animated.Value(0)).current;
  const punishmentAnim = useRef(new Animated.Value(0)).current;
  const punishmentShake = useRef(new Animated.Value(0)).current;
  const stateRef = useRef<LedgerState | null>(null);
  const commitQueue = useRef<Promise<void>>(Promise.resolve());
  const vibrateIfEnabled = () => { if (stateRef.current?.settings.hapticsEnabled) Vibration.vibrate(8); };
  const commit = useCallback(async (updater: (previous: LedgerState) => LedgerState): Promise<LedgerState> => {
    const operation = commitQueue.current.then(async () => {
      const previous = stateRef.current;
      if (!previous) throw new Error('ledger-state-not-ready');
      const next = updater(previous);
      if (next === previous) return previous;
      try {
        await saveState(next);
      } catch (caught) {
        setError('保存失败，当前更改尚未写入本地存储。');
        throw caught;
      }
      stateRef.current = next;
      setState(next);
      if (next.settings.statusServiceEnabled) {
        void nativeFinance.updateStatusService(formatStatusNotificationText(buildStatusNotificationPayload(next))).catch((caught) => {
          logger.log('warn', 'STATUS_SERVICE_UPDATE_FAILED', caught instanceof Error ? caught.message : 'unknown');
        });
      }
      return next;
    });
    commitQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  useEffect(() => {
    loadState().then((loaded) => {
      stateRef.current = loaded;
      setState(loaded);
      setAccountId(loaded.accounts[0]?.id ?? '');
      setToAccountId(loaded.accounts[1]?.id ?? loaded.accounts[0]?.id ?? '');
      if (loaded.settings.statusServiceEnabled && nativeFinance.available) {
        void nativeFinance.startStatusService(formatStatusNotificationText(buildStatusNotificationPayload(loaded))).catch((caught) => {
          logger.log('warn', 'STATUS_SERVICE_RESTORE_FAILED', caught instanceof Error ? caught.message : 'unknown');
        });
      }
    }).catch(() => setError('本地账本读取失败，请重启应用重试。'));
  }, []);
  useEffect(() => {
    let active = true;
    const openFromUrl = (url: string | null) => {
      if (!active || !isModuleControlDeepLink(url)) return;
      setTab('me');
      setModulePanelRequested(true);
    };
    Linking.getInitialURL().then(openFromUrl).catch((error) => logger.log('warn', 'MODULE_DEEP_LINK_UNAVAILABLE', error instanceof Error ? error.message : 'unknown'));
    const subscription = Linking.addEventListener('url', ({ url }) => openFromUrl(url));
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!state || !nativeFinance.available) return;
    let active = true;
    const pullCandidates = async () => {
      try {
        const events = await nativeFinance.consumeNotificationCandidates();
        if (!active || events.length === 0) return;
        await commit((previous) => mergeNotificationCandidates(previous, events));
      } catch { logger.log('warn', 'NOTIFICATION_QUEUE_UNAVAILABLE', ''); }
    };
    pullCandidates();
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') pullCandidates(); });
    return () => { active = false; subscription.remove(); };
  }, [!!state, commit]);
  useEffect(() => {
    if (!modal) { anim.setValue(0); return; }
    if (state?.settings.reducedMotion) { anim.setValue(1); return; }
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
  }, [modal, state?.settings.reducedMotion, anim]);
  useEffect(() => {
    const reducedMotion = !!state?.settings.reducedMotion;
    punishmentAnim.stopAnimation();
    punishmentShake.stopAnimation();
    if (reducedMotion || !punishment || punishment.level === 'none' || !impact) {
      punishmentAnim.setValue(reducedMotion && punishment && punishment.level !== 'none' ? 1 : 0);
      punishmentShake.setValue(0);
      return;
    }
    punishmentAnim.setValue(0);
    punishmentShake.setValue(0);
    const entrance = Animated.timing(punishmentAnim, { toValue: 1, duration: 220, useNativeDriver: true });
    const shake = punishment.level === 'severe'
      ? Animated.sequence([
          Animated.timing(punishmentShake, { toValue: -3, duration: 40, useNativeDriver: true }),
          Animated.timing(punishmentShake, { toValue: 3, duration: 40, useNativeDriver: true }),
          Animated.timing(punishmentShake, { toValue: 0, duration: 40, useNativeDriver: true }),
        ])
      : null;
    const operation = shake ? Animated.sequence([entrance, shake]) : entrance;
    operation.start();
    return () => operation.stop();
  }, [punishment, impact, state?.settings.reducedMotion, punishmentAnim, punishmentShake]);

  if (!state) return <View style={styles.loading}><ActivityIndicator color={colors.accent}/><Text style={styles.loadingText}>{error || '正在加载本地账本…'}</Text></View>;
  const openAdd = () => {
    if (!state.accounts.length) { setTab('me'); return; }
    setAmount(''); setCategory('餐饮'); setNote(''); setType('expense'); setBudgetGroup('flexible'); setImpact(null); setPunishment(null); setError(''); setModal(true);
  };
  const closeTransactionModal = () => {
    setModal(false);
    if (impact) setHomeAmountPulse((value) => value + 1);
  };
  const draft: Draft | null = Number.isFinite(Number(amount)) && Number(amount) > 0 && accountId ? {
    type, amount: Number(amount), accountId, ...(type === 'transfer' ? { toAccountId } : {}),
    ...(type !== 'transfer' ? { category, ...(type === 'expense' ? { budgetGroup } : {}) } : {}), note: note.trim() || undefined,
  } : null;
  const impactFor = (next: LedgerState, candidate: Draft) => {
    const financials = deriveFinancials(next);
    return { balance: next.accounts.find((account) => account.id === candidate.accountId)?.balance ?? 0, dailySpend: financials.todaySpendable, goalDailySave: financials.goalDailySave, goalRemaining: financials.goalRemaining, shortfall: financials.shortfall, extraWorkHours: financials.extraWorkHours };
  };
  const projected = (candidate: Draft) => impactFor(recordTransaction(state, candidate), candidate);
  const preview = draft && !impact ? (() => { try { return projected(draft); } catch { return null; } })() : null;
  const confirm = async () => {
    if (!draft) { setError('请检查金额和账户。'); return; }
    const now = new Date();
    const financialsBefore = deriveFinancials(state, now);
    const earnings = calculateEarnings(state.settings.work, state.attendance ?? [], now);
    try {
      const next = await commit((previous) => recordTransaction(previous, draft));
      setPunishment(state.settings.reminderMode === 'punish'
        ? evaluateTransaction({ draft, earnings, financials: financialsBefore })
        : null);
      setImpact(impactFor(next, draft));
      setError('');
      vibrateIfEnabled();
      logger.log('info', 'TRANSACTION_CONFIRMED', '');
    } catch { setError(type === 'transfer' ? '转账账户无效，请选择两个不同账户。' : '记账失败，请检查金额和账户后重试。'); }
  };
  const reviewPending = async (id: string, action: 'accept' | 'dismiss', edits?: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category' | 'debtId' | 'counterparty'>>) => {
    try {
      await commit((previous) => reviewDetectedTransaction(previous, id, action, edits));
      logger.log('info', action === 'accept' ? 'DETECTED_TRANSACTION_ACCEPTED' : 'DETECTED_TRANSACTION_DISMISSED', '');
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setError(code === 'repayment-debt-invalid' ? '请选择对应的欠款后再确认还款。' : code === 'detected-event-not-postable' ? '提醒或失败通知不能直接记为支出。' : '更新识别记录失败，请重试。');
    }
  };
  const reviewPendingBatch = async (ids: Set<string>, accountOverrides?: ReadonlyMap<string, string>): Promise<BatchReviewResult> => {
    let result: BatchReviewResult | undefined;
    await commit((previous) => {
      result = applyPendingBatch(previous, ids, accountOverrides);
      return result.state;
    });
    if (!result) throw new Error('batch-review-result-missing');
    logger.log('info', 'DETECTED_TRANSACTIONS_BATCH_REVIEWED', 'success=' + result.successCount + ' failed=' + result.failures.length);
    return result;
  };
  const updateSettings = async (patch: Partial<Settings>) => {
    await commit((previous) => ({ ...previous, settings: { ...previous.settings, ...patch } }));
  };
  const setStatusServiceEnabled = async (enabled: boolean) => {
    const current = stateRef.current;
    if (!current) throw new Error('ledger-state-not-ready');
    if (enabled) {
      if (!nativeFinance.available) throw new Error('status-service-unavailable');
      const existingPermission = await Notifications.getPermissionsAsync();
      const permission = existingPermission.granted ? existingPermission : await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('notification-permission-denied');
      await nativeFinance.startStatusService(formatStatusNotificationText(buildStatusNotificationPayload(current)));
      try {
        await commit((previous) => ({ ...previous, settings: { ...previous.settings, statusServiceEnabled: true } }));
      } catch (caught) {
        await nativeFinance.stopStatusService().catch(() => undefined);
        throw caught;
      }
      return;
    }
    try {
      await nativeFinance.stopStatusService();
    } catch (caught) {
      logger.log('warn', 'STATUS_SERVICE_STOP_FAILED', caught instanceof Error ? caught.message : 'unknown');
    }
    await commit((previous) => ({ ...previous, settings: { ...previous.settings, statusServiceEnabled: false } }));
  };
  const updateWorkProfile = async (patch: Partial<WorkProfile>) => {
    await commit((previous) => ({
      ...previous,
      settings: { ...previous.settings, work: { ...previous.settings.work, ...patch } },
    }));
  };
  const clockIn = async (at = new Date()) => {
    const now = at;
    await commit((previous) => clockInAttendance(previous, now));
    vibrateIfEnabled();
    logger.log('info', 'ATTENDANCE_CLOCK_IN', '');
  };
  const clockOut = async () => {
    const now = new Date();
    await commit((previous) => clockOutAttendance(previous, now));
    vibrateIfEnabled();
    logger.log('info', 'ATTENDANCE_CLOCK_OUT', '');
  };
  const markRest = async (at = new Date()) => {
    const now = at;
    await commit((previous) => markAttendanceRest(previous, now));
    vibrateIfEnabled();
    logger.log('info', 'ATTENDANCE_REST', '');
  };
  const undoRest = async () => {
    const now = new Date();
    await commit((previous) => undoAttendanceRest(previous, now));
    vibrateIfEnabled();
    logger.log('info', 'ATTENDANCE_REST_UNDONE', '');
  };
  const updateAccountDisplayOrder = async (order: string[]) => {
    await commit((previous) => ({ ...previous, settings: { ...previous.settings, accountDisplayOrder: order } }));
  };
  const addAccount = async (account: ReturnType<typeof createAccount>) => {
    await commit((previous) => {
      const accountDisplayOrder = appendAccountId(previous.accounts, previous.settings.accountDisplayOrder, account.id);
      return { ...previous, accounts: [...previous.accounts, account], settings: { ...previous.settings, accountDisplayOrder } };
    });
    if (!accountId) setAccountId(account.id);
    if (!toAccountId) setToAccountId(account.id);
  };
  const reconcileBalances = async (entries: BalanceReconcileEntry[]) => {
    await commit((previous) => reconcileAccountBalances(previous, entries));
    logger.log('info', 'ACCOUNT_BALANCES_RECONCILED', `accounts=${entries.length}`);
  };

  const updateDebtRepaymentMode = async (debtId: string, mode: RepaymentMode) => {
    await commit((previous) => ({
      ...previous,
      debts: previous.debts.map((debt) => debt.id === debtId ? { ...debt, repaymentMode: mode } : debt),
    }));
    logger.log('info', 'DEBT_REPAYMENT_MODE_UPDATED', `debt=${debtId} mode=${mode}`);
  };
  const clearAllData = async () => {
    await commit(() => createClearedLedgerState());
    logger.log('info', 'ALL_DATA_CLEARED', '');
  };
  const changeRiskMode = (mode: RiskCardMode) => updateSettings({ riskCardMode: mode });
  const saveGoal = async (goalDraft: GoalDraft) => {
    await commit((previous) => updateGoal(previous, goalDraft));
    logger.log('info', 'GOAL_UPDATED', '');
  };
  const importStatement = async (provider: StatementProvider, text: string): Promise<StatementImportSummary> => {
    const imported: { summary?: StatementImportSummary } = {};
    await commit((previous) => {
      const result = importProviderStatement(previous, provider, text);
      imported.summary = result.summary;
      return result.summary.importableCount > 0 ? result.state : previous;
    });
    const summary = imported.summary;
    if (!summary) throw new Error('statement-import-result-missing');
    logger.log('info', 'STATEMENT_IMPORTED', `provider=${provider} expenses=${summary.expenseCount} refunds=${summary.refundCount} repayments=${summary.repaymentCount} skipped=${summary.transferCount + summary.skippedClosed + summary.skippedZero}`);
    return summary;
  };
  const importInstallment = async (provider: RepaymentProvider, draft: InstallmentDraft) => {
    let duplicate = false;
    await commit((previous) => {
      const result = importInstallmentRepayment(previous, provider, draft);
      duplicate = result.duplicate;
      return result.duplicate ? previous : result.state;
    });
    logger.log('info', duplicate ? 'INSTALLMENT_IMPORT_DUPLICATE' : 'INSTALLMENT_IMPORT_QUEUED', `provider=${provider} periods=${draft.periods.length}`);
    return { duplicate };
  };
  const importRepayment = async (provider: RepaymentProvider, text: string) => {
    let duplicate = false;
    await commit((previous) => {
      const result = importRepaymentText(previous, provider, text);
      duplicate = result.duplicate;
      return result.duplicate ? previous : result.state;
    });
    if (!duplicate) setTab('ledger');
    logger.log('info', duplicate ? 'REPAYMENT_IMPORT_DUPLICATE' : 'REPAYMENT_IMPORT_QUEUED', `provider=${provider}`);
    return { duplicate };
  };
  const screen = tab === 'home'
    ? <HomeScreen state={state} amountAnimationKey={homeAmountPulse} onAdd={openAdd} onGoSettings={() => setTab('me')} onGoGoals={() => setTab('goals')} onGoDebts={() => setTab('debts')} onClockIn={clockIn} onClockOut={clockOut} onMarkRest={markRest} onUndoRest={undoRest} />
    : tab === 'ledger' ? <LedgerScreen state={state} onAdd={openAdd} onReviewPending={reviewPending} onBatchConfirmPending={reviewPendingBatch} onImportStatement={importStatement} />
      : tab === 'debts' ? <DebtsScreen state={state} onImportRepayment={importRepayment} onImportInstallment={importInstallment} onUpdateRepaymentMode={updateDebtRepaymentMode} />
        : tab === 'goals' ? <GoalsScreen state={state} onSaveGoal={saveGoal} onUpdateAccountDisplayOrder={updateAccountDisplayOrder} />
          : <SettingsScreen state={state} onChangeRiskMode={changeRiskMode} onUpdateSettings={updateSettings} onUpdateWorkProfile={updateWorkProfile} onSetStatusServiceEnabled={setStatusServiceEnabled} onClockInAttendance={clockIn} onMarkAttendanceRest={markRest} onCreateAccount={addAccount} onReconcileBalances={reconcileBalances} onClearAllData={clearAllData} openModulePanel={modulePanelRequested} onModulePanelOpened={() => setModulePanelRequested(false)} />;

  return <View style={styles.root}>
    <View style={styles.content}>{screen}</View>
    <BottomNav active={tab} onChange={setTab} />
    <Modal visible={modal} transparent animationType="none" onRequestClose={closeTransactionModal}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismissArea} onPress={closeTransactionModal} accessibilityLabel="关闭记账" />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [560, 0] }) }] }]}>
          <View style={styles.grab}/><Text style={styles.sheetTitle}>{impact ? '已保存这笔记录' : '记一笔'}</Text>
          {!impact ? <>
            <View style={styles.choices}>{(['expense', 'income', 'transfer'] as TransactionType[]).map((item) => <Chip key={item} selected={type === item} label={{ expense: '支出', income: '收入', transfer: '转账' }[item]} onPress={() => setType(item)} />)}</View>
            <TextInput autoFocus keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="金额" accessibilityLabel="金额" style={styles.amountInput}/>
            <Text style={styles.fieldLabel}>{type === 'transfer' ? '转出账户' : '记入账户'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{state.accounts.map((account) => <Chip key={account.id} label={`${account.name} · ¥${account.balance.toFixed(0)}`} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />)}</ScrollView>
            {type === 'transfer' && <><Text style={styles.fieldLabel}>转入账户</Text><View style={styles.choices}>{state.accounts.filter((account) => account.id !== accountId).map((account) => <Chip key={account.id} label={account.name} selected={toAccountId === account.id} onPress={() => setToAccountId(account.id)} />)}</View></>}
            {type !== 'transfer' && <><Text style={styles.fieldLabel}>分类</Text><View style={styles.choices}>{(type === 'expense' ? ['餐饮', '交通', '购物', '住房', '其他'] : ['工资', '奖金', '报销', '其他']).map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View></>}
            {type === 'expense' && <View style={styles.choices}><Chip label="必要支出" selected={budgetGroup === 'essential'} onPress={() => setBudgetGroup('essential')} /><Chip label="弹性消费" selected={budgetGroup === 'flexible'} onPress={() => setBudgetGroup('flexible')} /></View>}
            <TextInput value={note} onChangeText={setNote} placeholder="备注（选填）" style={styles.noteInput}/>
            {preview && <View style={styles.preview}>
              {state.settings.reminderMode !== 'light' && <InfoRow label="记后今日建议可花" value={`¥${preview.dailySpend.toFixed(2)}`} />}
              {state.settings.reminderMode !== 'light' && <InfoRow label="目标还差" value={`¥${preview.goalRemaining.toFixed(0)}`} />}
              {state.settings.reminderMode === 'strict' && <InfoRow label="目标每日需存" value={`¥${preview.goalDailySave.toFixed(2)}`} />}
              {state.settings.reminderMode === 'strict' && preview.shortfall > 0 && <InfoRow label="计划缺口 / 工作时间" value={`¥${preview.shortfall.toFixed(0)} · ${preview.extraWorkHours.toFixed(1)} 小时`} />}
            </View>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <QPressable disabled={!draft} reducedMotion={state.settings.reducedMotion} containerStyle={styles.primaryButtonWrap} style={[styles.primaryButton, !draft && styles.disabled]} onPress={() => { void confirm(); }}><Text style={styles.primaryText}>保存记录</Text></QPressable>
          </> : <>
            {state.settings.reminderMode === 'punish' && punishment && punishment.level !== 'none' && <Animated.View style={[styles.punishmentBlock, punishment.level === 'severe' ? styles.punishmentSevere : punishment.level === 'punish' ? styles.punishmentPunish : styles.punishmentWarn, { opacity: punishmentAnim, transform: [{ translateY: punishmentAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { translateX: punishmentShake }] }]}>
              <Text style={[styles.punishmentTitle, punishment.level === 'severe' ? styles.punishmentSevereText : punishment.level === 'punish' ? styles.punishmentPunishText : styles.punishmentWarnText]}>{punishment.title}</Text>
              <Text style={styles.punishmentDetail}>{punishment.detail}</Text>
            </Animated.View>}
            <Text style={styles.resultText}>{type === 'expense' ? `支出后今日建议可花 ¥${impact.dailySpend.toFixed(2)}` : type === 'income' ? '收入已记入所选账户' : '账户间转账已完成'}</Text>
            <View style={styles.preview}><InfoRow label="账户余额" value={`¥${impact.balance.toFixed(2)}`} />{type !== 'transfer' && <InfoRow label="距离目标" value={`还差 ¥${impact.goalRemaining.toFixed(0)}`} />}{state.settings.reminderMode !== 'light' && type !== 'transfer' && <InfoRow label="目标每日需存" value={`¥${impact.goalDailySave.toFixed(2)}`} />}</View>
            <Text style={[styles.noteText, (impact.shortfall > 0 || (state.settings.strictMode && impact.dailySpend === 0)) && styles.warningText]}>{impact.shortfall > 0 ? `本月计划缺口 ¥${impact.shortfall.toFixed(0)}，约合 ${impact.extraWorkHours.toFixed(1)} 小时工作收入。` : state.settings.strictMode && impact.dailySpend === 0 ? '今日建议预算已用尽，请先核对现金流。仍可继续记录真实消费。' : state.settings.reminderMode === 'light' ? '预算已更新；提醒仅供参考，不会阻止必要消费。' : '提醒仅用于辅助预算，不会阻止必要消费。'}</Text>
            <QPressable reducedMotion={state.settings.reducedMotion} containerStyle={styles.primaryButtonWrap} style={styles.primaryButton} onPress={closeTransactionModal}><Text style={styles.primaryText}>完成</Text></QPressable>
          </>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:colors.background},punishmentBlock:{marginTop:14,padding:14,borderRadius: radius.md,borderWidth:1},punishmentSevere:{backgroundColor:colors.dangerSoft,borderColor:colors.danger},punishmentPunish:{backgroundColor:colors.warningSoft,borderColor:colors.warning},punishmentWarn:{backgroundColor:colors.soft,borderColor:colors.line},punishmentTitle:{fontSize:16,fontWeight:'900'},punishmentSevereText:{color:colors.danger},punishmentPunishText:{color:colors.warning},punishmentWarnText:{color:colors.ink},punishmentDetail:{fontSize:12,fontVariant:['tabular-nums'],lineHeight:19,color:colors.ink,marginTop:6},content:{flex:1},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},loadingText:{marginTop:10,color:colors.muted,fontSize:12},modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},dismissArea:{flex:1},sheet:{maxHeight:'92%',backgroundColor:colors.surface,borderTopLeftRadius: radius.lg,borderTopRightRadius: radius.lg,padding:spacing.lg,paddingBottom:28},grab:{width:40,height:4,borderRadius: radius.sm,backgroundColor:colors.line,alignSelf:'center',marginBottom:14},sheetTitle:{fontSize:20,fontWeight:'900',color:colors.ink},choices:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},chip:{minHeight:40,justifyContent:'center',paddingHorizontal:10,borderWidth:1,borderColor:colors.line,borderRadius: radius.sm,backgroundColor:colors.surface},chipSelected:{backgroundColor:colors.accentSoft,borderColor:colors.accent},chipText:{fontSize:11,color:colors.muted,fontVariant:['tabular-nums']},chipTextSelected:{color:colors.ink,fontWeight:'800'},amountInput:{fontSize:32,fontWeight:'900',fontVariant:['tabular-nums'],color:colors.ink,borderBottomWidth:1,borderBottomColor:colors.line,paddingVertical:10,marginTop:12},fieldLabel:{fontSize:11,color:colors.muted,marginTop:12},noteInput:{height:40,borderBottomWidth:1,borderBottomColor:colors.line,color:colors.ink,marginTop:10},preview:{marginTop:12,borderTopWidth:1,borderTopColor:colors.line},infoRow:{minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.line},infoLabel:{fontSize:11,color:colors.muted},infoValue:{fontSize:12,fontWeight:'800',fontVariant:['tabular-nums'],color:colors.ink},primaryButtonWrap:{width:'100%'},primaryButton:{backgroundColor:colors.accent,borderRadius: radius.sm,minHeight:44,justifyContent:'center',alignItems:'center',marginTop:14},primaryText:{color:colors.surface,fontSize:13,fontWeight:'800'},disabled:{opacity:.45},resultText:{fontSize:14,fontWeight:'700',fontVariant:['tabular-nums'],color:colors.ink,marginTop:14},noteText:{fontSize:11,color:colors.muted,marginTop:10},warningText:{color:colors.danger,fontWeight:'800'},error:{fontSize:11,color:colors.danger,marginTop:8} });
