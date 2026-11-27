/**
 * 搜索与筛选页（决策 37 · 方案 B 定稿）：按备注搜 + 类型/账户/分类/金额区间/日期区间筛选。
 * 结果复用首页的流水行样式（分隔线式裸行、彩色图标底）；点行进详情页。
 * 视觉：返回钮 + 「账本 · 查找」面包屑 + 大标题「搜索」；搜索框与筛选 chip 都是白卡语义。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { filterTransactions, type FilterCriteria } from '../src/core/ledger/filter';
import { formatCurrencyAmount } from '../src/core/currency';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import { Aurora } from '../src/ui/aurora';
import { CategoryIcon } from '../src/ui/categoryIcon';
import { RADIUS, useTheme } from '../src/ui/theme';
import { TopFade } from '../src/ui/topFade';
import { PressScale } from '../src/ui/pressScale';

type KindFilter = 'all' | 'expense' | 'income' | 'transfer';

const KIND_CHIPS: KindFilter[] = ['all', 'expense', 'income', 'transfer'];
const KIND_LABELS: Record<KindFilter, string> = {
  all: '全部',
  expense: '支出',
  income: '收入',
  transfer: '转账',
};

export default function Search() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { transactions, load: loadLedger } = useLedgerStore();
  const { accounts, load: loadAccounts } = useAccountsStore();
  const { categories, load: loadCategories } = useCategoriesStore();

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');

  useEffect(() => {
    void loadLedger();
    void loadAccounts();
    void loadCategories();
  }, [loadLedger, loadAccounts, loadCategories]);

  const enabledAccounts = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const criteria: FilterCriteria = useMemo(() => {
    const min = minText.trim() === '' ? undefined : Math.round(Number(minText.trim()) * 100);
    const max = maxText.trim() === '' ? undefined : Math.round(Number(maxText.trim()) * 100);
    return {
      query: query.trim() === '' ? undefined : query,
      kinds: kind === 'all' ? undefined : [kind],
      accountIds: accountId === null ? undefined : [accountId],
      categoryIds: categoryId === null ? undefined : [categoryId],
      minCents: min === undefined || !Number.isFinite(min) ? undefined : min,
      maxCents: max === undefined || !Number.isFinite(max) ? undefined : max,
      fromDay: fromDay.trim() === '' ? undefined : fromDay.trim(),
      toDay: toDay.trim() === '' ? undefined : toDay.trim(),
    };
  }, [query, kind, accountId, categoryId, minText, maxText, fromDay, toDay]);

  const results = useMemo(
    () => filterTransactions(transactions, criteria),
    [transactions, criteria],
  );

  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? '';

  const clearAll = () => {
    setQuery('');
    setKind('all');
    setAccountId(null);
    setCategoryId(null);
    setMinText('');
    setMaxText('');
    setFromDay('');
    setToDay('');
  };

  /** 筛选 chip：选中态琥珀渐变，未选中浅灰面。 */
  const chip = (label: string, active: boolean, onPress: () => void) => (
    <PressScale
      key={label}
      style={[
        styles.chip,
        active
          ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
          : { backgroundColor: theme.cardAlt.backgroundColor },
      ]}
      pressedScale={0.94}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? theme.onAmber : theme.muted },
          active && styles.chipTextOn,
        ]}
      >
        {label}
      </Text>
    </PressScale>
  );

  return (
    <Aurora>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navRow}>
          <PressScale pressedScale={0.94}
            style={[styles.back, theme.card]}
            hitSlop={8}
            accessibilityLabel="返回"
            onPress={() => router.back()}
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.5 5.5 8 12l6.5 6.5"
                stroke={theme.accent}
                strokeWidth={2.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </PressScale>
          <Text style={[styles.navKicker, { color: theme.ghost }]}>账本 · 查找</Text>
        </View>

        <View style={styles.headRow}>
          <Text style={[styles.headTitle, { color: theme.text }]}>搜索</Text>
        </View>

        <View style={[styles.searchBox, theme.card]}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={6.5} stroke={theme.ghost} strokeWidth={2} />
            <Path
              d="M16 16 L20.5 20.5"
              stroke={theme.ghost}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="搜备注…"
            placeholderTextColor={theme.ghost}
            returnKeyType="search"
          />
        </View>

        <Text style={[styles.section, { color: theme.sectionLabel }]}>类型</Text>
        <View style={styles.chips}>
          {KIND_CHIPS.map((k) => chip(KIND_LABELS[k], kind === k, () => setKind(k)))}
        </View>

        <Text style={[styles.section, { color: theme.sectionLabel }]}>账户</Text>
        <View style={styles.chips}>
          {enabledAccounts.map((a) =>
            chip(a.name, accountId === a.id, () =>
              setAccountId(accountId === a.id ? null : a.id),
            ),
          )}
        </View>

        <Text style={[styles.section, { color: theme.sectionLabel }]}>分类</Text>
        <View style={styles.chips}>
          {categories.map((c) =>
            chip(c.name, categoryId === c.id, () =>
              setCategoryId(categoryId === c.id ? null : c.id),
            ),
          )}
        </View>

        <Text style={[styles.section, { color: theme.sectionLabel }]}>金额区间（元）</Text>
        <View style={styles.rangeRow}>
          <TextInput
            style={[
              styles.rangeInput,
              theme.card,
              { color: theme.text },
            ]}
            value={minText}
            onChangeText={setMinText}
            placeholder="最小"
            placeholderTextColor={theme.ghost}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.rangeDash, { color: theme.ghost }]}>—</Text>
          <TextInput
            style={[styles.rangeInput, theme.card, { color: theme.text }]}
            value={maxText}
            onChangeText={setMaxText}
            placeholder="最大"
            placeholderTextColor={theme.ghost}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={[styles.section, { color: theme.sectionLabel }]}>日期区间（YYYY-MM-DD）</Text>
        <View style={styles.rangeRow}>
          <TextInput
            style={[styles.rangeInput, theme.card, { color: theme.text }]}
            value={fromDay}
            onChangeText={setFromDay}
            placeholder="起始日期"
            placeholderTextColor={theme.ghost}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.rangeDash, { color: theme.ghost }]}>—</Text>
          <TextInput
            style={[styles.rangeInput, theme.card, { color: theme.text }]}
            value={toDay}
            onChangeText={setToDay}
            placeholder="结束日期"
            placeholderTextColor={theme.ghost}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <PressScale pressedScale={0.94}
          style={[styles.clearButton, { borderColor: 'rgba(32,60,52,0.24)' }]}
          onPress={clearAll}
        >
          <Text style={[styles.clearText, { color: theme.accent }]}>清空全部条件</Text>
        </PressScale>

        <Text style={[styles.resultHead, { color: theme.text }]}>
          结果 <Text style={{ color: theme.accent }}>{results.length}</Text> 笔
        </Text>

        {results.length === 0 ? (
          <Text style={[styles.hint, { color: theme.faint }]}>没有匹配的流水。</Text>
        ) : (
          results.map((t) => {
            const isTransfer = t.kind === 'transfer';
            const cat = t.categoryId !== null ? categoryById.get(t.categoryId) : undefined;
            const mainText = t.note !== '' ? t.note : isTransfer ? '转账' : cat?.name ?? '未分类';
            const amountText = `${t.kind === 'expense' ? '-' : '+'}${formatCurrencyAmount(
              Math.abs(t.amountCents),
              t.currency,
            )}`;
            const amountColor =
              t.kind === 'expense'
                ? theme.expense
                : t.kind === 'income'
                  ? theme.income
                  : theme.muted;
            const subtitle = [accountName(t.accountId), !isTransfer && cat ? cat.name : '']
              .filter(Boolean)
              .join(' · ');
            const tint = theme.tint[t.id % theme.tint.length];
            return (
              <Pressable
                key={t.id}
                style={[styles.row, { borderBottomColor: theme.line }]}
                onPress={() => router.push(`/transaction/${t.id}` as never)}
              >
                <View style={[styles.rowIcon, { backgroundColor: tint }]}>
                  <CategoryIcon
                    icon={isTransfer ? 'transfer' : cat?.icon || 'more'}
                    size={16}
                    color={theme.accent}
                  />
                </View>
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowNote, { color: theme.text }]} numberOfLines={1}>
                    {mainText}
                  </Text>
                  {subtitle !== '' && (
                    <Text style={[styles.rowMeta, { color: theme.ghost }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  )}
                </View>
                <Text style={[styles.rowAmount, { color: amountColor }]}>{amountText}</Text>
              </Pressable>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      <TopFade top={insets.top} />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 17, paddingBottom: 20 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navKicker: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, letterSpacing: 2.6, fontWeight: '700' },

  headRow: { marginTop: 14, marginBottom: 12 },
  headTitle: { fontSize: 26.0,
    includeFontPadding: false,
    lineHeight: 28.6, fontWeight: '800', letterSpacing: -1.1 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  input: { flex: 1, fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, paddingVertical: 10, fontWeight: '600' },

  section: {
    fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.4,
    letterSpacing: 1.84,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
    paddingLeft: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '700' },
  chipTextOn: { fontWeight: '800' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rangeInput: {
    flex: 1,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12.5,
    includeFontPadding: false,
    lineHeight: 15.2,
    fontWeight: '600',
  },
  rangeDash: { fontSize: 8.1 },

  clearButton: {
    marginTop: 20,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearText: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, fontWeight: '800', letterSpacing: 0.4 },

  resultHead: { fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '800', marginTop: 24, marginBottom: 3 },

  hint: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, marginTop: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowLeft: { flex: 1, minWidth: 0, marginRight: 10 },
  rowNote: { fontSize: 10.8,
    includeFontPadding: false,
    lineHeight: 13.2, fontWeight: '700' },
  rowMeta: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, marginTop: 2 },
  rowAmount: { fontSize: 10.8,
    includeFontPadding: false,
    lineHeight: 13.2, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
