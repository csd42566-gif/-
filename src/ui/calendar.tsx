/**
 * 月历组件（方案 B 定稿）：记账表单与流水编辑共用的日期选择。
 * 支持「过去任意日期」（决策 21）；无依赖、纯 RN 组件。颜色跟随主题。
 *
 * 视觉：白卡 + 顶部「‹ 2026年11月 ›」；周标题小字距；选中日是琥珀渐变实心圆，
 * 今天未选中时是琥珀描边圆环；未来日期灰掉且不可点。
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RADIUS, useTheme } from './theme';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export interface CalendarProps {
  /** 当前显示的年月。 */
  year: number;
  month: number; // 1–12
  /** 选中日期（epoch 秒，本地零点）。null = 未选。 */
  selected: number | null;
  /** 今天（epoch 秒，本地零点），用于标记。 */
  todayStart: number;
  /** 点某天。 */
  onSelect: (epochSeconds: number) => void;
  /** 上月。 */
  onPrevMonth: () => void;
  /** 下月。 */
  onNextMonth: () => void;
  /** 是否允许选未来（默认 false：补记只到昨天）。 */
  allowFuture?: boolean;
}

export function Calendar({
  year,
  month,
  selected,
  todayStart,
  onSelect,
  onPrevMonth,
  onNextMonth,
  allowFuture = false,
}: CalendarProps) {
  const theme = useTheme();
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // 周一 = 0 起：JS getDay() 周日=0
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: Array<{ key: string; day: number; epoch: number } | { key: string; blank: true }> =
    [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ key: `blank-${i}`, blank: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const epoch = new Date(year, month - 1, day).getTime() / 1000;
    cells.push({ key: `d-${day}`, day, epoch });
  }

  return (
    <View style={[styles.card, theme.card]}>
      <View style={styles.header}>
        <Pressable style={styles.nav} onPress={onPrevMonth} accessibilityLabel="上月">
          <Text style={[styles.navText, { color: theme.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>
          {year}年{month}月
        </Text>
        <Pressable style={styles.nav} onPress={onNextMonth} accessibilityLabel="下月">
          <Text style={[styles.navText, { color: theme.accent }]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={[styles.weekLabel, { color: theme.ghost }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell) => {
          if ('blank' in cell) {
            return <View key={cell.key} style={styles.cellOuter} />;
          }
          const isSelected = selected === cell.epoch;
          const isToday = todayStart === cell.epoch;
          const isFuture = !allowFuture && cell.epoch > todayStart;
          return (
            <View key={cell.key} style={styles.cellOuter}>
              <Pressable
                style={[
                  styles.cell,
                  isSelected && {
                    backgroundImage: theme.amberGradient,
                    backgroundColor: theme.amber,
                  },
                  !isSelected && isToday && { borderWidth: 1.4, borderColor: theme.amber },
                ]}
                disabled={isFuture}
                onPress={() => onSelect(cell.epoch)}
              >
                <Text
                  style={[
                    styles.day,
                    {
                      color: isSelected
                        ? theme.onAmber
                        : isFuture
                          ? theme.ghost
                          : isToday
                            ? theme.accent
                            : theme.text,
                    },
                    isToday && styles.dayToday,
                    isSelected && styles.dayOn,
                  ]}
                >
                  {cell.day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.cardSm,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nav: { paddingHorizontal: 12, paddingVertical: 3 },
  navText: { fontSize: 20,
    includeFontPadding: false,
    lineHeight: 22.0, fontWeight: '700' },
  title: { fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '800', letterSpacing: -0.2 },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9.5,
    includeFontPadding: false,
    lineHeight: 11.6,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellOuter: { width: `${100 / 7}%`, padding: 2 },
  cell: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  day: { fontSize: 9.2 },
  dayToday: { fontWeight: '800' },
  dayOn: { fontWeight: '800' },
});
