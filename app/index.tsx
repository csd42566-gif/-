import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HomeScreen } from '../src/features/home/HomeScreen';
import { LedgerScreen } from '../src/features/ledger/LedgerScreen';
import { DebtsScreen } from '../src/features/debts/DebtsScreen';
import { GoalsScreen } from '../src/features/goals/GoalsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { BottomNav, Tab } from '../src/ui/components/BottomNav';
import { colors, spacing } from '../src/ui/theme';
import { BudgetGroup, LedgerState, PendingTransaction, RiskCardMode, Settings, TransactionType } from '../src/core/model/finance';
import { calculateMonthlyBudget } from '../src/core/finance/calculations';
import { loadState, saveState } from '../src/data/storage';
import { recordTransaction, reviewDetectedTransaction } from '../src/features/ledger/ledger';
import { GoalDraft, updateGoal } from '../src/features/goals/goals';
import { logger } from '../src/core/logging/logger';

type Draft = { type: TransactionType; amount: number; accountId: string; toAccountId?: string; category?: string; budgetGroup?: BudgetGroup; note?: string };

export default function Index() {
  const [state, setState] = useState<LedgerState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('餐饮');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [budgetGroup, setBudgetGroup] = useState<BudgetGroup>('flexible');
  const [impact, setImpact] = useState<{ balance: number; dailySpend: number; goalDailySave: number; goalRemaining: number; shortfall: number; extraWorkHours: number } | null>(null);
  const [error, setError] = useState('');
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadState().then((loaded) => { setState(loaded); setAccountId(loaded.accounts[0]?.id ?? ''); setToAccountId(loaded.accounts[1]?.id ?? loaded.accounts[0]?.id ?? ''); }).catch(() => setError('本地账本读取失败，请重启应用重试。')); }, []);
  useEffect(() => {
    if (!modal) { anim.setValue(0); return; }
    if (state?.settings.reducedMotion) { anim.setValue(1); return; }
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
  }, [modal, state?.settings.reducedMotion, anim]);

  if (!state) return <View style={styles.loading}><ActivityIndicator color={colors.accent}/><Text style={styles.loadingText}>{error || '正在加载本地账本…'}</Text></View>;
  const persist = async (next: LedgerState) => { setState(next); try { await saveState(next); } catch { setError('保存失败，当前更改尚未写入本地存储。'); } };
  const openAdd = () => { setAmount(''); setCategory('餐饮'); setNote(''); setType('expense'); setBudgetGroup('flexible'); setImpact(null); setError(''); setModal(true); };
  const draft: Draft | null = Number.isFinite(Number(amount)) && Number(amount) > 0 && accountId ? {
    type, amount: Number(amount), accountId, ...(type === 'transfer' ? { toAccountId } : {}),
    ...(type !== 'transfer' ? { category, ...(type === 'expense' ? { budgetGroup } : {}) } : {}), note: note.trim() || undefined,
  } : null;
  const projected = (candidate: Draft) => {
    const next = recordTransaction(state, candidate);
    const budget = calculateMonthlyBudget({ transactions: next.transactions, debts: next.debts, goal: next.goal, monthlyIncome: next.settings.monthlyIncome, essentialMonthlyExpenses: next.settings.essentialMonthlyExpenses, workDaysPerMonth: next.settings.workDaysPerMonth, workHoursPerDay: next.settings.workHoursPerDay });
    return { balance: next.accounts.find((account) => account.id === candidate.accountId)?.balance ?? 0, dailySpend: budget.dailySpend, goalDailySave: budget.goalDailySave, goalRemaining: Math.max(0, (next.goal?.targetAmount ?? 0) - (next.goal?.savedAmount ?? 0)), shortfall: budget.shortfall, extraWorkHours: budget.extraWorkHours };
  };
  const preview = draft && !impact ? (() => { try { return projected(draft); } catch { return null; } })() : null;
  const confirm = async () => {
    if (!draft) { setError('请检查金额和账户。'); return; }
    try {
      const result = projected(draft);
      const next = recordTransaction(state, draft);
      await saveState(next);
      setState(next);
      setImpact(result);
      setError('');
      logger.log('info', 'TRANSACTION_CONFIRMED', '');
    } catch { setError(type === 'transfer' ? '转账账户无效，请选择两个不同账户。' : '记账失败，请检查金额和账户后重试。'); }
  };
  const reviewPending = async (id: string, action: 'accept' | 'dismiss', edits?: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category'>>) => {
    try { await persist(reviewDetectedTransaction(state, id, action, edits)); logger.log('info', action === 'accept' ? 'DETECTED_TRANSACTION_ACCEPTED' : 'DETECTED_TRANSACTION_DISMISSED', ''); }
    catch { setError('更新识别记录失败，请重试。'); }
  };
  const updateSettings = async (patch: Partial<Settings>) => { await persist({ ...state, settings: { ...state.settings, ...patch } }); };
  const changeRiskMode = (mode: RiskCardMode) => updateSettings({ riskCardMode: mode });
  const saveGoal = async (goalDraft: GoalDraft) => { const next = updateGoal(state, goalDraft); await persist(next); logger.log('info', 'GOAL_UPDATED', ''); };
  const screen = tab === 'home'
    ? <HomeScreen state={state} onAdd={openAdd} onGoSettings={() => setTab('me')} onGoGoals={() => setTab('goals')} onGoDebts={() => setTab('debts')} />
    : tab === 'ledger' ? <LedgerScreen state={state} onAdd={openAdd} onReviewPending={reviewPending} />
      : tab === 'debts' ? <DebtsScreen state={state} />
        : tab === 'goals' ? <GoalsScreen state={state} onSaveGoal={saveGoal} />
          : <SettingsScreen state={state} onChangeRiskMode={changeRiskMode} onUpdateSettings={updateSettings} />;

  return <View style={styles.root}>
    <View style={styles.content}>{screen}</View>
    <BottomNav active={tab} onChange={setTab} />
    <Modal visible={modal} transparent animationType="none" onRequestClose={() => setModal(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismissArea} onPress={() => setModal(false)} accessibilityLabel="关闭记账" />
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
            <Pressable disabled={!draft} style={[styles.primaryButton, !draft && styles.disabled]} onPress={confirm}><Text style={styles.primaryText}>保存记录</Text></Pressable>
          </> : <>
            <Text style={styles.resultText}>{type === 'expense' ? `支出后今日建议可花 ¥${impact.dailySpend.toFixed(2)}` : type === 'income' ? '收入已记入所选账户' : '账户间转账已完成'}</Text>
            <View style={styles.preview}><InfoRow label="账户余额" value={`¥${impact.balance.toFixed(2)}`} />{type !== 'transfer' && <InfoRow label="距离目标" value={`还差 ¥${impact.goalRemaining.toFixed(0)}`} />}{state.settings.reminderMode !== 'light' && type !== 'transfer' && <InfoRow label="目标每日需存" value={`¥${impact.goalDailySave.toFixed(2)}`} />}</View>
            <Text style={[styles.noteText, (impact.shortfall > 0 || (state.settings.strictMode && impact.dailySpend === 0)) && styles.warningText]}>{impact.shortfall > 0 ? `本月计划缺口 ¥${impact.shortfall.toFixed(0)}，约合 ${impact.extraWorkHours.toFixed(1)} 小时工作收入。` : state.settings.strictMode && impact.dailySpend === 0 ? '今日建议预算已用尽，请先核对现金流。仍可继续记录真实消费。' : state.settings.reminderMode === 'light' ? '预算已更新；提醒仅供参考，不会阻止必要消费。' : '提醒仅用于辅助预算，不会阻止必要消费。'}</Text>
            <Pressable style={styles.primaryButton} onPress={() => setModal(false)}><Text style={styles.primaryText}>完成</Text></Pressable>
          </>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:colors.background},content:{flex:1},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},loadingText:{marginTop:10,color:colors.muted,fontSize:12},modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.38)'},dismissArea:{flex:1},sheet:{maxHeight:'92%',backgroundColor:colors.surface,borderTopLeftRadius:16,borderTopRightRadius:16,padding:spacing.lg,paddingBottom:28},grab:{width:40,height:4,borderRadius:4,backgroundColor:colors.line,alignSelf:'center',marginBottom:14},sheetTitle:{fontSize:20,fontWeight:'900',color:colors.ink},choices:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},chip:{minHeight:34,justifyContent:'center',paddingHorizontal:10,borderWidth:1,borderColor:colors.line,borderRadius:8,backgroundColor:colors.surface},chipSelected:{backgroundColor:colors.accentSoft,borderColor:colors.accent},chipText:{fontSize:11,color:colors.muted},chipTextSelected:{color:colors.ink,fontWeight:'800'},amountInput:{fontSize:32,fontWeight:'900',color:colors.ink,borderBottomWidth:1,borderBottomColor:colors.line,paddingVertical:10,marginTop:12},fieldLabel:{fontSize:11,color:colors.muted,marginTop:12},noteInput:{height:40,borderBottomWidth:1,borderBottomColor:colors.line,color:colors.ink,marginTop:10},preview:{marginTop:12,borderTopWidth:1,borderTopColor:colors.line},infoRow:{minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.line},infoLabel:{fontSize:11,color:colors.muted},infoValue:{fontSize:12,fontWeight:'800',color:colors.ink},primaryButton:{backgroundColor:colors.accent,borderRadius:8,minHeight:44,justifyContent:'center',alignItems:'center',marginTop:14},primaryText:{color:colors.surface,fontSize:13,fontWeight:'800'},disabled:{opacity:.45},resultText:{fontSize:14,fontWeight:'700',color:colors.ink,marginTop:14},noteText:{fontSize:11,color:colors.muted,marginTop:10},warningText:{color:colors.danger,fontWeight:'800'},error:{fontSize:11,color:colors.danger,marginTop:8} });
