import React, { useEffect, useState , useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LedgerState } from '../../core/model/finance';
import { deriveFinancials } from '../../core/finance/derive';
import { calculateEarnings } from '../../core/work/attendance';
import { GoalDraft, isValidGoalDate } from './goals';
import { spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { ThemedModal } from '../../ui/components/ThemedModal';
import { PressableCard } from '../../ui/components/PressableCard';
import { AccountSavingsList } from './AccountSavingsList';

export function GoalsScreen({ state, onSaveGoal, onUpdateAccountDisplayOrder }: {
  state: LedgerState;
  onSaveGoal: (draft: GoalDraft) => Promise<void>;
  onUpdateAccountDisplayOrder: (order: string[]) => Promise<void>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const goal = state.goal;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const now = new Date();
  const financials = deriveFinancials(state, now);
  const earnings = calculateEarnings(state.settings.work, state.attendance ?? [], now);

  useEffect(() => {
    if (!editing) return;
    setName(goal?.name ?? '');
    setAmount(goal ? String(goal.targetAmount) : '');
    setDeadline(goal?.deadline ?? '');
    setError('');
  }, [editing, goal]);

  const save = async () => {
    const targetAmount = Number(amount);
    if (!name.trim()) return setError('请输入目标名称');
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return setError('请输入大于 0 的目标金额');
    if (!isValidGoalDate(deadline)) {
      return setError('日期格式请使用 YYYY-MM-DD');
    }
    try {
      await onSaveGoal({ name, targetAmount, deadline });
      setEditing(false);
    } catch {
      setError('保存失败，请重试');
    }
  };

  const progress = financials.goalProgress;
  return <>
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.heading}>
        <View><Text style={styles.kicker}>我的目标</Text><Text style={styles.title}>{goal?.name ?? '还没有目标'}</Text></View>
        <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={goal ? '编辑目标' : '设置目标'} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><Ionicons name="add-circle-outline" size={25} color={colors.accent} /></Pressable>
      </View>
      <View style={styles.hero}>
        <Text style={styles.label}>已存 / 目标</Text>
        <Text style={styles.total}>¥{financials.goalSaved.toFixed(0)} / ¥{goal?.targetAmount.toFixed(0) ?? '0'}</Text>
        <View style={styles.bar}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <View style={styles.row}><Text style={styles.caption}>还差 ¥{financials.goalRemaining.toFixed(0)}</Text><Text style={styles.caption}>{Math.round(progress)}%</Text></View>{goal && financials.goalShortfallFromStart > 0 && <Text style={[styles.caption, styles.shortfall]}>距起点多花 ¥{financials.goalShortfallFromStart.toFixed(0)}</Text>}
        {goal && <Text style={styles.caption}>目标日期：{goal.deadline}</Text>}
      </View>
        <View style={styles.row}>
        <PressableCard style={styles.metric}><Text style={styles.label}>今天至少存</Text><Text style={styles.metricValue}>¥{financials.goalDailySave.toFixed(2)}</Text><Text style={styles.caption}>剩余 {financials.goalRemainingDays} 天</Text></PressableCard>
        <PressableCard style={styles.metric}><Text style={styles.label}>今日建议可花</Text><Text style={[styles.metricValue, { color: financials.todaySpendable > 0 ? colors.success : colors.danger }]}>¥{financials.todaySpendable.toFixed(2)}</Text><Text style={styles.caption}>按本月余额计划计算</Text></PressableCard>
      </View>
      <View style={styles.workNote}>
        <Text style={styles.workText}>按当前收入折算，每存 ¥{financials.goalDailySave.toFixed(0)} 约需工作 {(financials.hourlyIncome > 0 ? (financials.goalDailySave / financials.hourlyIncome) : 0).toFixed(1)} 小时</Text>
        <Text style={styles.workCaption}>月收入 ¥{earnings.monthlySalary.toFixed(0)} · 每月工作 {earnings.expectedWorkDays} 天 · 每天 {state.settings.work.workHoursPerDay} 小时</Text>
      </View>
      <AccountSavingsList
        accounts={state.accounts}
        savedOrder={state.settings.accountDisplayOrder}
        motionLevel={state.settings.motionLevel}
        onOrderChange={onUpdateAccountDisplayOrder}
      />
    </ScrollView>
    <ThemedModal visible={editing} transparent animationType={state.settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setEditing(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{goal ? '编辑存钱目标' : '设置存钱目标'}</Text>
        <Text style={styles.fieldLabel}>目标名称</Text><TextInput value={name} onChangeText={setName} placeholder="请输入目标名称" placeholderTextColor={colors.muted} maxLength={40} style={styles.input} />
        <Text style={styles.fieldLabel}>目标金额（元）</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="请输入目标金额" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.fieldLabel}>截止日期（YYYY-MM-DD）</Text><TextInput value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} />
        {goal && <Text style={styles.hint}>当前净存 ¥{financials.goalSaved.toFixed(2)}，编辑不会重置目标起点</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}><Pressable onPress={() => setEditing(false)} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable onPress={save} style={styles.submit}><Text style={styles.submitText}>保存目标</Text></Pressable></View>
      </View></View>
    </ThemedModal>
  </>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, scroll: { padding: spacing.lg, paddingBottom: 90 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 4 }, edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  hero: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: 12, color: colors.muted }, total: { fontSize: 28, fontWeight: '900', color: colors.ink, marginTop: 5, fontVariant: ['tabular-nums'] },
  bar: { height: 8, backgroundColor: colors.line, borderRadius: radius.sm, marginTop: 15, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: colors.accent },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 }, caption: { fontSize: 11, color: colors.muted, lineHeight: 17, marginTop: 7, fontVariant: ['tabular-nums'] }, shortfall: { color: colors.danger, fontWeight: '700' }, metric: { flex: 1 },
  workNote: { backgroundColor: colors.soft, borderRadius: radius.sm, padding: 12, marginTop: 10 }, workText: { fontSize: 12, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }, workCaption: { fontSize: 10, color: colors.muted, marginTop: 5, fontVariant: ['tabular-nums'] },
  metricValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 5, fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.overlay }, sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 },
  sheetTitle: { fontSize: 19, fontWeight: '900', color: colors.ink, marginBottom: 12 }, fieldLabel: { fontSize: 11, color: colors.muted, marginTop: 10, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, fontSize: 14, color: colors.ink },
  hint: { color: colors.muted, fontSize: 11, marginTop: 12 }, error: { color: colors.danger, fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }, cancel: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.soft },
  cancelText: { color: colors.ink, fontWeight: '700', fontSize: 12 }, submit: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.accent },
  submitText: { color: colors.surface, fontWeight: '800', fontSize: 12 },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors.accent, colors.background, colors.danger, colors.ink, colors.line, colors.muted, colors.overlay, colors.soft, colors.success, colors.surface]);
}
