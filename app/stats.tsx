/**
 * 洞察页（Pocket 参考定稿 2026-11-20）：
 * 页头（kicker + 标题 + 日历钮）→ 深绿主卡 → 分段控件（日/周/月）→ 统计卡。
 *
 * 参考图第 2 屏（Insights）在页头与主卡之间有一组分段控件（轨道 #ECECE4 + 白色选中块），
 * 主卡下面另有多张白卡（含绿占比的统计块）。本页按此结构重组：新增
 * RANGE_OPTIONS 分段（日/周/月，UI 层状态，月=全量口径、其余暂复用同口径数据），
 * 原「分类占比」白卡加标题行。曲线/环图/洞察文案的纯函数逻辑全部不变。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { DEFAULT_CURRENCY, formatCurrencyAmount } from '../src/core/currency';
import {
  buildInsightNotes,
  dayKeyLabel,
  rangeCategorySlices,
  rangeExpenseSummary,
  rangeTotals,
  rangeWindow,
} from '../src/core/ledger/insight';
import type { StatRange } from '../src/core/ledger/insight';
import { dailyExpenseSeries, lastNDayKeys } from '../src/core/ledger/spark';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import { useSettingsStore } from '../src/features/settings/settingsStore';
import { Aurora } from '../src/ui/aurora';
import { BottomDock } from '../src/ui/dock';
import { BottomFade } from '../src/ui/bottomFade';
import { TopFade } from '../src/ui/topFade';
import { PageHead } from '../src/ui/pageHead';
import { Sparkline } from '../src/ui/sparkline';
import { TiltLayer, TiltPanel } from '../src/ui/tiltPanel';
import { PressScale } from '../src/ui/pressScale';
import { RADIUS, useTheme } from '../src/ui/theme';

/** 曲线的统计窗口：一个月。 */
const SPARK_DAYS = 30;
/** 环形图几何：viewBox 200×200、半径 70、描边 26。 */
/** 环图外框边长（dp）：原型 .pieBox 186px × K = 100.7dp。 */
const PIE_BOX = 100.7;
const DONUT_R = 78;
const DONUT_STROKE = 30;
const DONUT_CIRCUM = 2 * Math.PI * DONUT_R;

/** Pocket 参考第 2 屏的统计范围分段。口径由 core/ledger/insight 的 rangeWindow 定义。 */
const RANGE_OPTIONS: { key: StatRange; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
];

