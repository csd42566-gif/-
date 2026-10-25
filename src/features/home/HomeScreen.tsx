import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LedgerState, MotionLevel } from '../../core/model/finance';
import { deriveFinancials } from '../../core/finance/derive';
import { analyze } from '../../core/finance/analysis';
import { calculateEarnings } from '../../core/work/attendance';
import { ATTENDANCE_CLOCK_IN_REQUIRED, findPendingAttendanceRecord, localDateKey } from '../attendance/attendance';
import { motion, spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { QPressable } from '../../ui/components/QPressable';
import { useThemedStyles } from '../../ui/hooks/useThemedStyles';

interface HomeScreenProps {
  state: LedgerState;
  amountAnimationKey: number;
  onAdd: () => void;
  onGoSettings: () => void;
  onGoGoals: () => void;
  onGoDebts: () => void;
  onClockIn: () => Promise<void>;
  onClockOut: () => Promise<void>;
  onMarkRest: () => Promise<void>;
  onUndoRest: () => Promise<void>;
}

export function HomeScreen({ state, amountAnimationKey, onAdd, onGoSettings, onGoGoals, onGoDebts, onClockIn, onClockOut, onMarkRest, onUndoRest }: HomeScreenProps) {
  const styles = useThemedStyles(createStyles);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceFeedback, setAttendanceFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);
  const financials = deriveFinancials(state, now);
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const lastAmountAnimationKey = useRef(amountAnimationKey);
  useEffect(() => {
    if (lastAmountAnimationKey.current === amountAnimationKey) return;
    lastAmountAnimationKey.current = amountAnimationKey;
    heroOpacity.stopAnimation();
    if (state.settings.motionLevel === 'standard') {
      heroOpacity.setValue(1);
      return;
    }
    heroOpacity.setValue(0);
    const animation = Animated.timing(heroOpacity, { toValue: 1, duration: motion.levels[state.settings.motionLevel].duration, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [amountAnimationKey, state.settings.motionLevel, heroOpacity]);
  useEffect(() => () => heroOpacity.stopAnimation(), [heroOpacity]);
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  const attendance = state.attendance ?? [];
  const earnings = calculateEarnings(state.settings.work, attendance, now);
  const insights = analyze(state, earnings, financials);
  const todayKey = localDateKey(now);
  const todayRecord = attendance.find((record) => record.date === todayKey);
  const pendingRecord = findPendingAttendanceRecord(attendance, now);
  const activePending = todayRecord?.clockIn && !todayRecord.clockOut
    ? todayRecord
    : !todayRecord
      ? pendingRecord
      : undefined;
  const todayEarned = todayRecord?.status === 'worked' && todayRecord.clockOut ? earnings.dailySalary : 0;
  const completed = todayRecord?.status === 'worked' && !!todayRecord.clockOut;
  const resting = todayRecord?.status === 'rest';
  const currentShiftHours = activePending?.clockIn ? hoursBetween(activePending.clockIn, now) : 0;
  const completedHours = todayRecord?.clockIn && todayRecord.clockOut ? hoursBetween(todayRecord.clockIn, todayRecord.clockOut) : 0;
  const risk = financials.shortfall > 0;
  const today = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);
  const attendanceStatus = pendingRecord
    ? pendingRecord.date.slice(5) + ' 的班还没确认下班 · 点击确认'
    : todayRecord?.status === 'rest'
      ? '今天休息'
      : todayRecord?.status === 'worked' && todayRecord.clockOut
        ? '已下班 · 今天赚了 ¥' + earnings.dailySalary.toFixed(2)
        : todayRecord?.clockIn
          ? formatClockTime(todayRecord.clockIn) + ' 已打卡'
          : '未打卡';
  const showFeedback = (label: string, at: Date) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setAttendanceFeedback('✓ ' + label + ' ' + formatClockTime(at.toISOString()));
    feedbackTimer.current = setTimeout(() => {
      setAttendanceFeedback('');
      feedbackTimer.current = null;
    }, 1500);
  };
  const runAttendanceAction = async (action: () => Promise<void>, label: string) => {
    const actionTime = new Date();
    setAttendanceBusy(true);
    setAttendanceError('');
    try {
      await action();
      showFeedback(label, actionTime);
    } catch (error) {
      setAttendanceError(error instanceof Error && error.message === ATTENDANCE_CLOCK_IN_REQUIRED
        ? '请先打上班卡，再确认下班。'
        : '考勤保存失败，请重试。');
    } finally {
      setAttendanceBusy(false);
    }
  };
  const confirmClockOut = () => {
    if (!activePending) return;
    if (currentShiftHours < 2) {
      Alert.alert('确认下班', '才上了 ' + currentShiftHours.toFixed(1) + ' 小时，确认下班？', [
        { text: '继续上班', style: 'cancel' },
        { text: '确认下班', onPress: () => { void runAttendanceAction(onClockOut, '下班已记录'); } },
      ]);
      return;
    }
    void runAttendanceAction(onClockOut, '下班已记录');
  };

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable
        disabled={!pendingRecord || attendanceBusy}
        onPress={confirmClockOut}
        accessibilityRole={pendingRecord ? 'button' : undefined}
        style={({ pressed }) => [styles.topMeta, pendingRecord && styles.pendingTopMeta, pressed && styles.pressed]}
      >
        <Text style={styles.kicker}>{today}</Text>
        <Text style={[styles.topStatus, pendingRecord && styles.pendingStatus]} numberOfLines={2}>{attendanceStatus}</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>今日可花</Text>
        <Animated.Text style={[styles.heroValue, financials.todaySpendable === 0 && styles.warningValue, { opacity: heroOpacity }]}>¥{financials.todaySpendable.toFixed(2)}</Animated.Text>
        <Text style={styles.balance}>可用账户 ¥{financials.availableBalance.toFixed(2)}</Text>
        <QPressable onPress={onAdd} motionLevel={state.settings.motionLevel} containerStyle={styles.primaryActionWrap} style={styles.primaryAction} accessibilityRole="button">
          <Text style={styles.primaryActionText}>＋ 记一笔</Text>
        </QPressable>
      </View>

      <View style={styles.insightsSection}>
        {insights.map((insight, index) => <View key={insight.headline + index} style={[styles.insightCard, insight.level === 'danger' ? styles.insightDanger : insight.level === 'warn' ? styles.insightWarn : styles.insightInfo]}>
          <Text style={[styles.insightHeadline, insight.level === 'danger' ? styles.insightDangerText : insight.level === 'warn' ? styles.insightWarnText : styles.insightInfoText]}>{insight.headline}</Text>
          <Text style={styles.insightDetail}>{insight.detail}</Text>
          {!!insight.action && <Text style={styles.insightAction}>{insight.action}</Text>}
        </View>)}
      </View>

      <View style={styles.attendanceSection}>
        <Text style={styles.attendanceStatusText}>
          {attendanceFeedback ? '打卡已记录' : resting ? '今天休息' : completed ? '今天已完成' : activePending ? (activePending.date === todayKey ? formatClockTime(activePending.clockIn) + ' 已打卡' : '昨日 ' + formatClockTime(activePending.clockIn) + ' 已打卡') : '今天还没打卡'}
        </Text>
        <AttendanceButton
          variant="primary"
          label={attendanceFeedback || (resting ? '撤销休息' : completed ? '今天已完成 · ' + completedHours.toFixed(1) + ' 小时' : activePending ? '下班确认' : '上班打卡')}
          subLabel={!attendanceFeedback && activePending ? '已上 ' + currentShiftHours.toFixed(1) + ' 小时' : undefined}
          tone={attendanceFeedback ? 'success' : resting ? 'rest' : completed ? 'muted' : activePending ? 'warning' : 'accent'}
          dashed={resting}
          disabled={attendanceBusy || completed || !!attendanceFeedback}
          motionLevel={state.settings.motionLevel}
          onPress={resting ? () => { void runAttendanceAction(onUndoRest, '休息已撤销'); } : activePending ? confirmClockOut : () => { void runAttendanceAction(onClockIn, '上班已记录'); }}
        />
        {completed && !attendanceFeedback && <Text style={styles.attendanceReason}>{formatClockTime(todayRecord?.clockIn)} 上班 · {formatClockTime(todayRecord?.clockOut)} 下班</Text>}
        {!resting && !completed && !activePending && !attendanceFeedback && <AttendanceButton variant="text" label="今天休息" disabled={attendanceBusy} motionLevel={state.settings.motionLevel} onPress={() => { void runAttendanceAction(onMarkRest, '休息已记录'); }} />}
        {!!attendanceError && <Text style={styles.attendanceError}>{attendanceError}</Text>}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>本月已赚</Text>
          <Text style={styles.metricValue}>¥{earnings.cycleEarned.toFixed(2)}</Text>
          <Text style={styles.metricCaption}>本工资周期</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>本月已花</Text>
          <Text style={styles.metricValue}>¥{financials.monthSpent.toFixed(2)}</Text>
          <Text style={styles.metricCaption}>自然月累计</Text>
        </View>
      </View>

      {state.goal && <Pressable onPress={onGoGoals} accessibilityRole="button" style={({ pressed }) => [styles.goalSection, pressed && styles.pressed]}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>存钱目标</Text>
          <Text style={styles.sectionName}>{state.goal.name} ›</Text>
        </View>
        <View style={styles.goalLine}>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${financials.goalProgress ?? 0}%` as `${number}%` }]} /></View>
          <Text style={styles.goalValue}>{Math.round(financials.goalProgress ?? 0)}%</Text>
          <Text style={styles.goalValue}>还差 ¥{financials.goalRemaining.toFixed(0)}</Text>
          <Text style={styles.goalDate}>截止 {state.goal.deadline}</Text>
        </View>
        <Text style={styles.goalCaption}>每日需存 ¥{financials.goalDailySave.toFixed(2)} · 剩余 {financials.goalRemainingDays ?? 0} 天</Text>
      </Pressable>}

      {state.settings.repaymentReminders && <Pressable onPress={onGoDebts} accessibilityRole="button" style={({ pressed }) => [styles.repaymentRow, pressed && styles.pressed]}>
        <View style={styles.repaymentBar} />
        <View style={styles.repaymentCopy}>
          <Text style={styles.sectionHeading}>近期还款</Text>
          <Text style={styles.repaymentCaption}>本月到期</Text>
        </View>
        <Text style={styles.repaymentAmount}>¥{financials.monthDue.toFixed(2)}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>}

      {risk && <Pressable onPress={onGoSettings} accessibilityRole="button" style={({ pressed }) => [styles.riskNotice, pressed && styles.pressed]}>
        <Text style={styles.riskTitle}>现金流缺口 ¥{financials.shortfall.toFixed(0)}</Text>
        <Text style={styles.riskText}>约需增加 {financials.extraWorkHours.toFixed(1)} 小时工作，或调整消费与目标 ›</Text>
      </Pressable>}
    </ScrollView>
  </View>
}

function AttendanceButton({ label, subLabel, variant, tone = 'accent', dashed, onPress, disabled, motionLevel }: {
  label: string;
  subLabel?: string;
  variant: 'primary' | 'text';
  tone?: 'accent' | 'warning' | 'success' | 'muted' | 'rest';
  dashed?: boolean;
  onPress: () => void;
  disabled: boolean;
  motionLevel: MotionLevel;
}) {
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const config = motion.levels[motionLevel];
  const animateIn = () => {
    scale.stopAnimation();
    if (motionLevel === 'standard') { scale.setValue(1); return; }
    Animated.timing(scale, { toValue: config.pressScale, duration: config.duration, useNativeDriver: true }).start();
  };
  const animateOut = () => {
    scale.stopAnimation();
    if (motionLevel === 'standard' || !config.spring) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: 1, ...config.spring, useNativeDriver: true }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const isText = variant === 'text';
  return <Animated.View style={[isText ? styles.attendanceTextWrap : styles.attendancePrimaryWrap, { transform: [{ scale }] }]}>
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { if (!isText) animateIn(); }}
      onPressOut={() => { if (!isText) animateOut(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        isText ? styles.attendanceTextButton : styles.attendancePrimaryButton,
        !isText && tone === 'warning' && styles.attendanceToneWarning,
        !isText && tone === 'success' && styles.attendanceToneSuccess,
        !isText && tone === 'muted' && styles.attendanceToneMuted,
        !isText && tone === 'rest' && styles.attendanceToneRest,
        dashed && styles.attendanceDashed,
        disabled && !isText && tone !== 'muted' && tone !== 'success' && styles.disabled,
      ]}
    >
      <Text style={[isText ? styles.attendanceTextLabel : styles.attendancePrimaryLabel, !isText && tone === 'muted' && styles.attendanceMutedText, !isText && tone === 'rest' && styles.attendanceMutedText]}>{label}</Text>
      {!!subLabel && <Text style={styles.attendanceSubLabel}>{subLabel}</Text>}
    </Pressable>
  </Animated.View>;
}

function hoursBetween(startValue: string, endValue: string | Date): number {
  const start = new Date(startValue).getTime();
  const end = endValue instanceof Date ? endValue.getTime() : new Date(endValue).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return (end - start) / 3600000;
}

function formatClockTime(value?: string): string {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0') + ':' + String(date.getSeconds()).padStart(2, '0');
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  topMeta: { minHeight: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, borderRadius: radius.sm },
  pendingTopMeta: { margin: -spacing.xs, paddingHorizontal: spacing.sm, backgroundColor: colors.warningSoft },
  kicker: { fontSize: 11, color: colors.muted, flexShrink: 0 },
  topStatus: { fontSize: 11, color: colors.muted, textAlign: 'right', flexShrink: 1, fontVariant: ['tabular-nums'] },
  pendingStatus: { color: colors.warning, fontWeight: '700' },
  hero: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  heroLabel: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  heroValue: { fontSize: 40, fontWeight: '700', color: colors.ink, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  warningValue: { color: colors.danger },
  balance: { fontSize: 11, color: colors.muted, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  primaryActionWrap: { width: '100%', marginTop: spacing.md }, primaryAction: { height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { fontSize: 14, color: colors.surface, fontWeight: '800' },
  insightsSection: { marginTop: spacing.md, gap: spacing.xs }, insightCard: { padding: spacing.sm, borderRadius: radius.sm, borderLeftWidth: 3 }, insightDanger: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger }, insightWarn: { backgroundColor: colors.warningSoft, borderLeftColor: colors.warning }, insightInfo: { backgroundColor: colors.accentSoft, borderLeftColor: colors.accent }, insightHeadline: { fontSize: 13, fontWeight: '900' }, insightDangerText: { color: colors.danger }, insightWarnText: { color: colors.warning }, insightInfoText: { color: colors.ink }, insightDetail: { fontSize: 11, lineHeight: 17, color: colors.ink, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] }, insightAction: { fontSize: 10, lineHeight: 16, color: colors.accent, fontWeight: '800', marginTop: spacing.xxs },
  attendanceSection: { marginTop: spacing.sm },
  attendanceStatusText: { fontSize: 11, color: colors.muted, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: spacing.xs },
  attendancePrimaryWrap: { width: '100%' },
  attendancePrimaryButton: { minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  attendancePrimaryLabel: { fontSize: 16, fontWeight: '800', color: colors.surface, fontVariant: ['tabular-nums'] },
  attendanceSubLabel: { fontSize: 12, fontWeight: '700', color: colors.surface, marginTop: 2, fontVariant: ['tabular-nums'] },
  attendanceToneWarning: { backgroundColor: colors.warning },
  attendanceToneSuccess: { backgroundColor: colors.success },
  attendanceToneMuted: { backgroundColor: colors.soft },
  attendanceToneRest: { backgroundColor: colors.surface },
  attendanceMutedText: { color: colors.muted },
  attendanceDashed: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted },
  attendanceTextWrap: { marginTop: spacing.xs, width: '100%' },
  attendanceTextButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  attendanceTextLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  attendanceReason: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.35 },
  attendanceError: { fontSize: 11, color: colors.danger, marginTop: spacing.xs },
  metricsRow: { flexDirection: 'row', marginTop: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  metricCell: { flex: 1, paddingHorizontal: spacing.xs },
  metricDivider: { width: 1, backgroundColor: colors.line },
  metricLabel: { fontSize: 11, color: colors.muted },
  metricValue: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  metricCaption: { fontSize: 10, color: colors.muted, marginTop: spacing.xxs },
  goalSection: { minHeight: 76, justifyContent: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  sectionHeading: { fontSize: 12, fontWeight: '800', color: colors.ink },
  sectionName: { fontSize: 11, color: colors.muted, flexShrink: 1 },
  goalLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  progressTrack: { flex: 1, height: 6, backgroundColor: colors.line, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success },
  goalValue: { fontSize: 10, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalDate: { fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  goalCaption: { fontSize: 10, color: colors.muted, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  repaymentRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  repaymentBar: { width: 4, alignSelf: 'stretch', marginVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.warning },
  repaymentCopy: { flex: 1 },
  repaymentCaption: { fontSize: 10, color: colors.muted, marginTop: 2 },
  repaymentAmount: { fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 20, color: colors.muted },
  riskNotice: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  riskTitle: { fontSize: 13, fontWeight: '800', color: colors.danger, fontVariant: ['tabular-nums'] },
  riskText: { fontSize: 11, color: colors.ink, lineHeight: 17, marginTop: spacing.xxs, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  });
}

