/**
 * 概览页（方案 B 定稿）：米白纸面 + 琥珀实色主卡 + 分类三彩卡 + 分隔线流水 + 白 dock。
 *
 * 用户 2026-11-17 选定方案 B（`mockups/home-ref-b-final.html`）并逐轮批注定稿，
 * 本文件按原型一比一落地（HTML 760px 宽 → RN 411dp，尺寸约按 0.54 折算）。
 *
 * 结构：
 * 1. 页头：kicker「账本 · 本月」+ 大标题「概览」+ 右上圆形白钮（放大镜 → 搜索页）。
 * 2. 主卡：总余额、预算进度条、双栏「剩 / of 月预算」、本月支出与收入、右侧 30 天曲线。
 * 3. 分类三彩卡：本月支出 Top3（不足三张时补空位，保持三列对齐）。
 * 4. 流水：按天分组，分隔线式行（不是卡片），非今日默认折叠。
 * 5. dock：见 src/ui/dock.tsx（五项等分，当前页紫色软底）。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
  ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { totalBalanceByCurrencyCents } from '../src/core/balance';
import { DEFAULT_CURRENCY, formatCurrencyAmount } from '../src/core/currency';
import { groupByDay, summarizeDayItems } from '../src/core/ledger/grouping';
import { dayLabel } from '../src/core/ledger/dayLabel';
import { dailyExpenseSeries, peakDailyCents } from '../src/core/ledger/spark';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import { useSettingsStore } from '../src/features/settings/settingsStore';
import { useOnboardingStore } from '../src/features/onboarding/onboardingStore';
import { Aurora } from '../src/ui/aurora';
import { BottomFade } from '../src/ui/bottomFade';
import { TopFade } from '../src/ui/topFade';
import { CategoryIcon } from '../src/ui/categoryIcon';
import { BottomDock } from '../src/ui/dock';
import { ElasticGrid, elasticGridStyle } from '../src/ui/elasticGrid';
import { MorphDetailHost, openMorph } from '../src/ui/morphDetail';
import { PressScale } from '../src/ui/pressScale';
import { PageHead } from '../src/ui/pageHead';
import { NumberRollText } from '../src/ui/numberRoll';
import { Sparkline } from '../src/ui/sparkline';
import { TiltLayer, TiltPanel } from '../src/ui/tiltPanel';
import { RADIUS, useTheme, type ThemeColors } from '../src/ui/theme';

/** 曲线的统计窗口：一个月。 */
const SPARK_DAYS = 30;
/** 原型 `.spark { flex:0 0 178px }` + svg 178×70 → 96.4×37.9dp。 */
const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 38;
/** 趋势三角配色：参考图用浅绿系（深绿主卡上），花超了换浅红。 */
const TREND_DOWN_COLOR = '#CCD8BC';
const TREND_UP_COLOR = '#E8A18F';

