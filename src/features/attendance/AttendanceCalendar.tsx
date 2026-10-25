import { ThemedModal } from '../../ui/components/ThemedModal';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LedgerState } from '../../core/model/finance';
import { calculateEarnings } from '../../core/work/attendance';
import { radius, spacing, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { localDateKey } from './attendance';
import { buildMonthMatrix } from './calendarGrid';
import { applyTimeToDateKey, defaultClockInTime, durationHours, formatClockTimeInput, parseClockTimeInput } from './calendarTime';
import { useThemedStyles } from '../../ui/hooks/useThemedStyles';

export function AttendanceCalendar({ state, onBack, onClockIn, onMarkRest }: {
  state: LedgerState;
  onBack: () => void;
  onClockIn: (at: Date) => Promise<void>;
  onMarkRest: (at: Date) => Promise<void>;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(localDateKey(now));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clockInModalOpen, setClockInModalOpen] = useState(false);
  const [clockInTime, setClockInTime] = useState('18:00');
  const [clockInError, setClockInError] = useState('');
  const attendance = state.attendance ?? [];
  const matrix = buildMonthMatrix(view.year, view.month);
  const monthPrefix = `${view.year}-${String(view.month).padStart(2, '0')}`;
  const hasMonthAttendance = attendance.some((record) => record.date.startsWith(monthPrefix));
  const expenseByDate = new Map<string, number>();
  for (const transaction of state.transactions) {
    if (transaction.type !== 'expense') continue;
    const key = localDateKey(new Date(transaction.occurredAt));
    expenseByDate.set(key, (expenseByDate.get(key) ?? 0) + transaction.amount);
  }
  const selectedRecord = attendance.find((record) => record.date === selectedDate);
  const selectedTransactions = state.transactions
    .filter((transaction) => transaction.type === 'expense' && localDateKey(new Date(transaction.occurredAt)) === selectedDate)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const selectedExpenseTotal = selectedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const selectedEarnings = calculateEarnings(state.settings.work, attendance, selectedDateAt(selectedDate, now));
  const selectedDuration = durationHours(selectedRecord?.clockIn, selectedRecord?.clockOut);
  const parsedClockInTime = parseClockTimeInput(clockInTime);
  const clockInTimeValid = parsedClockInTime !== null;

  const changeMonth = (delta: number) => {
    const next = new Date(view.year, view.month - 1 + delta, 1, 12);
    setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
    setSelectedDate('');
    setError('');
  };
  const runAction = async (action: (at: Date) => Promise<void>) => {
    if (!selectedDate) return;
    setBusy(true);
    setError('');
    try {
      await action(applyTimeToDateKey(selectedDate, 12, 0));
    } catch {
      setError('保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  const openClockInEditor = () => {
    setClockInTime(defaultClockInTime(state.settings.work));
    setClockInError('');
    setClockInModalOpen(true);
  };
  const updateClockInTime = (value: string) => {
    const filtered = value.replace(/[^0-9:]/g, '').slice(0, 5);
    const next = /^\d{4}$/.test(filtered) ? formatClockTimeInput(filtered) : filtered;
    setClockInTime(next);
    setClockInError(next && !parseClockTimeInput(next) ? '请输入 00:00–23:59 的合法时间。' : '');
  };
  const confirmClockIn = async () => {
    if (!selectedDate || !parsedClockInTime) return;
    setBusy(true);
    setClockInError('');
    try {
      await onClockIn(applyTimeToDateKey(selectedDate, parsedClockInTime.hours, parsedClockInTime.minutes));
      setClockInModalOpen(false);
    } catch {
      setClockInError('保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return <><ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
    <Pressable onPress={onBack} accessibilityRole="button" style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Text style={styles.backText}>‹ 返回</Text>
    </Pressable>
    <View style={styles.monthHeader}>
      <Pressable onPress={() => changeMonth(-1)} accessibilityRole="button" style={styles.monthButton}><Text style={styles.monthArrow}>‹</Text></Pressable>
      <Text style={styles.monthTitle}>{view.year} 年 {view.month} 月</Text>
      <Pressable onPress={() => changeMonth(1)} accessibilityRole="button" style={styles.monthButton}><Text style={styles.monthArrow}>›</Text></Pressable>
    </View>
    <View style={styles.weekHeader}>{['一', '二', '三', '四', '五', '六', '日'].map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
    <View style={styles.grid}>{matrix.map((week, weekIndex) => <View key={weekIndex} style={styles.week}>{week.map((day) => {
      const record = attendance.find((item) => item.date === day.dateKey);
      const expense = expenseByDate.get(day.dateKey) ?? 0;
      const isToday = day.dateKey === localDateKey(now);
      const selected = day.dateKey === selectedDate;
      return <Pressable key={day.dateKey} disabled={!day.inMonth} onPress={() => { setSelectedDate(day.dateKey); setError(''); }} style={[styles.day, !day.inMonth && styles.dayOutside, isToday && styles.dayToday, selected && styles.daySelected]}>
        <Text style={[styles.dayNumber, !day.inMonth && styles.dayNumberOutside]}>{day.day}</Text>
        <Text style={styles.dayExpense}>{expense > 0 ? `¥${expense.toFixed(0)}` : ' '}</Text>
        <View style={[styles.statusBar, record?.status === 'worked' ? styles.workedBar : record?.status === 'rest' ? styles.restBar : record?.status === 'leave' ? styles.leaveBar : styles.emptyBar]} />
      </Pressable>;
    })}</View>)}</View>
    {!hasMonthAttendance && <Text style={styles.emptyMonth}>这个月还没有考勤记录</Text>}

    {selectedDate && <View style={styles.detail}>
      <Text style={styles.detailDate}>{formatDateLabel(selectedDate)}</Text>
      <Text style={styles.sectionTitle}>考勤</Text>
      <View style={styles.attendanceDetail}>
        <Text style={styles.detailLine}>上班 {formatTime(selectedRecord?.clockIn)}</Text>
        <Text style={styles.detailLine}>下班 {formatTime(selectedRecord?.clockOut)}</Text>
        <Text style={styles.detailLine}>时长 {selectedDuration === null ? '未完成' : `${selectedDuration.toFixed(1)} 小时`}</Text>
        <Text style={styles.detailLine}>当天日薪 {selectedRecord?.status === 'worked' && selectedRecord.clockOut ? `¥${selectedEarnings.dailySalary.toFixed(2)}` : '未计薪'}</Text>
      </View>
      <Text style={styles.sectionTitle}>消费</Text>
      {selectedTransactions.length ? selectedTransactions.map((transaction) => <View key={transaction.id} style={styles.transactionRow}>
        <Text style={styles.transactionCategory}>{transaction.category ?? '其他'}</Text>
        <Text style={styles.transactionTime}>{formatTime(transaction.occurredAt)}</Text>
        <Text style={styles.transactionAmount}>¥{transaction.amount.toFixed(2)}</Text>
      </View>) : <Text style={styles.emptyDetail}>当天没有消费记录</Text>}
      <View style={styles.totalRow}><Text style={styles.totalLabel}>合计</Text><Text style={styles.totalValue}>¥{selectedExpenseTotal.toFixed(2)}</Text></View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={openClockInEditor} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.actionText}>补打上班卡</Text></Pressable>
        <Pressable disabled={busy} onPress={() => { void runAction(onMarkRest); }} style={({ pressed }) => [styles.actionButton, styles.restButton, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.restActionText}>标记休息</Text></Pressable>
      </View>
    </View>}
  </ScrollView>
    <ThemedModal visible={clockInModalOpen} transparent animationType={state.settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setClockInModalOpen(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{formatDateLabel(selectedDate)} 上班时间</Text>
        <TextInput value={clockInTime} onChangeText={updateClockInTime} keyboardType="number-pad" maxLength={5} placeholder="HH:MM" placeholderTextColor={colors.muted} style={styles.timeInput} />
        {!!clockInError && <Text style={styles.error}>{clockInError}</Text>}
        <View style={styles.modalActions}>
          <Pressable onPress={() => setClockInModalOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>取消</Text></Pressable>
          <Pressable disabled={!clockInTimeValid || busy} onPress={() => { void confirmClockIn(); }} style={[styles.confirmButton, (!clockInTimeValid || busy) && styles.disabled]}><Text style={styles.confirmText}>确认</Text></Pressable>
        </View>
      </View></View>
    </ThemedModal>
  </>;
}

function selectedDateAt(dateKey: string, now: Date): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
}

function formatTime(value?: string): string {
  if (!value) return '--:--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)} 月 ${Number(day)} 日`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  back: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm },
  backText: { fontSize: 12, color: colors.accent, fontWeight: '800' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface },
  monthArrow: { fontSize: 24, color: colors.ink },
  monthTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'] },
  weekHeader: { flexDirection: 'row', marginTop: spacing.md },
  weekDay: { width: `${100 / 7}%` as `${number}%`, textAlign: 'center', fontSize: 11, color: colors.muted },
  grid: { marginTop: spacing.xs },
  week: { flexDirection: 'row' },
  day: { width: `${100 / 7}%` as `${number}%`, height: 56, alignItems: 'center', paddingVertical: spacing.xxs, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  dayOutside: { opacity: 0.35 },
  dayToday: { borderColor: colors.accent },
  daySelected: { backgroundColor: colors.accentSoft },
  dayNumber: { fontSize: 12, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayNumberOutside: { color: colors.muted },
  dayExpense: { minHeight: 14, fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  statusBar: { width: 18, height: 3, borderRadius: radius.pill },
  workedBar: { backgroundColor: colors.accent },
  restBar: { backgroundColor: colors.muted },
  leaveBar: { backgroundColor: colors.warning },
  emptyBar: { opacity: 0 },
  emptyMonth: { fontSize: 11, color: colors.muted, marginTop: spacing.sm },
  detail: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  detailDate: { fontSize: 16, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.ink, marginTop: spacing.md, marginBottom: spacing.xs },
  attendanceDetail: { gap: spacing.xxs },
  detailLine: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
  transactionRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  transactionCategory: { flex: 1, fontSize: 12, color: colors.ink },
  transactionTime: { fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  transactionAmount: { fontSize: 12, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  emptyDetail: { fontSize: 11, color: colors.muted, paddingVertical: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 13, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.accent },
  restButton: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line },
  actionText: { fontSize: 12, color: colors.surface, fontWeight: '800' },
  restActionText: { fontSize: 12, color: colors.ink, fontWeight: '800' },
  error: { fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl }, sheetTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'] }, timeInput: { height: 52, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 20, fontVariant: ['tabular-nums'] }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }, cancelButton: { minHeight: 44, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.soft }, cancelText: { fontSize: 12, color: colors.ink, fontWeight: '700' }, confirmButton: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.accent }, confirmText: { fontSize: 12, color: colors.surface, fontWeight: '800' },
  });
}

