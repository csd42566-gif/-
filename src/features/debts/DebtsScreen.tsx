import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Debt, LedgerState } from '../../core/model/finance';
import { calculateMonthlyBudget, daysUntil } from '../../core/finance/calculations';
import { colors, spacing } from '../../ui/theme';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';

export function DebtsScreen({ state }: { state: LedgerState }) {
  const [selected, setSelected] = useState<Debt | null>(null);
  const now = new Date();
  const budget = calculateMonthlyBudget({
    transactions: state.transactions,
    debts: state.debts,
    goal: state.goal,
    monthlyIncome: state.settings.monthlyIncome,
    essentialMonthlyExpenses: state.settings.essentialMonthlyExpenses,
    workDaysPerMonth: state.settings.workDaysPerMonth,
    workHoursPerDay: state.settings.workHoursPerDay,
  }, now);
  const debts = [...state.debts].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return <>
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>本月预算与还款安排</Text>
      <Text style={styles.title}>现金流预测</Text>
      <View style={[styles.hero, budget.projectedNet < 0 && styles.heroRisk]}>
        <Text style={styles.label}>预计月末结余</Text>
        <Text style={[styles.total, budget.projectedNet < 0 && styles.danger]}>
          {budget.projectedNet < 0 ? '-' : ''}¥{Math.abs(budget.projectedNet).toFixed(0)}
        </Text>
        <View style={styles.breakdown}>
          <SummaryRow label="月收入计划" value={`¥${state.settings.monthlyIncome.toFixed(0)}`} />
          <SummaryRow label="本月已记消费" value={`- ¥${budget.monthToDateExpenses.toFixed(0)}`} />
          <SummaryRow label="必要支出预留" value={`- ¥${budget.essentialReserve.toFixed(0)}`} />
          <SummaryRow label="本月未到期还款" value={`- ¥${budget.upcomingRepayments.toFixed(0)}`} />
          <SummaryRow label="目标储蓄预留" value={`- ¥${(budget.goalDailySave * budget.remainingDays).toFixed(0)}`} />
        </View>
        <Text style={styles.note}>估算结果不等于账户实时余额，尚未纳入未记录的收入与支出。</Text>
      </View>

      <SectionTitle>还款时间线</SectionTitle>
      {debts.length === 0 ? <PressableCard>
        <Text style={styles.name}>暂无待还项目</Text>
        <Text style={styles.caption}>新增账单或欠款后，会按到期日显示在这里。</Text>
      </PressableCard> : debts.map((debt) => {
        const remaining = daysUntil(debt.dueDate, now);
        const overdue = debt.dueDate < formatDate(now);
        return <PressableCard
          key={debt.id}
          onPress={() => setSelected(debt)}
          style={styles.debt}
          accessibilityRole="button"
          accessibilityLabel={`查看${debt.name}，${debt.dueDate}到期，${debt.amount}元`}
        >
          <View style={styles.debtTop}>
            <View style={styles.debtIdentity}>
              <Text style={styles.name}>{debt.name}</Text>
              <Text style={[styles.status, overdue && styles.overdue]}>{overdue ? '已逾期' : remaining === 0 ? '今天到期' : `${remaining} 天后`}</Text>
            </View>
            <Text style={styles.amount}>¥{debt.amount.toFixed(0)}</Text>
          </View>
          <View style={styles.debtBottom}>
            <Text style={styles.caption}>{debt.dueDate} · {debt.kind === 'bill' ? '固定账单' : debt.kind === 'credit' ? '信用账户' : debt.kind === 'loan' ? '贷款' : '个人借款'}</Text>
            <Text style={styles.detailLink}>详情 ›</Text>
          </View>
        </PressableCard>;
      })}

      {budget.shortfall > 0 && <View style={styles.warning}>
        <Text style={styles.warningTitle}>本月计划有资金缺口</Text>
        <Text style={styles.warningText}>缺口 ¥{budget.shortfall.toFixed(0)}，按当前收入折算约 {budget.extraWorkHours.toFixed(1)} 小时工作收入。</Text>
        <Text style={styles.warningText}>也可降低本月储蓄额、减少非必要消费或调整目标日期。</Text>
      </View>}
    </ScrollView>

    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} accessibilityLabel="关闭详情" />
        {selected && <View style={styles.sheet}>
          <Text style={styles.sheetKicker}>待还项目</Text>
          <Text style={styles.sheetTitle}>{selected.name}</Text>
          <Text style={styles.sheetAmount}>¥{selected.amount.toFixed(2)}</Text>
          <SummaryRow label="到期日" value={selected.dueDate} />
          <SummaryRow label="剩余时间" value={selected.dueDate < formatDate(now) ? '已逾期' : `${daysUntil(selected.dueDate, now)} 天`} />
          {selected.minimumPayment != null && <SummaryRow label="最低还款参考" value={`¥${selected.minimumPayment.toFixed(2)}`} />}
          <Text style={styles.note}>此条目仅用于现金流提醒，不会代你发起扣款或还款。</Text>
          <Pressable style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeText}>完成</Text></Pressable>
        </View>}
      </View>
    </Modal>
  </>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 25, fontWeight: '800', color: colors.ink, marginTop: 4 },
  hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, marginTop: spacing.lg },
  heroRisk: { backgroundColor: colors.dangerSoft, borderColor: '#E6C4BF' },
  label: { fontSize: 12, color: colors.muted },
  total: { fontSize: 34, fontWeight: '900', color: colors.success, marginTop: 4 },
  danger: { color: colors.danger },
  breakdown: { borderTopWidth: 1, borderColor: colors.line, marginTop: 12, paddingTop: 5 },
  summaryRow: { minHeight: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryLabel: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  summaryValue: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  note: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 12 },
  debt: { marginBottom: 8 },
  debtTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  debtIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: '800', color: colors.ink },
  status: { fontSize: 10, color: colors.warning, fontWeight: '700' },
  overdue: { color: colors.danger },
  amount: { fontSize: 15, fontWeight: '800', color: colors.ink },
  debtBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  caption: { fontSize: 11, color: colors.muted },
  detailLink: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  warning: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#E6C4BF', borderRadius: 10, padding: 14, marginTop: 16 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: colors.danger },
  warningText: { fontSize: 12, color: colors.ink, lineHeight: 18, marginTop: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, paddingBottom: 30 },
  sheetKicker: { color: colors.muted, fontSize: 11 },
  sheetTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
  sheetAmount: { color: colors.ink, fontSize: 28, fontWeight: '900', marginVertical: 16 },
  closeButton: { backgroundColor: colors.accent, borderRadius: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  closeText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
});