/** 按币种汇总某种流水（occurredAt >= from），按币种代码排序。 */
function sumByCurrency(
  rows: { kind: string; amountCents: number; currency: string; occurredAt: number }[],
  kind: string,
  from: number,
): [string, number][] {
  const map = new Map<string, number>();
  for (const t of rows) {
    if (t.kind !== kind || t.occurredAt < from) continue;
    map.set(t.currency, (map.get(t.currency) ?? 0) + t.amountCents);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** 分组头右侧的当日汇总：只有支出就写「支出 ¥86.00」，有收入再拼一段。 */
function daySummaryText(summary: { expenseLines: string[]; incomeLines: string[] }): string {
  const parts: string[] = [];
  if (summary.expenseLines.length > 0) parts.push(`支出 ${summary.expenseLines.join(' · ')}`);
  if (summary.incomeLines.length > 0) parts.push(`收入 ${summary.incomeLines.join(' · ')}`);
  return parts.join(' · ');
}

export default function Index() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, loaded: accountsLoaded, load: loadAccounts } = useAccountsStore();
  const { transactions, loaded: ledgerLoaded, load: loadLedger } = useLedgerStore();
  const { categories, load: loadCategories } = useCategoriesStore();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const numberRoll = useSettingsStore((s) => s.numberRoll);
  const toggles = useSettingsStore((s) => s.displayToggles);
  const pageTransition = useSettingsStore((s) => s.pageTransition);
  const monthlyBudgetCents = useSettingsStore((s) => s.monthlyBudgetCents);
  const { done: onboardingDone, checkDone } = useOnboardingStore();
  /** 分组展开状态：没有显式覆盖时，最新一组默认展开（不是「今天」——今天可能还没记账）。 */
  const [dayOverrides, setDayOverrides] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollViewInstance>(null);
  /** 每条流水整行，共享元素形变要从「行本身」的矩形开始撑开。 */
  const rowRefs = useRef<Record<number, ViewInstance | null>>({});
  /** 主卡上手指按下的起点，用来区分「点一下」和「拖动」。 */
  const gridTouchStart = useRef({ x: 0, y: 0, at: 0 });
  /**
   * 点到主卡里的子控件（月份选择器）时置位，让主卡的触摸处理整轮跳过。
   * 子控件的 onTouchStart 先于父级冒泡触发，所以能抢在前面把这一轮屏蔽掉。
   */
  const gridSuppress = useRef(false);

  /**
   * 主卡弹性线网的三份状态。放在页面层是因为主卡上压着月份选择器这类子按钮，
   * 触摸事件由主卡容器统一收，线网那层只负责画（pointerEvents="none"）。
   * 只有这三份要跨到 UI 线程（Skia worklet 每帧读），所以用 shared value。
   */
  const gridPointer = useSharedValue({ x: -9999, y: -9999, in: 0 });
  const gridRipples = useSharedValue<{ x: number; y: number; t0: number }[]>([]);
  const gridActive = useSharedValue(1);

  /**
   * 主卡可见性判断只在 JS 侧做（结果写进 gridActive），所以范围值和视口高用普通 ref，
   * 不必付 shared value 的跨线程代价。
   */
  const heroRange = useRef({ top: 0, bottom: 0 });
  const viewportH = useRef(0);

  /**
   * 滚动位置用普通 onScroll 算。原来走 useAnimatedScrollHandler + useAnimatedReaction，
   * 但那条 worklet 在 release 包里抛 `TypeError: Object is not a function`（_handleScroll），
   * 一滚就整进程死。改成 JS 侧算完直接写 gridActive，不碰 worklet 分发。
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const { top, bottom } = heroRange.current;
    const vh = viewportH.current;
    gridActive.value = bottom <= top || vh <= 0 ? 1 : bottom > y && top < y + vh ? 1 : 0;
  };

  useEffect(() => {
    hydrate();
    void checkDone();
    void loadAccounts();
    void loadLedger();
    void loadCategories();
  }, [hydrate, checkDone, loadAccounts, loadLedger, loadCategories]);

  useEffect(() => {
    if (onboardingDone === false) {
      router.replace('/onboarding');
    }
  }, [onboardingDone, router]);

  const now = new Date();
  const todayKey = keyOf(now);
  const yesterdayKey = keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  /** 总余额按币种分列（验收 17）：主行是排序后第一种币种（CNY 最前）。 */
  const balanceByCurrency = useMemo(() => {
    const map = totalBalanceByCurrencyCents(
      accounts.filter((a) => a.enabled),
      transactions,
    );
    const entries = Object.entries(map).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return entries.length > 0 ? entries : [[DEFAULT_CURRENCY, 0] as [string, number]];
  }, [accounts, transactions]);

  const monthExpenseByCurrency = useMemo(
    () => sumByCurrency(transactions, 'expense', monthStart),
    [transactions, monthStart],
  );
  const monthIncomeByCurrency = useMemo(
    () => sumByCurrency(transactions, 'income', monthStart),
    [transactions, monthStart],
  );
  const groups = useMemo(() => groupByDay(transactions), [transactions]);

  /** 曲线只画主币种，多币种混画没有可比性。 */
  const primaryCurrency = balanceByCurrency[0][0];
  const sparkPoints = useMemo(
    () => dailyExpenseSeries(transactions, SPARK_DAYS, new Date(), primaryCurrency),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, primaryCurrency, todayKey],
  );
  const sparkSeries = useMemo(() => sparkPoints.map((p) => p.cents), [sparkPoints]);
  const sparkPeak = useMemo(() => peakDailyCents(sparkPoints), [sparkPoints]);

  /**
   * 本月支出相对上月的趋势。设计稿里「本月支出」左边画的是一个固定的绿色 ▼，
   * 但固定箭头在真实账本里会撒谎（花得更多了也显示 ▼、上月一笔没记也显示 ▼），所以：
   * 比上月少 → 绿 ▼，比上月多 → 红 ▲，上月没数据/持平 → 透明占位（箭头位置留着，文字不位移）。
   */
  const spendTrend = useMemo<'down' | 'up' | 'none'>(() => {
    const anchor = new Date();
    const curStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime() / 1000;
    const prevStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1).getTime() / 1000;
    let cur = 0;
    let prev = 0;
    for (const t of transactions) {
      if (t.kind !== 'expense' || t.currency !== primaryCurrency) continue;
      if (t.occurredAt >= curStart) cur += t.amountCents;
      else if (t.occurredAt >= prevStart) prev += t.amountCents;
    }
    if (prev <= 0 || cur <= 0 || cur === prev) return 'none';
    return cur < prev ? 'down' : 'up';
  }, [transactions, primaryCurrency]);

  /**
   * 本月支出三彩卡：按「大类」聚合（流水可能记在小类上，要上卷到父类），
   * 有支出的大类按金额降序优先，不足三张用 sortOrder 靠前的大类补满——
   * 设计稿永远是三块并排，缺位补空块比少一块更好看，也不会随月度数据跳来跳去。
   */
  const topCategories = useMemo(() => {
    const topLevel = categories
      .filter((c) => c.kind === 'expense' && c.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (topLevel.length === 0) return [];

    /** 小类 id → 所属大类的 id。 */
    const rootOf = (id: number): number => {
      const c = categoryById.get(id);
      if (!c) return id;
      return c.parentId === null ? c.id : c.parentId;
    };

    const sums = new Map<number, number>();
    for (const t of transactions) {
      if (t.kind !== 'expense' || t.occurredAt < monthStart) continue;
      if (t.currency !== primaryCurrency || t.categoryId === null) continue;
      const root = rootOf(t.categoryId);
      sums.set(root, (sums.get(root) ?? 0) + t.amountCents);
    }

    const spent = topLevel
      .filter((c) => (sums.get(c.id) ?? 0) > 0)
      .sort((a, b) => (sums.get(b.id) ?? 0) - (sums.get(a.id) ?? 0));
    const rest = topLevel.filter((c) => (sums.get(c.id) ?? 0) === 0);

    return [...spent, ...rest]
      .slice(0, 3)
      .map((c) => ({ id: c.id, cents: sums.get(c.id) ?? 0, category: c }));
  }, [transactions, monthStart, primaryCurrency, categoryById, categories]);

  /** 预算只记 CNY，进度只看 CNY 支出（决策 36）。 */
  const cnyMonthExpense = monthExpenseByCurrency.find(([c]) => c === DEFAULT_CURRENCY)?.[1] ?? 0;
  const budgetLeft = monthlyBudgetCents - cnyMonthExpense;
  const budgetPercent =
    monthlyBudgetCents > 0 ? Math.min(100, (cnyMonthExpense / monthlyBudgetCents) * 100) : 0;
  const overBudget = monthlyBudgetCents > 0 && budgetLeft < 0;

  const toggleDay = (key: string, current: boolean) => {
    setDayOverrides((prev) => ({ ...prev, [key]: !current }));
  };

  const ready = accountsLoaded && ledgerLoaded && onboardingDone !== null;
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? '';

  const joinAmounts = (rows: [string, number][]) =>
    rows.length > 0
      ? rows.map(([c, m]) => formatCurrencyAmount(m, c)).join(' · ')
      : formatCurrencyAmount(0, DEFAULT_CURRENCY);

  return (
    <Aurora>
            <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
      >
        <PageHead
          kicker="账本 · 本月"
          title="概览"
          action={
            <PressScale pressedScale={0.9}
              style={[styles.roundBtn, theme.card]}
              accessibilityLabel="搜索"
              hitSlop={8}
              onPress={() => router.push('/search')}
            >
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Circle cx={10.5} cy={10.5} r={6.6} stroke={theme.accent} strokeWidth={2} />
                <Path
                  d="M15.6 15.6 L20.3 20.3"
                  stroke={theme.accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </PressScale>
          }
        />

        {/* 主卡：深绿实色 + 3D 倾斜光影 + 弹性线网 */}
        <TiltPanel
          style={styles.hero}
          cardStyle={[styles.heroSurface, theme.heroCard]}
          /* 白高光在深绿卡上最明显；用 0.17 避免过曝成一片白 */
            onLayout={(e) => {
            // 记下主卡在内容流里的纵向区间，供离屏停帧判断用。
            const { y, height } = e.nativeEvent.layout;
            heroRange.current = { top: y, bottom: y + height };
          }}
          onTouchStart={(e) => {
            // 子控件（月份选择器）先收到事件并置位，这里就别再驱动线网——
            // 否则点一次月份下拉，背后的格子会毫无道理地弹一下。
            if (gridSuppress.current) return;
            const { locationX, locationY } = e.nativeEvent;
            gridTouchStart.current = { x: locationX, y: locationY, at: Date.now() };
            gridPointer.value = { x: locationX, y: locationY, in: 1 };
          }}
          onTouchMove={(e) => {
            if (gridSuppress.current) return;
            const { locationX, locationY } = e.nativeEvent;
            gridPointer.value = { x: locationX, y: locationY, in: 1 };
          }}
          onTouchEnd={(e) => {
            if (gridSuppress.current) {
              gridSuppress.current = false;
              return;
            }
            const { locationX, locationY } = e.nativeEvent;
            const s = gridTouchStart.current;
            // 只有「点一下」才放冲击波；拖动和长按不放，否则滚动时满卡炸波纹。
            if (Math.hypot(locationX - s.x, locationY - s.y) < 8 && Date.now() - s.at < 300) {
              /* t0 传 -1：时间戳由 ElasticGrid 用同一帧时钟打（见 elasticGrid.tsx 的说明），
                 父组件这边的 Date.now() 与 rAF 时间不同源，混用会让涟漪永不生效。 */
              gridRipples.value = [
                ...gridRipples.value,
                { x: locationX, y: locationY, t0: -1 },
              ];
            }
            gridPointer.value = { x: -9999, y: -9999, in: 0 };
          }}
          onTouchCancel={() => {
            gridSuppress.current = false;
            gridPointer.value = { x: -9999, y: -9999, in: 0 };
          }}
        >
          {/* 线网浮在最底层、只画不拦；主卡内容随后铺在上面。 */}
          <View style={elasticGridStyle} pointerEvents="none">
            <ElasticGrid
              pointer={gridPointer}
              ripples={gridRipples}
              active={gridActive}
              color={theme.heroGrid}
            />
          </View>
          <TiltLayer depth={0.45}>
          <View style={styles.heroTop}>
            {/* 月份选择器：设计稿在主卡顶部第一行，右侧是预算徽章。 */}
            <Pressable
              style={styles.monthPick}
              accessibilityLabel="按月份查看"
              hitSlop={6}
              onTouchStart={() => {
                gridSuppress.current = true;
              }}
              onPress={() => router.push('/stats')}
            >
              <Text style={[styles.monthPickText, { color: theme.heroMuted }]}>
                {now.getMonth() + 1}月 {now.getFullYear()}
              </Text>
              <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                <Path
                  d="M2.6 4.6 L6 8 L9.4 4.6"
                  stroke={theme.heroMuted}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            {monthlyBudgetCents > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: overBudget ? 'rgba(232,161,143,0.28)' : 'rgba(204,216,188,0.34)',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: overBudget ? '#F4D7CF' : '#E7F0DE' }]}>
                  {overBudget ? '已超支' : '预算内'}
                </Text>
              </View>
            )}
          </View>
          </TiltLayer>

          {/* 数字区浮得最高：按压时大数字与卡面之间要拉出距离，这是「内容在实体上面」的核心。 */}
          <TiltLayer depth={0.85}>
            <Text style={[styles.heroLabel, { color: theme.heroMuted }]}>总余额</Text>

            <NumberRollText
              value={formatCurrencyAmount(balanceByCurrency[0][1], balanceByCurrency[0][0])}
              mode={numberRoll}
              style={[styles.heroNum, { color: theme.heroText }]}
            />
            {balanceByCurrency.slice(1).map(([code, minor]) => (
              <Text key={code} style={[styles.heroExtra, { color: theme.heroMuted }]}>
                {formatCurrencyAmount(minor, code)}
              </Text>
            ))}
          </TiltLayer>

          {monthlyBudgetCents > 0 && (
            <TiltLayer depth={0.7}>
              <View style={[styles.heroTrack, { backgroundColor: theme.heroTrack }]}>
                <View
                  style={[
                    styles.heroFill,
                    { width: `${Math.max(2, budgetPercent)}%`, backgroundImage: theme.heroFill },
                  ]}
                />
              </View>
              <View style={styles.heroDual}>
                <Text style={[styles.heroLeft, { color: theme.heroText }]} numberOfLines={1}>
                  {overBudget ? '超 ' : '剩 '}
                  {formatCurrencyAmount(Math.abs(budgetLeft), DEFAULT_CURRENCY)}
                </Text>
                <Text style={[styles.heroRight, { color: theme.heroMuted }]} numberOfLines={1}>
                  of {formatCurrencyAmount(monthlyBudgetCents, DEFAULT_CURRENCY)} 月预算
                </Text>
              </View>
            </TiltLayer>
          )}

          <View style={[styles.heroRule, { backgroundColor: theme.heroLine }]} />

          <TiltLayer depth={0.3}>
          <View style={styles.heroFoot}>
            {/* 设计稿的 mini 行是「标签 + 金额」同一行内联（.mini flex + gap 9px），不是上下两行。 */}
            <View style={styles.heroMetrics}>
              <View style={styles.heroMetric}>
                {/*
                  原型 `.arrow`：CSS 三角，7px 半宽 + 10px 高 → 3.8×5.4dp。
                  设计稿画的是固定绿 ▼，但固定箭头在真实账本里会撒谎（花更多了也显示 ▼、
                  上月一笔没记也显示 ▼），所以：比上月少 → 绿 ▼、比上月多 → 红 ▲、
                  无从比较 → 透明占位（位置留着，后面的文字不位移，也不假报趋势）。
                */}
                <View
                  style={
                    spendTrend === 'up'
                      ? [styles.trendArrow, styles.trendArrowUp, { borderBottomColor: TREND_UP_COLOR }]
                      : [
                          styles.trendArrow,
                          styles.trendArrowDown,
                          {
                            borderTopColor:
                              spendTrend === 'down' ? TREND_DOWN_COLOR : 'transparent',
                          },
                        ]
                  }
                />
                <Text style={[styles.heroMetricLabel, { color: theme.heroMuted }]}>本月支出</Text>
                <Text style={[styles.heroMetricValue, { color: theme.heroText }]} numberOfLines={1}>
                  {joinAmounts(monthExpenseByCurrency)}
                </Text>
              </View>
              <View style={styles.heroMetric}>
                <Text style={[styles.heroMetricLabel, { color: theme.heroMuted }]}>本月收入</Text>
                <Text style={[styles.heroMetricValue, { color: theme.heroText }]} numberOfLines={1}>
                  {joinAmounts(monthIncomeByCurrency)}
                </Text>
              </View>
            </View>

            <View style={styles.sparkBox}>
              <Sparkline
                series={sparkSeries}
                width={SPARK_WIDTH}
                height={SPARK_HEIGHT}
                color={theme.heroText}
              />
              <View style={styles.sparkCap}>
                <Text style={[styles.sparkCapText, { color: theme.heroMuted }]}>近 30 天</Text>
                {/* 原型 `.sparkCap b`：峰值数字加粗且用更深的墨色，不是和「近 30 天」同一灰。 */}
                <Text style={[styles.sparkCapText, { color: theme.heroMuted }]}>
                  峰值{' '}
                  <Text style={[styles.sparkCapStrong, { color: theme.heroText }]}>
                    {formatCurrencyAmount(sparkPeak, primaryCurrency)}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
          </TiltLayer>
        </TiltPanel>

        {/* 分类三彩卡：固定三块并排，金额为 0 的大类也占位。 */}
        {topCategories.length > 0 && (
          <>
            <View style={styles.triRow}>
              {topCategories.map((item, i) => {
                const ink = theme.tintInk[i % theme.tintInk.length];
                const inkStrong = theme.tintInkStrong[i % theme.tintInkStrong.length];
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.triCard, { backgroundColor: theme.tint[i % theme.tint.length] }]}
                    onPress={() => router.push('/stats')}
                  >
                    <View style={styles.triIcon}>
                      {/* 原型 `.catIcon` 盒 36px（19.5dp）内 svg 29px → 15.7dp。 */}
                      <CategoryIcon icon={item.category?.icon ?? ''} size={15.7} color={ink} />
                    </View>
                    <Text style={[styles.triName, { color: ink }]} numberOfLines={1}>
                      {item.category?.name ?? '未分类'}
                    </Text>
                    <Text style={[styles.triValue, { color: inkStrong }]} numberOfLines={1}>
                      {formatCurrencyAmount(item.cents, primaryCurrency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* 流水 */}
        {!ready ? (
          <Text style={[styles.hint, { color: theme.muted }]}>加载中…</Text>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有账</Text>
            <Text style={[styles.emptyHint, { color: theme.faint }]}>
              点下面中间的 + 记第一笔。
            </Text>
          </View>
        ) : (
          <>
            {groups.map((g, groupIndex) => {
            /* 设计稿：所有分组默认展开，点日期头可逐组收起（收起状态记在 dayOverrides）。 */
            const expanded = dayOverrides[g.dayKey] ?? true;
            const summary = summarizeDayItems(g.items);
            return (
              <CollapsibleDay
                key={g.dayKey}
                title={dayLabel(g.dayKey, todayKey, yesterdayKey)}
                summaryText={daySummaryText(summary)}
                expanded={expanded}
                /* 设计稿只让最新一组日期头用暖棕强调色，其余走灰。 */
                highlighted={groupIndex === 0}
                onToggle={() => toggleDay(g.dayKey, expanded)}
                theme={theme}
              >
                {expanded &&
                  g.items.map((t) => {
                    const isTransfer = t.kind === 'transfer';
                    const cat = t.categoryId !== null ? categoryById.get(t.categoryId) : undefined;
                    const categoryText = cat?.name ?? '';
                    const fallbackMain = isTransfer
                      ? '转账'
                      : categoryText !== ''
                        ? categoryText
                        : '未分类';
                    const mainText = toggles.note && t.note !== '' ? t.note : fallbackMain;
                    const subtitleParts: string[] = [];
                    if (toggles.account) subtitleParts.push(accountName(t.accountId));
                    if (toggles.category && cat && mainText !== categoryText) {
                      subtitleParts.push(categoryText);
                    }
                    const subtitle = subtitleParts.join(' · ');
                    const amountText = `${
                      t.kind === 'expense' ? '-' : '+'
                    }${formatCurrencyAmount(Math.abs(t.amountCents), t.currency)}`;
                    const amountColor =
                      t.kind === 'expense'
                        ? theme.expense
                        : t.kind === 'income'
                          ? theme.income
                          : theme.muted;
                    // 与三彩卡同色：图标块取该流水所属「大类」在三彩卡里的槽位，
                    // 不在前三就按大类 id 轮转，保证同类永远同色、跨页一致。
                    const rootId = cat ? (cat.parentId ?? cat.id) : (t.categoryId ?? 0);
                    const triSlot = topCategories.findIndex(c => c.id === rootId);
                    const tintIndex = triSlot >= 0 ? triSlot : rootId % theme.tint.length;
                    return (
                      <View
                        key={t.id}
                        ref={(node) => {
                          rowRefs.current[t.id] = node;
                        }}
                        collapsable={false}
                      >
                      <Pressable
                        style={[styles.row, { borderBottomColor: theme.line }]}
                        onPress={() => {
                          // 「共享元素」档：让被点的这一行自己撑开成详情卡（同一块面形变），
                          // 其余两档（左右滑动 / 上滑）整页在动，直接 push 才是对的。
                          if (pageTransition !== 'shared') {
                            router.push(`/transaction/${t.id}` as never);
                            return;
                          }
                          const node = rowRefs.current[t.id];
                          if (!node) {
                            router.push(`/transaction/${t.id}` as never);
                            return;
                          }
                          const icon = isTransfer ? 'transfer' : cat?.icon ?? '';
                          node.measureInWindow((x, y, width, height) => {
                            if (width <= 0 || height <= 0) {
                              router.push(`/transaction/${t.id}` as never);
                              return;
                            }
                            openMorph({
                              from: { x, y, width, height },
                              icon,
                              tint: theme.tint[tintIndex],
                              ink: theme.tintInk[tintIndex],
                              rowTitle: mainText,
                              amountText,
                              amountColor,
                              kindLabel:
                                t.kind === 'expense'
                                  ? '支 出'
                                  : t.kind === 'income'
                                    ? '收 入'
                                    : '转 账',
                              lines: [
                                { key: '日期', value: dayLabel(g.dayKey, todayKey, yesterdayKey) },
                                { key: '账户', value: accountName(t.accountId) },
                                ...(cat ? [{ key: '分类', value: cat.name }] : []),
                                { key: '币种', value: t.currency },
                                ...(t.note !== '' ? [{ key: '备注', value: t.note }] : []),
                              ],
                              onOpen: () => router.push(`/transaction/${t.id}` as never),
                            });
                          });
                        }}
                      >
                        <View style={[styles.rowIcon, { backgroundColor: theme.tint[tintIndex] }]}>
                          <CategoryIcon
                            icon={isTransfer ? 'transfer' : cat?.icon ?? ''}
                            size={14}
                            color={theme.tintInk[tintIndex]}
                          />
                        </View>
                        <View style={styles.rowTexts}>
                          <Text style={[styles.rowNote, { color: theme.text }]} numberOfLines={1}>
                            {mainText}
                          </Text>
                          {subtitle !== '' && (
                            <Text
                              style={[styles.rowMeta, { color: theme.faint }]}
                              numberOfLines={1}
                            >
                              {subtitle}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.rowAmount, { color: amountColor }]}>{amountText}</Text>
                      </Pressable>
                      </View>
                    );
                  })}
              </CollapsibleDay>
            );
            })}
          </>
        )}
      </ScrollView>

      {/* 底部渐隐，让流水滑到 dock 后面时自然淡出 */}
      <TopFade top={insets.top} />
      <BottomFade bottom={insets.bottom + 68} />

      <BottomDock
        active="overview"
        bottomInset={insets.bottom}
        onOverviewPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />

      {/* 共享元素形变层：必须压在 dock 之上，否则卡片撑开时会被 dock 挡住底部。 */}
      <MorphDetailHost topInset={insets.top} />
    </Aurora>
  );
}

function CollapsibleDay({
  title,
  summaryText,
  expanded,
  highlighted,
  onToggle,
  children,
  theme,
}: {
  title: string;
  summaryText: string;
  expanded: boolean;
  /** 最新一组用暖棕强调色，更早的分组走灰。 */
  highlighted: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: ThemeColors;
}) {
  return (
    <View style={styles.dayGroup}>
      <Pressable style={styles.dayHeader} onPress={onToggle}>
        <Text style={[styles.dayTitle, { color: highlighted ? theme.accent : theme.faint }]}>
          {title}
        </Text>
        <Text style={[styles.daySummary, { color: theme.faint }]}>{summaryText}</Text>
      </Pressable>
      {/* 折叠用 layout 过渡 + 进出场动画，避免手测高度在首帧为 0 时把内容压没。 */}
      <Animated.View layout={LinearTransition.duration(220)}>
        {expanded && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
            {children}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 150 },

  roundBtn: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 主卡（数值取原型 CSS px × 0.5414 = 411dp 屏的 dp）
  hero: {
    marginTop: 14,
  },
  heroSurface: {
    paddingTop: 15,
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthPick: { flexDirection: 'row', alignItems: 'center', gap: 3.8 },
  monthPickText: { fontSize: 10.3, fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 12.4,
  },
  heroLabel: { fontSize: 8.7, letterSpacing: 1, fontWeight: '700', marginTop: 13.7,
    includeFontPadding: false,
    lineHeight: 11.0,
  },
  badge: { paddingHorizontal: 10.8, paddingVertical: 4.9, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 8.7, fontWeight: '800', letterSpacing: 0.3,
    includeFontPadding: false,
    lineHeight: 12.0,
  },
  heroNum: {
    fontSize: 30.3,
    fontWeight: '800',
    letterSpacing: -0.87,
    marginTop: 2.7,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 37.5,
  },
  heroExtra: { fontSize: 10, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  heroTrack: { height: 6.5, borderRadius: 3.2, marginTop: 11.9, overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 3.2 },
  heroDual: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 7.6,
    gap: 8,
  },
  heroLeft: { fontSize: 10.8, fontWeight: '800', fontVariant: ['tabular-nums'], flexShrink: 0,
    includeFontPadding: false,
    lineHeight: 13.0,
  },
  heroRight: { fontSize: 9.2, fontVariant: ['tabular-nums'], flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 11.0,
  },
  heroRule: { height: 1, marginTop: 11.3, marginBottom: 8.7 },
  heroFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8.7 },
  heroMetrics: { flexShrink: 0, gap: 8.7 },
  /** 设计稿 `.mini` 是「标签 + 金额」同一行内联。 */
  heroMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 4.9 },
  heroMetricLabel: { fontSize: 9.7, fontWeight: '500', lineHeight: 11.4,
    includeFontPadding: false,
  },
  heroMetricValue: {
    fontSize: 10.3,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 12.4,
  },
  sparkBox: { marginLeft: 'auto', alignItems: 'flex-end' },
  sparkCap: { flexDirection: 'row', alignItems: 'baseline', gap: 2.7, marginTop: 2.7 },
  sparkCapText: { fontSize: 6.5, letterSpacing: 0.2,
    includeFontPadding: false,
    lineHeight: 8.0,
  },
  /** 原型 `.sparkCap b`：峰值数字单独加粗、用深墨色。 */
  sparkCapStrong: { fontWeight: '800' },

  /** 原型 `.arrow`：7px 半宽 + 10px 高 → 3.8×5.4dp 的实心三角。 */
  trendArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.8,
    borderRightWidth: 3.8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginRight: 1.1,
    // heroMetric 是 baseline 对齐，三角要自己居中，否则会贴到文字下沿。
    alignSelf: 'center',
  },
  trendArrowDown: { borderTopWidth: 5.4 },
  trendArrowUp: { borderBottomWidth: 5.4 },

  // 分类三彩卡
  triRow: { flexDirection: 'row', gap: 7.6, marginTop: 33 },
  triCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: RADIUS.tri,
    paddingTop: 10.3,
    paddingBottom: 11.4,
    paddingHorizontal: 9.2,
  },
  triIcon: { height: 19.5, justifyContent: 'center' },
  triName: { fontSize: 8.7, fontWeight: '600', marginTop: 8.7, letterSpacing: 0.2,
    includeFontPadding: false,
    lineHeight: 10.4,
  },
  triValue: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 1.6,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 16.6,
  },

  // 流水
  dayGroup: { marginTop: 13 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 1.6,
    marginBottom: 3.2,
  },
  dayTitle: { fontWeight: '800', fontSize: 9.7, letterSpacing: 0.43,
    includeFontPadding: false,
    lineHeight: 12.0,
  },
  daySummary: { fontSize: 8.1, fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 10.0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9.7,
    paddingHorizontal: 1.6,
    paddingVertical: 8.1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 30.3,
    height: 30.3,
    borderRadius: 10.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: { flex: 1, minWidth: 0 },
  rowNote: { fontSize: 10.8, fontWeight: '700', lineHeight: 14,
    includeFontPadding: false,
  },
  rowMeta: { fontSize: 8.1, marginTop: 1.6, lineHeight: 10,
    includeFontPadding: false,
  },
  rowAmount: {
    fontSize: 10.8,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    paddingLeft: 6,
    includeFontPadding: false,
    lineHeight: 13.0,
  },

  empty: { marginTop: 56, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 12 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 32 },
});
