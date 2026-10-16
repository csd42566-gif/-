import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LedgerState } from '../../core/model/finance';
import { calculateGoalPlan, calculateMonthlyBudget } from '../../core/finance/calculations';
import { GoalDraft } from './goals';
import { colors, spacing } from '../../ui/theme';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';

export function GoalsScreen({ state, onSaveGoal }: { state: LedgerState; onSaveGoal: (draft: GoalDraft) => Promise<void> }) {
  const goal = state.goal;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const plan = goal ? calculateGoalPlan(goal) : null;
  const budget = calculateMonthlyBudget({
    transactions: state.transactions,
    debts: state.debts,
    goal,
    monthlyIncome: state.settings.monthlyIncome,
    essentialMonthlyExpenses: state.settings.essentialMonthlyExpenses,
    workDaysPerMonth: state.settings.workDaysPerMonth,
    workHoursPerDay: state.settings.workHoursPerDay,
  });
  const hourlyIncome = state.settings.monthlyIncome / (state.settings.workDaysPerMonth * state.settings.workHoursPerDay);

  useEffect(() => {
    if (!editing) return;
    setName(goal?.name ?? '');
    setAmount(goal ? String(goal.targetAmount) : '100000');
    setDeadline(goal?.deadline ?? '2027-10-16');
    setError('');
  }, [editing, goal]);

  const save = async () => {
    const targetAmount = Number(amount);
    if (!name.trim()) return setError('请输入目标名称');
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return setError('请输入大于 0 的目标金额');
    const date = new Date(`${deadline}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== deadline) {
      return setError('日期格式请使用 YYYY-MM-DD');
    }
    try {
      await onSaveGoal({ name, targetAmount, deadline });
      setEditing(false);
    } catch {
      setError('保存失败，请重试');
    }
  };

  const progress = plan?.progress ?? 0;
  return <>
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.heading}>
        <View><Text style={styles.kicker}>我的目标</Text><Text style={styles.title}>{goal?.name ?? '还没有目标'}</Text></View>
        <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Text style={styles.editText}>{goal ? '编辑' : '设置目标'}</Text></Pressable>
      </View>
      <View style={styles.hero}>
        <Text style={styles.label}>已存 / 目标</Text>
        <Text style={styles.total}>¥{goal?.savedAmount.toFixed(0) ?? '0'} / ¥{goal?.targetAmount.toFixed(0) ?? '0'}</Text>
        <View style={styles.bar}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <View style={styles.row}><Text style={styles.caption}>还差 ¥{plan?.remainingAmount.toFixed(0) ?? '0'}</Text><Text style={styles.caption}>{Math.round(progress)}%</Text></View>
        {goal && <Text style={styles.caption}>目标日期：{goal.deadline}</Text>}
      </View>
        <View style={styles.row}>
        <PressableCard style={styles.metric}><Text style={styles.label}>今天至少存</Text><Text style={styles.metricValue}>¥{plan?.dailySave.toFixed(2) ?? '0.00'}</Text><Text style={styles.caption}>剩余 {plan?.remainingDays ?? 0} 天</Text></PressableCard>
        <PressableCard style={styles.metric}><Text style={styles.label}>今日建议可花</Text><Text style={[styles.metricValue, { color: budget.dailySpend > 0 ? colors.success : colors.danger }]}>¥{budget.dailySpend.toFixed(2)}</Text><Text style={styles.caption}>按本月余额计划计算</Text></PressableCard>
      </View>
      <View style={styles.workNote}>
        <Text style={styles.workText}>按当前收入折算，每存 ¥{plan?.dailySave.toFixed(0) ?? '0'} 约需工作 {(hourlyIncome > 0 ? ((plan?.dailySave ?? 0) / hourlyIncome) : 0).toFixed(1)} 小时</Text>
        <Text style={styles.workCaption}>月收入 ¥{state.settings.monthlyIncome.toFixed(0)} · 每月工作 {state.settings.workDaysPerMonth} 天 · 每天 {state.settings.workHoursPerDay} 小时</Text>
      </View>
      <SectionTitle>可执行方案</SectionTitle>
      <PressableCard style={styles.option}><Text style={styles.optionTitle}>方案 A · 调整消费</Text><Text style={styles.caption}>{budget.shortfall > 0 ? `本月每天再减少约 ¥${(budget.shortfall / budget.remainingDays).toFixed(0)} 非必要支出。` : '目前无需额外压缩预算，继续按日存入目标金额。'}</Text></PressableCard>
      <PressableCard style={styles.option}><Text style={styles.optionTitle}>方案 B · 增加工时</Text><Text style={styles.caption}>{budget.shortfall > 0 ? `填补本月现金流缺口，约需增加 ${budget.extraWorkHours.toFixed(1)} 小时工作。` : `按当前工资水平，每日目标储蓄约相当于 ${(hourlyIncome > 0 ? ((plan?.dailySave ?? 0) / hourlyIncome) : 0).toFixed(1)} 小时收入。`}</Text></PressableCard>
      <PressableCard style={styles.option} onPress={() => setEditing(true)} accessibilityRole="button"><Text style={styles.optionTitle}>方案 C · 调整期限 ›</Text><Text style={styles.caption}>延长目标日期会降低每日储蓄要求；点击编辑日期查看新方案。</Text></PressableCard>
    </ScrollView>
    <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{goal ? '编辑存钱目标' : '设置存钱目标'}</Text>
        <Text style={styles.fieldLabel}>目标名称</Text><TextInput value={name} onChangeText={setName} placeholder="一年存下 10 万" maxLength={40} style={styles.input} />
        <Text style={styles.fieldLabel}>目标金额（元）</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="100000" style={styles.input} />
        <Text style={styles.fieldLabel}>截止日期（YYYY-MM-DD）</Text><TextInput value={deadline} onChangeText={setDeadline} placeholder="2027-10-16" style={styles.input} />
        {goal && <Text style={styles.hint}>已存 ¥{goal.savedAmount.toFixed(2)}，编辑不会改变已存金额</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}><Pressable onPress={() => setEditing(false)} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable onPress={save} style={styles.submit}><Text style={styles.submitText}>保存目标</Text></Pressable></View>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, scroll: { padding: spacing.lg, paddingBottom: 90 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 4 }, edit: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.accentSoft },
  editText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  hero: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 12, color: colors.muted }, total: { fontSize: 28, fontWeight: '900', color: colors.ink, marginTop: 5 },
  bar: { height: 8, backgroundColor: colors.line, borderRadius: 8, marginTop: 15, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.accent },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 }, caption: { fontSize: 11, color: colors.muted, lineHeight: 17, marginTop: 7 }, metric: { flex: 1 },
  workNote: { backgroundColor: colors.soft, borderRadius: 8, padding: 12, marginTop: 10 }, workText: { fontSize: 12, fontWeight: '700', color: colors.ink }, workCaption: { fontSize: 10, color: colors.muted, marginTop: 5 },
  metricValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 5 }, option: { marginBottom: 8 }, optionTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, marginBottom: 3 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.38)' }, sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20 },
  sheetTitle: { fontSize: 19, fontWeight: '900', color: colors.ink, marginBottom: 12 }, fieldLabel: { fontSize: 11, color: colors.muted, marginTop: 10, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: colors.ink },
  hint: { color: colors.muted, fontSize: 11, marginTop: 12 }, error: { color: colors.danger, fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }, cancel: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.soft },
  cancelText: { color: colors.ink, fontWeight: '700', fontSize: 12 }, submit: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8, backgroundColor: colors.accent },
  submitText: { color: colors.surface, fontWeight: '800', fontSize: 12 },
});