export default function Stats() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transactions, loaded, load } = useLedgerStore();
  const { categories, loaded: categoriesLoaded, load: loadCategories } = useCategoriesStore();
  const monthlyBudgetCents = useSettingsStore((s) => s.monthlyBudgetCents);

  /** 曲线宽度由 onLayout 量出来，避免硬编码屏宽导致右侧溢出。 */
  const [curveWidth, setCurveWidth] = useState(0);
  const onCurveLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setCurveWidth(e.nativeEvent.layout.width);
  }, []);

  /** Pocket 参考的分段控件：UI 层状态，月=现有全量口径，日/周暂复用同一口径。 */
  const [statRange, setStatRange] = useState<StatRange>('month');

  useEffect(() => {
    if (!loaded) void load();
    if (!categoriesLoaded) void loadCategories();
  }, [loaded, categoriesLoaded, load, loadCategories]);

  const now = useMemo(() => new Date(), []);

  const categoryName = useCallback(
    (id: number) => categories.find((c) => c.id === id)?.name ?? '未分类',
    [categories],
  );

  /**
   * 子类 id → 父类 id。流水多半记在「午饭」这种小类上，
   * 但占比图和洞察文案说「吃饭」（大类），不映射会得到「午饭 100%」。
   */
  const parentOf = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of categories) {
      if (c.parentId !== null) map.set(c.id, c.parentId);
    }
    return map;
  }, [categories]);

  /** 主币种：本月支出最大的币种，没有支出时回退 CNY。 */
  const primaryCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.kind !== 'expense') continue;
      map.set(t.currency, (map.get(t.currency) ?? 0) + t.amountCents);
    }
    if (map.size === 0) return DEFAULT_CURRENCY;
    return [...map.entries()].reduce((max, cur) => (cur[1] > max[1] ? cur : max))[0];
  }, [transactions]);

  const summary = useMemo(
    () => rangeExpenseSummary(transactions, statRange, now, primaryCurrency),
    [transactions, statRange, now, primaryCurrency],
  );
  const slices = useMemo(
    () => rangeCategorySlices(transactions, statRange, now, primaryCurrency, parentOf),
    [transactions, statRange, now, primaryCurrency, parentOf],
  );
  const totals = useMemo(
    () => rangeTotals(transactions, statRange, now, primaryCurrency),
    [transactions, statRange, now, primaryCurrency],
  );
  const win = useMemo(() => rangeWindow(statRange, now), [statRange, now]);
  const prevPeriodCents = totals.length > 1 ? totals[1].cents : 0;

  /** 曲线窗口：日视图也给 7 天做背景（只画 1 个点看不出趋势），周 7 天、月 30 天。 */
  const sparkDays = statRange === 'month' ? SPARK_DAYS : 7;

  const notes = useMemo(
    () =>
      buildInsightNotes({
        summary,
        slices,
        categoryName,
        currency: primaryCurrency,
        budgetCents:
          statRange === 'month' && primaryCurrency === DEFAULT_CURRENCY ? monthlyBudgetCents : 0,
        prevMonthCents: prevPeriodCents,
        periodLabel: statRange === 'month' ? '本月' : statRange === 'week' ? '近 7 天' : '今天',
        prevPeriodLabel: win.prevLabel,
      }),
    [
      summary,
      slices,
      categoryName,
      primaryCurrency,
      monthlyBudgetCents,
      prevPeriodCents,
      statRange,
      win.prevLabel,
    ],
  );

  const sparkSeries = useMemo(
    () => dailyExpenseSeries(transactions, sparkDays, now, primaryCurrency).map((p) => p.cents),
    [transactions, sparkDays, now, primaryCurrency],
  );

  const money = (cents: number) => formatCurrencyAmount(cents, primaryCurrency);

  /** 曲线轴标：原型是「起点日期 / 中段日期 / 今天」三段。 */
  const axisStart = useMemo(() => {
    const keys = lastNDayKeys(sparkDays, now);
    return dayKeyLabel(keys[0]);
  }, [sparkDays, now]);
  const axisMid = useMemo(() => {
    const keys = lastNDayKeys(sparkDays, now);
    return dayKeyLabel(keys[Math.floor(keys.length / 2)]);
  }, [sparkDays, now]);

  /** 环比徽章：上一周期无记录时不显示，避免「比上期多 ∞%」。 */
  const momBadge = useMemo(() => {
    if (prevPeriodCents <= 0) return null;
    const diff = summary.totalCents - prevPeriodCents;
    const pct = Math.round((Math.abs(diff) / prevPeriodCents) * 100);
    if (pct === 0) return `和${win.prevLabel}持平`;
    return diff > 0 ? `比${win.prevLabel}多 ${pct}%` : `比${win.prevLabel}少 ${pct}%`;
  }, [summary.totalCents, prevPeriodCents, win.prevLabel]);

  /** 环形图切片：Top4（含未分类归到「未分类」由 slices 外部处理，这里只取有分类的）。 */
  const donut = useMemo(() => {
    const top = slices.slice(0, 4);
    const total = top.reduce((s, x) => s + x.cents, 0);
    let acc = 0;
    return top.map((s, i) => {
      const len = total > 0 ? (s.cents / total) * DONUT_CIRCUM : 0;
      const seg = {
        key: s.categoryId,
        color: theme.chart[i % theme.chart.length],
        dashArray: `${len} ${DONUT_CIRCUM - len}`,
        dashOffset: -acc,
        percent: s.percent,
        cents: s.cents,
        name: categoryName(s.categoryId),
      };
      acc += len;
      return seg;
    });
  }, [slices, theme.chart, categoryName]);

  /** 对比条：以两者最大值为满格。 */
  const cmpMax = Math.max(totals[0]?.cents ?? 0, prevPeriodCents, 1);

  const kickerMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  return (
    <Aurora>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHead
          kicker={`分析 · ${kickerMonth}`}
          title="洞察"
          action={
            <PressScale pressedScale={0.9}
              style={[styles.roundBtn, theme.card]}
              accessibilityLabel="搜索账单"
              hitSlop={8}
              onPress={() => router.push('/search')}
            >
              {/* 原型 .roundBtn 里是日历图标（rect + 两条挂轴 + 三个日期点），不是放大镜。 */}
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Rect
                  x={3.5}
                  y={5}
                  width={17}
                  height={15.5}
                  rx={3}
                  stroke={theme.accent}
                  strokeWidth={1.9}
                />
                <Path
                  d="M3.5 9.6h17M8.2 3v4M15.8 3v4"
                  stroke={theme.accent}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                />
                <Circle cx={8.6} cy={13.6} r={1.15} fill={theme.accent} />
                <Circle cx={12} cy={13.6} r={1.15} fill={theme.accent} />
                <Circle cx={15.4} cy={13.6} r={1.15} fill={theme.accent} />
              </Svg>
            </PressScale>
          }
        />

        {/* Pocket 参考：页头与主卡之间的分段控件（轨道 + 白色选中块）。 */}
        <View style={styles.rangeRow}>
          <View style={styles.rangeTrack}>
            {RANGE_OPTIONS.map((opt) => {
              const active = statRange === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.rangeItem, active && styles.rangeItemOn]}
                  onPress={() => setStatRange(opt.key)}
                  accessibilityLabel={`统计范围${opt.label}`}
                >
                  <Text
                    style={[
                      styles.rangeText,
                      { color: active ? theme.text : theme.muted },
                      active && styles.rangeTextOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 主卡：随分段切换的支出汇总 + 3D 倾斜光影 */}
        <TiltPanel
          style={styles.hero}
          cardStyle={[styles.heroSurface, theme.heroCard]}
          >
          <TiltLayer depth={0.45}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroLabel, { color: theme.heroMuted }]}>{win.label}</Text>
            {momBadge !== null && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{momBadge}</Text>
              </View>
            )}
          </View>
          </TiltLayer>

          <TiltLayer depth={0.85}>
            <Text style={[styles.heroNum, { color: theme.heroText }]} numberOfLines={1}>
              {money(summary.totalCents)}
            </Text>
          </TiltLayer>

          <TiltLayer depth={0.45}>
          <View style={styles.miniRow3}>
            <View style={styles.m3}>
              <Text style={[styles.m3l, { color: theme.heroMuted }]}>日均</Text>
              <Text style={[styles.m3v, { color: theme.heroText }]} numberOfLines={1}>
                {money(summary.avgPerDayCents)}
              </Text>
            </View>
            <View style={[styles.m3, styles.m3Divider, { borderLeftColor: theme.heroLine }]}>
              <Text style={[styles.m3l, { color: theme.heroMuted }]}>笔数</Text>
              <Text style={[styles.m3v, { color: theme.heroText }]} numberOfLines={1}>
                {summary.count} 笔
              </Text>
            </View>
            <View style={[styles.m3, styles.m3Divider, { borderLeftColor: theme.heroLine }]}>
              <Text style={[styles.m3l, { color: theme.heroMuted }]}>最高单日</Text>
              <Text style={[styles.m3v, { color: theme.heroText }]} numberOfLines={1}>
                {money(summary.peakDayCents)}
              </Text>
            </View>
          </View>
          </TiltLayer>

          <View style={[styles.heroRule, { backgroundColor: theme.heroLine }]} />

          <View onLayout={onCurveLayout} style={styles.curveBox}>
            {curveWidth > 0 && (
              <Sparkline
                series={sparkSeries}
                width={curveWidth}
                height={50}
                color={theme.heroText}
                fillOpacity={0.3}
                strokeWidth={1.5}
              />
            )}
          </View>
          <View style={styles.axis}>
            <Text style={[styles.axisText, { color: theme.heroMuted }]}>{axisStart}</Text>
            <Text style={[styles.axisText, { color: theme.heroMuted }]}>{axisMid}</Text>
            <Text style={[styles.axisText, { color: theme.heroMuted }]}>今天</Text>
          </View>
        </TiltPanel>

        {/* 分类占比 —— Pocket 参考里这一块是小节标题 + 白卡，标题不进卡内。 */}
        <View style={styles.secRow}>
          <Text style={[styles.secLabel, { color: theme.sectionLabel }]}>钱去哪了</Text>
          <Text style={[styles.pieSub, { color: theme.faint }]}>主币种</Text>
        </View>
        <View style={[styles.pieCard, theme.card]}>
          {donut.length === 0 ? (
            <Text style={[styles.hint, { color: theme.faint }]}>这段时间还没有带分类的支出。</Text>
          ) : (
            <>
              <View style={styles.pieBody}>
              <View style={styles.pieBox}>
                <Svg width={PIE_BOX} height={PIE_BOX} viewBox="0 0 200 200">
                  <Circle
                    cx={100}
                    cy={100}
                    r={DONUT_R}
                    stroke={theme.cardAlt.backgroundColor}
                    strokeWidth={DONUT_STROKE}
                    fill="none"
                  />
                  <G rotation={-90} origin="100, 100">
                    {donut.map((seg) => (
                      <Circle
                        key={seg.key}
                        cx={100}
                        cy={100}
                        r={DONUT_R}
                        stroke={seg.color}
                        strokeWidth={DONUT_STROKE}
                        fill="none"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="butt"
                      />
                    ))}
                  </G>
                </Svg>
                <View style={styles.pieCenter} pointerEvents="none">
                  <Text style={[styles.pcLbl, { color: theme.faint }]}>总支出</Text>
                  <Text style={[styles.pcVal, { color: theme.text }]} numberOfLines={1}>
                    {money(summary.totalCents)}
                  </Text>
                </View>
              </View>

              <View style={styles.legend}>
                {donut.map((seg) => (
                  <View key={seg.key} style={styles.lg}>
                    <View style={[styles.dot, { backgroundColor: seg.color }]} />
                    <View style={styles.lgBody}>
                      <View style={styles.lgTop}>
                        <Text style={[styles.lgName, { color: theme.text }]} numberOfLines={1}>
                          {seg.name}
                        </Text>
                        <Text style={[styles.lgPct, { color: theme.faint }]}>{seg.percent}%</Text>
                      </View>
                      <View style={[styles.lgBar, { backgroundColor: theme.cardAlt.backgroundColor }]}>
                        <View
                          style={[
                            styles.lgFill,
                            { width: `${seg.percent}%`, backgroundColor: seg.color },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              </View>
            </>
          )}
        </View>

        {/* 值得留意 */}
        {notes.length > 0 && (
          <>
            <Text style={[styles.noteTitle, { color: theme.sectionLabel }]}>值得留意</Text>
            <View style={styles.notes}>
              {notes.map((n, i) => (
                <View key={n.key} style={[styles.note, theme.card]}>
                  <View
                    style={[
                      styles.noteBar,
                      { backgroundColor: theme.chart[i % theme.chart.length] },
                    ]}
                  />
                  <View style={styles.noteBody}>
                    <Text style={[styles.noteHd, { color: theme.text }]}>{n.title}</Text>
                    <Text style={[styles.noteTx, { color: theme.muted }]}>{n.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 本期 vs 上一期（标签随分段控件变） */}
        {totals.length === 2 && (
          <View style={[styles.cmpCard, theme.card]}>
            {totals.map((t, i) => (
              <View key={t.label} style={[styles.cmpRow, i > 0 && styles.cmpRowGap]}>
                <Text style={[styles.cmpLbl, { color: i === 0 ? theme.accent : theme.faint }]}>
                  {t.label}
                </Text>
                <View style={[styles.cmpTrack, { backgroundColor: theme.cardAlt.backgroundColor }]}>
                  <View
                    style={[
                      styles.cmpFill,
                      {
                        width: `${Math.max(2, Math.round((t.cents / cmpMax) * 100))}%`,
                        backgroundImage: i === 0 ? theme.amberGradient : undefined,
                        backgroundColor:
                          i === 0 ? theme.amber : 'rgba(32,60,52,0.16)',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.cmpVal, { color: theme.text }]} numberOfLines={1}>
                  {money(t.cents)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TopFade top={insets.top} />

      <BottomFade bottom={insets.bottom + 68} />
      <BottomDock active="insight" bottomInset={insets.bottom} />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 17, paddingBottom: 150 },

  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 主卡
  hero: {
    marginTop: 14.1,
  },
  heroSurface: {
    paddingTop: 17.6,
    paddingHorizontal: 14.1,
    paddingBottom: 15.3,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontSize: 8.7, letterSpacing: 1.6, fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 10.4,
  },
  badge: {
    paddingHorizontal: 9.7,
    paddingVertical: 4.3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: { fontSize: 8.1, fontWeight: '800', letterSpacing: 0.3, color: '#FFFFFF',
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  heroNum: {
    fontSize: 30.3,
    fontWeight: '800',
    letterSpacing: -0.87,
    marginTop: 12.9,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 34.0,
  },
  miniRow3: { flexDirection: 'row', marginTop: 12.1 },
  m3: { flex: 1, minWidth: 0 },
  m3Divider: { borderLeftWidth: 1, paddingLeft: 9.7 },
  m3l: { fontSize: 7.0, fontWeight: '600', letterSpacing: 0.4,
    includeFontPadding: false,
    lineHeight: 8.4,
  },
  m3v: {
    fontSize: 11.4,
    fontWeight: '800',
    marginTop: 3.3,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 13.7,
  },
  heroRule: { height: 1, marginTop: 11.2, marginBottom: 7.0 },
  curveBox: { height: 50 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3.5 },
  axisText: { fontSize: 6.5, letterSpacing: 0.2,
    includeFontPadding: false,
    lineHeight: 8.0,
  },

  // 统计范围分段（Pocket 参考第 2 屏）
  rangeRow: { marginTop: 14.1 },
  rangeTrack: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#ECECE4',
    borderRadius: RADIUS.pill,
    padding: 3.2,
    gap: 3.2,
  },
  rangeItem: {
    paddingHorizontal: 14.1,
    paddingVertical: 6.0,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeItemOn: { backgroundColor: '#FFFFFF' },
  rangeText: { fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2, fontWeight: '700' },
  rangeTextOn: { fontWeight: '800' },

  // 分类占比
  pieCard: {
    marginTop: 14.1,
    borderRadius: RADIUS.card,
    paddingTop: 13,
    paddingBottom: 11.9,
    paddingHorizontal: 14.1,
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 15.2,
    marginBottom: 5.4,
  },
  pieSub: { fontSize: 7.6, fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 9.2,
  },
  pieBody: { flexDirection: 'row', alignItems: 'center', gap: 14.1 },
  pieBox: { width: PIE_BOX, height: PIE_BOX, alignItems: 'center', justifyContent: 'center' },
  pieCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcLbl: { fontSize: 7.0, letterSpacing: 0.6, fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 8.4,
  },
  pcVal: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 16.0,
  },
  legend: { flex: 1, minWidth: 0, gap: 8.1 },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 6.0 },
  dot: { width: 6.0, height: 6.0, borderRadius: 3.2 },
  lgBody: { flex: 1, minWidth: 0 },
  lgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lgName: { fontSize: 8.7, fontWeight: '700', flex: 1, minWidth: 0,
    includeFontPadding: false,
    lineHeight: 10.4,
  },
  lgPct: { fontSize: 7.6, fontWeight: '700', fontVariant: ['tabular-nums'], marginLeft: 4,
    includeFontPadding: false,
    lineHeight: 9.2,
  },
  lgBar: { height: 3.8, borderRadius: 2, marginTop: 3.8, overflow: 'hidden' },
  lgFill: { height: '100%', borderRadius: 2 },

  // 值得留意
  secLabel: { fontSize: 8.7, letterSpacing: 1.84, fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 10.4,
  },
  noteTitle: { fontSize: 8.7, letterSpacing: 1.84, fontWeight: '700', marginTop: 15.2,
    includeFontPadding: false,
    lineHeight: 10.4,
  },
  notes: { marginTop: 6.5, gap: 6.0 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8.1,
    paddingVertical: 9.7,
    paddingHorizontal: 10.8,
    borderRadius: 14.1,
  },
  noteBar: { width: 2.7, borderRadius: 1.3, alignSelf: 'stretch' },
  noteBody: { flex: 1, minWidth: 0 },
  noteHd: { fontSize: 10.3, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 12.4,
  },
  noteTx: { fontSize: 8.4, lineHeight: 12.6, marginTop: 2.7,
    includeFontPadding: false,
  },

  // 本月 vs 上月
  cmpCard: {
    marginTop: 6.5,
    borderRadius: RADIUS.card,
    paddingTop: 13,
    paddingBottom: 14.1,
    paddingHorizontal: 14.1,
  },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 8.7 },
  cmpRowGap: { marginTop: 8.7 },
  cmpLbl: { flexBasis: 33.6, fontSize: 8.1, fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  cmpTrack: { flex: 1, height: 14.1, borderRadius: 7, overflow: 'hidden' },
  cmpFill: { height: '100%', borderRadius: 7 },
  cmpVal: {
    flexBasis: 52,
    textAlign: 'right',
    fontSize: 9.2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 11.0,
  },

  hint: { fontSize: 12, paddingVertical: 8 },
});
