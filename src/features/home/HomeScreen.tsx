import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LedgerState } from '../../core/model/finance';
import { calculateGoalPlan, calculateMonthlyBudget } from '../../core/finance/calculations';
import { colors, spacing } from '../../ui/theme';
import { MetricCard } from '../../ui/components/MetricCard';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';

interface HomeScreenProps {
  state: LedgerState;
  onAdd: () => void;
  onGoSettings: () => void;
  onGoGoals: () => void;
  onGoDebts: () => void;
}

export function HomeScreen({ state, onAdd, onGoSettings, onGoGoals, onGoDebts }: HomeScreenProps) {
  const now = new Date();
  const plan = calculateMonthlyBudget({
    transactions: state.transactions,
    debts: state.debts,
    goal: state.goal,
    monthlyIncome: state.settings.monthlyIncome,
    essentialMonthlyExpenses: state.settings.essentialMonthlyExpenses,
    workDaysPerMonth: state.settings.workDaysPerMonth,
    workHoursPerDay: state.settings.workHoursPerDay,
  }, now);
  const goal = state.goal ? calculateGoalPlan(state.goal, now) : null;
  const liquidBalance = state.accounts
    .filter((account) => account.kind !== 'credit')
    .reduce((sum, account) => sum + account.balance, 0);
  const risk = plan.shortfall > 0;
  const showRisk = state.settings.riskCardMode === 'always'
    || (state.settings.riskCardMode === 'risk-only' && risk);
  const today = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>{today}</Text>
      <Text style={styles.title}>今天的预算</Text>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>今日建议可花</Text>
          <Text style={styles.balance}>可用账户 ¥{liquidBalance.toFixed(0)}</Text>
        </View>
        <Text style={[styles.heroValue, plan.dailySpend === 0 && styles.warningValue]}>¥{plan.dailySpend.toFixed(2)}</Text>
        <Text style={styles.heroCaption}>
          根据月收入、必要支出、当月待还、目标储蓄和已记消费估算
        </Text>
        <View style={styles.heroActions}>
          <Pressable onPress={onAdd} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
            <Text style={styles.primaryActionText}>＋ 记一笔</Text>
          </Pressable>
          <Pressable onPress={onGoSettings} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>预算依据 ›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metrics}>
        <MetricCard label="本月已记支出" value={`¥${plan.monthToDateExpenses.toFixed(0)}`} caption="仅统计本月支出" />
        <MetricCard label="本月还需存" value={`¥${plan.goalDailySave.toFixed(0)} / 日`} caption={`剩余 ${goal?.remainingDays ?? 0} 天`} />
      </View>

      {state.goal ? <>
        <SectionTitle>存钱目标</SectionTitle>
        <PressableCard onPress={onGoGoals} accessibilityLabel="查看存钱目标">
          <View style={styles.line}>
            <Text style={styles.cardTitle}>{state.goal.name}</Text>
            <Text style={styles.bold}>{Math.round(goal?.progress ?? 0)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goal?.progress ?? 0}%` }]} />
          </View>
          <View style={styles.line}>
            <Text style={styles.muted}>还差 ¥{goal?.remainingAmount.toFixed(0)}</Text>
            <Text style={styles.muted}>截止 {state.goal.deadline}</Text>
          </View>
        </PressableCard>
      </> : <PressableCard onPress={onGoGoals} style={styles.emptyGoal}>
        <Text style={styles.cardTitle}>设置第一个存钱目标 ›</Text>
      </PressableCard>}

      {state.settings.repaymentReminders && <>
        <SectionTitle>近期还款</SectionTitle>
        <PressableCard onPress={onGoDebts}>
          <View style={styles.line}>
            <Text style={styles.cardTitle}>本月到期</Text>
            <Text style={styles.bold}>¥{plan.upcomingRepayments.toFixed(0)} ›</Text>
          </View>
          <Text style={styles.muted}>按到期日计入月度预算；查看全部还款计划</Text>
        </PressableCard>
      </>}

      {showRisk && <>
        <SectionTitle>现金流风险</SectionTitle>
        <PressableCard style={risk ? styles.riskCard : styles.okCard}>
          <Text style={[styles.riskTitle, !risk && styles.okTitle]}>
            {risk ? `预计本月缺口 ¥${plan.shortfall.toFixed(0)}` : '当前计划有结余'}
          </Text>
          <Text style={styles.riskText}>
            {risk
              ? `按当前工作收入估算，约需增加 ${plan.extraWorkHours.toFixed(1)} 小时工作，或调整消费与目标。`
              : '已将储蓄目标和到期还款纳入预算。'}
          </Text>
          <Pressable onPress={onGoSettings} accessibilityRole="button">
            <Text style={styles.link}>调整收入、必要支出或显示方式</Text>
          </Pressable>
        </PressableCard>
      </>}

      {!showRisk && risk && <Pressable onPress={onGoSettings} style={styles.urgentNotice} accessibilityRole="button">
        <Text style={styles.urgentText}>预算缺口 ¥{plan.shortfall.toFixed(0)} · 查看原因与方案 ›</Text>
      </Pressable>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 25, fontWeight: '800', color: colors.ink, marginTop: 4 },
  hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, marginTop: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  heroLabel: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  balance: { fontSize: 11, color: colors.muted },
  heroValue: { fontSize: 38, fontWeight: '900', color: colors.ink, marginTop: 7 },
  warningValue: { color: colors.danger },
  heroCaption: { fontSize: 11, color: colors.muted, lineHeight: 17, marginTop: 4 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  primaryAction: { backgroundColor: colors.accent, borderRadius: 8, minHeight: 42, paddingHorizontal: 16, justifyContent: 'center' },
  primaryActionText: { fontSize: 13, color: colors.surface, fontWeight: '800' },
  secondaryAction: { minHeight: 42, justifyContent: 'center' },
  secondaryActionText: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  bold: { fontSize: 13, fontWeight: '800', color: colors.ink },
  muted: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  progressTrack: { height: 7, backgroundColor: colors.line, borderRadius: 4, overflow: 'hidden', marginVertical: 7 },
  progressFill: { height: '100%', backgroundColor: colors.success },
  emptyGoal: { marginTop: spacing.sm },
  riskCard: { backgroundColor: colors.warningSoft, borderColor: '#E7D3B0' },
  okCard: { backgroundColor: colors.successSoft, borderColor: '#C8DDD3' },
  riskTitle: { fontSize: 15, fontWeight: '800', color: colors.warning },
  okTitle: { color: colors.success },
  riskText: { fontSize: 12, color: colors.ink, lineHeight: 18, marginTop: 6 },
  link: { fontSize: 11, color: colors.accent, marginTop: 12, fontWeight: '700' },
  urgentNotice: { marginTop: 12, padding: 12, backgroundColor: colors.dangerSoft, borderRadius: 8 },
  urgentText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
