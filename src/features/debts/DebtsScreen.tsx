import React, { useState , useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Debt, LedgerState, RepaymentMode } from '../../core/model/finance';
import { daysUntil } from '../../core/finance/calculations';
import { deriveFinancials } from '../../core/finance/derive';
import { calculateEarnings } from '../../core/work/attendance';
import { spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { ThemedModal } from '../../ui/components/ThemedModal';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';
import { RepaymentProvider } from '../repayment-import/parsers';
import { InstallmentDraft } from '../repayment-import/installments';
import { RepaymentImportOutcome, RepaymentImportSheet } from '../repayment-import/RepaymentImportSheet';

export function DebtsScreen({ state, onImportRepayment, onImportInstallment, onUpdateRepaymentMode }: { state: LedgerState; onImportRepayment: (provider: RepaymentProvider, text: string) => Promise<RepaymentImportOutcome>; onImportInstallment: (provider: RepaymentProvider, draft: InstallmentDraft) => Promise<RepaymentImportOutcome>; onUpdateRepaymentMode: (debtId: string, mode: RepaymentMode) => Promise<void> }) {
  const styles = useStyles();
  const [selected, setSelected] = useState<Debt | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const now = new Date();
  const financials = deriveFinancials(state, now);
  const earnings = calculateEarnings(state.settings.work, state.attendance ?? [], now);
  const debts = [...state.debts].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const changeRepaymentMode = async (mode: RepaymentMode) => {
    if (!selected || selected.repaymentMode === mode) return;
    const previous = selected;
    setSelected({ ...selected, repaymentMode: mode });
    try {
      await onUpdateRepaymentMode(selected.id, mode);
    } catch {
      setSelected(previous);
    }
  };

  return <>
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>本月预算与还款安排</Text>
      <Text style={styles.title}>现金流预测</Text>
      <View style={[styles.hero, financials.projectedNet < 0 && styles.heroRisk]}>
        <Text style={styles.label}>预计月末结余</Text>
        <Text style={[styles.total, financials.projectedNet < 0 && styles.danger]}>
          {financials.projectedNet < 0 ? '-' : ''}¥{Math.abs(financials.projectedNet).toFixed(0)}
        </Text>
        <View style={styles.breakdown}>
          <SummaryRow label="月收入计划" value={`¥${earnings.monthlySalary.toFixed(0)}`} />
          <SummaryRow label="本月已记消费" value={`- ¥${financials.monthSpent.toFixed(0)}`} />
          <SummaryRow label="必要支出预留" value={`- ¥${financials.essentialReserve.toFixed(0)}`} />
          <SummaryRow label="本月应还 / 逾期" value={`- ¥${financials.monthDue.toFixed(0)}`} />
          <SummaryRow label="目标储蓄预留" value={`- ¥${financials.goalReserve.toFixed(0)}`} />
        </View>
        <Text style={styles.note}>估算结果不等于账户实时余额，尚未纳入未记录的收入与支出。</Text>
      </View>

      <View style={styles.sectionHeader}>
        <SectionTitle>还款时间线</SectionTitle>
        <Pressable onPress={() => setImportVisible(true)} accessibilityRole="button" style={({ pressed }) => [styles.importButton, pressed && styles.pressed]}><Text style={styles.importText}>导入代还</Text></Pressable>
      </View>
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
            <Text style={styles.caption}>{debt.installment ? `第 ${debt.installment.paidPeriods + 1}/${debt.installment.totalPeriods} 期 · 剩余本金 ¥${debt.amount.toFixed(2)} · 下期 ${debt.dueDate}` : `${debt.dueDate} · ${debt.kind === 'bill' ? '固定账单' : debt.kind === 'credit' ? '信用账户' : debt.kind === 'loan' ? '贷款' : '个人借款'}`}</Text>
            <Text style={styles.detailLink}>详情 ›</Text>
          </View>
        </PressableCard>;
      })}

      {financials.shortfall > 0 && <View style={styles.warning}>
        <Text style={styles.warningTitle}>本月计划有资金缺口</Text>
        <Text style={styles.warningText}>缺口 ¥{financials.shortfall.toFixed(0)}，按当前收入折算约 {financials.extraWorkHours.toFixed(1)} 小时工作收入。</Text>
        <Text style={styles.warningText}>也可降低本月储蓄额、减少非必要消费或调整目标日期。</Text>
      </View>}
    </ScrollView>

    <RepaymentImportSheet visible={importVisible} onClose={() => setImportVisible(false)} onImport={onImportRepayment} onImportInstallment={onImportInstallment} />

    <ThemedModal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} accessibilityLabel="关闭详情" />
        {selected && <View style={styles.sheet}>
          <Text style={styles.sheetKicker}>待还项目</Text>
          <Text style={styles.sheetTitle}>{selected.name}</Text>
          <Text style={styles.sheetAmount}>¥{selected.amount.toFixed(2)}</Text>
          <SummaryRow label="到期日" value={selected.dueDate} />
          <View style={styles.modeRow}>
            <Text style={styles.summaryLabel}>还款方式</Text>
            <View style={styles.modeChoices}>
              <Pressable onPress={() => changeRepaymentMode('minimum')} style={[styles.modeChip, selected.repaymentMode !== 'full' && styles.modeChipSelected]}><Text style={[styles.modeText, selected.repaymentMode !== 'full' && styles.modeTextSelected]}>按最低还款</Text></Pressable>
              <Pressable onPress={() => changeRepaymentMode('full')} style={[styles.modeChip, selected.repaymentMode === 'full' && styles.modeChipSelected]}><Text style={[styles.modeText, selected.repaymentMode === 'full' && styles.modeTextSelected]}>全额还款</Text></Pressable>
            </View>
          </View>
          <SummaryRow label="剩余时间" value={selected.dueDate < formatDate(now) ? '已逾期' : `${daysUntil(selected.dueDate, now)} 天`} />
          {selected.minimumPayment != null && <SummaryRow label="最低还款参考" value={`¥${selected.minimumPayment.toFixed(2)}`} />}
          {selected.installment && <>
            <SummaryRow label="分期进度" value={`第 ${selected.installment.paidPeriods + 1}/${selected.installment.totalPeriods} 期`} />
            <SummaryRow label="剩余本金" value={`¥${selected.amount.toFixed(2)}`} />
            {selected.installment.periods[0] && <SummaryRow label="本期本金 / 利息" value={`¥${selected.installment.periods[0].principalAmount.toFixed(2)} / ¥${selected.installment.periods[0].interestAmount.toFixed(2)}`} />}
            <SummaryRow label="剩余总利息" value={`¥${selected.installment.periods.reduce((sum, period) => sum + period.interestAmount, 0).toFixed(2)}`} />
          </>}
          <Text style={styles.note}>此条目仅用于现金流提醒，不会代你发起扣款或还款。</Text>
          <Pressable style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeText}>完成</Text></Pressable>
        </View>}
      </View>
    </ThemedModal>
  </>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 32 },
  kicker: { fontSize: 12, color: colors.muted },
  title: { fontSize: 25, fontWeight: '800', color: colors.ink, marginTop: 4 },
  hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  heroRisk: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  label: { fontSize: 12, color: colors.muted },
  total: { fontSize: 34, fontWeight: '900', color: colors.success, marginTop: 4, fontVariant: ['tabular-nums'] },
  danger: { color: colors.danger },
  breakdown: { borderTopWidth: 1, borderColor: colors.line, marginTop: 12, paddingTop: 5 },
  summaryRow: { minHeight: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryLabel: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  modeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  modeChoices: { flexDirection: 'row', gap: 6 },
  modeChip: { minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 7 },
  modeChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeText: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  modeTextSelected: { color: colors.ink },
  summaryValue: { fontSize: 12, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 12 },
  debt: { marginBottom: 8 },
  debtTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  debtIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: '800', color: colors.ink },
  status: { fontSize: 10, color: colors.warning, fontWeight: '700', fontVariant: ['tabular-nums'] },
  overdue: { color: colors.danger },
  amount: { fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  debtBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  caption: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
  detailLink: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  warning: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: 14, marginTop: 16 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: colors.danger },
  warningText: { fontSize: 12, color: colors.ink, lineHeight: 18, marginTop: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 22, paddingBottom: 30 },
  sheetKicker: { color: colors.muted, fontSize: 11 },
  sheetTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
  sheetAmount: { color: colors.ink, fontSize: 28, fontWeight: '900', marginVertical: 16, fontVariant: ['tabular-nums'] },
  closeButton: { backgroundColor: colors.accent, borderRadius: radius.sm, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  closeText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  importButton: { marginTop: spacing.lg, marginBottom: spacing.sm, minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  importText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors.accent, colors.accentSoft, colors.background, colors.danger, colors.dangerSoft, colors.ink, colors.line, colors.muted, colors.overlay, colors.success, colors.surface, colors.warning]);
}
