/**
 * 记账页（方案 B 定稿）：底部面板 form——「记一笔」标题 + 关闭钮，
 * 支出/收入/转账三段、大金额、两级分类宫格、账户 chip、日期/备注字段行，保存钉在面板底部。
 *
 * 面板本体是 src/ui/bottomSheet.tsx：把手可拖、三档吸附（0.52 / 0.78 / 0.93）、
 * 拉到顶有多余的橡皮筋与纵向拉伸、往下甩出可关闭。本页只负责表单内容。
 *
 * 视觉对应 mockups/pages-add-goals-settings.html 第 1 屏：
 * 白卡字段行、白底 chip、选中态琥珀渐变、金额 76px + ¥ 34px。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { parseAmountToCents } from '../src/core/money';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, isCurrencyCode, CURRENCY_INFO } from '../src/core/currency';
import { absoluteDayLabel } from '../src/core/ledger/dayLabel';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import type { TransactionKind } from '../src/features/ledger/ledgerStore';
import { useSettingsStore } from '../src/features/settings/settingsStore';
import { BottomSheet } from '../src/ui/bottomSheet';
import { Calendar } from '../src/ui/calendar';
import { CategoryPicker } from '../src/ui/categoryPicker';
import { PressScale } from '../src/ui/pressScale';
import { RecordSuccessEffect } from '../src/ui/recordSuccessEffect';
import { RADIUS, useTheme } from '../src/ui/theme';

const KINDS = [
  ['expense', '支出'],
  ['income', '收入'],
  ['transfer', '转账'],
] as const;

export default function Add() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, loaded: accountsLoaded, load: loadAccounts } = useAccountsStore();
  const { categories, loaded: categoriesLoaded, load: loadCategories } = useCategoriesStore();
  const { add, addTransfer } = useLedgerStore();
  const recordSuccessAnimation = useSettingsStore((s) => s.recordSuccessAnimation);
  const lastAccountId = useSettingsStore((s) => s.lastAccountId);
  const setLastAccountId = useSettingsStore((s) => s.setLastAccountId);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [occurredAt, setOccurredAt] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!accountsLoaded) void loadAccounts();
    if (!categoriesLoaded) void loadCategories();
  }, [accountsLoaded, categoriesLoaded, loadAccounts, loadCategories]);

  useEffect(() => {
    if (!accountsLoaded || accounts.length === 0) return;
    if (accountId !== null) return;
    const remembered = accounts.find((a) => a.enabled && a.id === lastAccountId);
    const fallback = accounts.find((a) => a.enabled);
    setAccountId(remembered?.id ?? fallback?.id ?? null);
  }, [accounts, accountsLoaded, accountId, lastAccountId]);

  const enabledAccounts = accounts.filter((a) => a.enabled);
  const kindCategories = useMemo(
    () => (kind === 'transfer' ? [] : categories.filter((c) => c.kind === kind)),
    [categories, kind],
  );

  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  })();

  const calendarDate = new Date(occurredAt * 1000);
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth() + 1;
  /** 原型写「11月17日 周一」：记账时日期是「这笔账算哪天」，用相对词会说不清。 */
  const dayText = absoluteDayLabel(occurredAt);

  const save = async () => {
    if (saving || playing) return;
    setError('');
    const cents = parseAmountToCents(amountText);
    if (cents === null || cents <= 0) {
      setError('金额不对，只填数字（如 12.5）。');
      return;
    }
    if (accountId === null) {
      setError('先选账户。');
      return;
    }
    if (kind !== 'transfer' && categoryId === null) {
      setError('先选分类。');
      return;
    }
    if (!isCurrencyCode(currency)) {
      setError('币种不对。');
      return;
    }
    setSaving(true);
    try {
      if (kind === 'transfer') {
        if (toAccountId === null || toAccountId === accountId) {
          setError('转账要选两个不同账户。');
          setSaving(false);
          return;
        }
        await addTransfer({
          amountCents: cents,
          currency,
          fromAccountId: accountId,
          toAccountId,
          occurredAt,
          note: note.trim(),
        });
      } else {
        await add({
          kind,
          amountCents: cents,
          currency,
          categoryId,
          accountId,
          relatedId: null,
          occurredAt,
          note: note.trim(),
        });
      }
      setLastAccountId(accountId);
      setSaving(false);
      setPlaying(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败');
      setSaving(false);
    }
  };

  const finishAfterEffect = () => {
    setPlaying(false);
    router.back();
  };

  return (
    <BottomSheet
      detentHeights={[0.52, 0.78, 0.93]}
      initialDetent={2}
      onClose={() => router.back()}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 4 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <Text style={[styles.title, { color: theme.text }]}>
              {kind === 'transfer' ? '转账' : '记一笔'}
            </Text>
            <PressScale pressedScale={0.9}
              style={[styles.closeBtn, theme.card]}
              hitSlop={8}
              accessibilityLabel="关闭"
              onPress={() => router.back()}
            >
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M3 3 L13 13 M13 3 L3 13"
                  stroke={theme.faint}
                  strokeWidth={2.1}
                  strokeLinecap="round"
                />
              </Svg>
            </PressScale>
          </View>

          <View style={[styles.segment, { backgroundColor: theme.cardAlt.backgroundColor }]}>
            {KINDS.map(([k, label]) => (
              <PressScale
                key={k}
                style={[
                  styles.segItem,
                  kind === k && {
                    backgroundImage: theme.amberGradient,
                    backgroundColor: theme.amber,
                  },
                ]}
                pressedScale={0.95}
                onPress={() => {
                  setKind(k);
                  setCategoryId(null);
                  setError('');
                }}
              >
                <Text
                  style={[styles.segText, { color: kind === k ? theme.onAmber : theme.faint }]}
                >
                  {label}
                </Text>
              </PressScale>
            ))}
          </View>

          {/* Pocket 参考：金额上方居中的小标「Amount」。 */}
          <Text style={[styles.amountLabel, { color: theme.faint }]}>金额</Text>
          <View style={styles.amountBox}>
            <Text style={[styles.currency, { color: theme.accent }]}>¥</Text>
            <TextInput
              style={[styles.amt, { color: theme.text }]}
              value={amountText}
              onChangeText={(v) => {
                    setAmountText(v);
                    setError('');
                  }}
              placeholder="0.00"
              placeholderTextColor={theme.ghost}
              selectionColor={theme.amber}
              cursorColor={theme.amber}
              keyboardType="decimal-pad"
              autoFocus
              maxLength={10}
            />
          </View>
          <Text style={[styles.amtHint, { color: theme.faint }]}>
            {/* 原型这里是「CNY · 人民币」：金额本身就在上面，回显一遍是废话，说清币种更有用。 */}
            {isCurrencyCode(currency)
              ? `${currency} · ${CURRENCY_INFO[currency].name}`
              : '点数字键输入金额'}
          </Text>

          {kind !== 'transfer' && (
            <View style={styles.pickerWrap}>
              <CategoryPicker
                kind={kind}
                categories={kindCategories}
                selected={categoryId}
                onSelect={(id) => {
                  setCategoryId(id);
                  setError('');
                }}
              />
            </View>
          )}

          {/* 原型里账户 chips 直接跟在宫格下面，不写「账户」二字：点开的用途一看就懂。
              转账才需要 —— 得说清往哪个方向转。 */}
          {kind === 'transfer' && (
            <Text style={[styles.label, { color: theme.faint }]}>转出账户</Text>
          )}
          <View style={[styles.chipRow, kind !== 'transfer' && styles.chipRowLoose]}>
            {enabledAccounts.map((a) => {
              const on = accountId === a.id;
              return (
                <PressScale
                  key={a.id}
                  pressedScale={0.94}
                  style={[
                    styles.chip,
                    theme.card,
                    on && {
                      backgroundImage: theme.amberGradient,
                      backgroundColor: theme.amber,
                      borderColor: 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setAccountId(a.id);
                    setError('');
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: on ? theme.onAmber : theme.muted },
                      on && styles.chipTextOn,
                    ]}
                  >
                    {a.name}
                  </Text>
                </PressScale>
              );
            })}
          </View>

          {kind === 'transfer' && (
            <>
              <Text style={[styles.label, { color: theme.faint }]}>转入账户</Text>
              <View style={styles.chipRow}>
                {enabledAccounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => {
                    const on = toAccountId === a.id;
                    return (
                      <PressScale
                        key={a.id}
                        pressedScale={0.94}
                        style={[
                          styles.chip,
                          theme.card,
                          on && {
                            backgroundImage: theme.amberGradient,
                            backgroundColor: theme.amber,
                            borderColor: 'transparent',
                          },
                        ]}
                        onPress={() => setToAccountId(a.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: on ? theme.onAmber : theme.muted },
                            on && styles.chipTextOn,
                          ]}
                        >
                          {a.name}
                        </Text>
                      </PressScale>
                    );
                  })}
              </View>
            </>
          )}

          <Pressable
            style={[styles.fieldRow, theme.card]}
            onPress={() => setShowCalendar((v) => !v)}
          >
            <Text style={[styles.fieldLbl, { color: theme.faint }]}>日期</Text>
            <Text style={[styles.fieldVal, { color: theme.text }]}>{dayText}</Text>
            {/* 原型这里画的是琥珀色日历图标（22×22），比箭头更能说明点开是选日子。 */}
            <Svg width={11.9} height={11.9} viewBox="0 0 24 24" fill="none">
              <Rect
                x={3.5}
                y={5}
                width={17}
                height={15.5}
                rx={3}
                stroke={theme.accent}
                strokeWidth={1.8}
              />
              <Path
                d="M3.5 9.6h17M8.2 3v4M15.8 3v4"
                stroke={theme.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>

          {showCalendar && (
            <View style={styles.calWrap}>
              <Calendar
                year={calYear}
                month={calMonth}
                selected={occurredAt}
                todayStart={todayStart}
                onSelect={(epoch) => {
                  setOccurredAt(epoch);
                  setShowCalendar(false);
                }}
                onPrevMonth={() => {
                  const prev = new Date(calYear, calMonth - 2, 1);
                  setOccurredAt(prev.getTime() / 1000);
                }}
                onNextMonth={() => {
                  const next = new Date(calYear, calMonth, 1);
                  const nextStart = next.getTime() / 1000;
                  if (nextStart <= todayStart) setOccurredAt(nextStart);
                }}
              />
            </View>
          )}

          <View style={[styles.fieldRow, theme.card]}>
            <Text style={[styles.fieldLbl, { color: theme.faint }]}>备注</Text>
            <TextInput
              style={[styles.fieldVal, { color: theme.text }]}
              value={note}
              onChangeText={setNote}
              placeholder="选填，这笔钱花哪了"
              placeholderTextColor={theme.ghost}
            />
          </View>

          <Text style={[styles.label, { color: theme.faint }]}>币种</Text>
          <View style={styles.chipRow}>
            {SUPPORTED_CURRENCIES.map((c) => {
              const on = currency === c;
              return (
                <PressScale
                  key={c}
                  pressedScale={0.94}
                  style={[
                    styles.chip,
                    styles.chipTiny,
                    theme.card,
                    on && {
                      backgroundImage: theme.amberGradient,
                      backgroundColor: theme.amber,
                      borderColor: 'transparent',
                    },
                  ]}
                  onPress={() => {
                    setCurrency(c);
                    setError('');
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: on ? theme.onAmber : theme.muted },
                      on && styles.chipTextOn,
                    ]}
                  >
                    {c}
                  </Text>
                </PressScale>
              );
            })}
          </View>

          {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}

          <View style={{ height: 96 }} />
        </ScrollView>

        <View style={[styles.saveWrap, { paddingBottom: insets.bottom + 10 }]}>
          <PressScale
            style={[styles.saveBtn, { backgroundImage: theme.amberGradient }]}
            pressedScale={0.97}
            haptic="success"
            onPress={() => void save()}
            disabled={saving}
          >
            <Text style={[styles.saveText, { color: theme.onAmber }]}>
              {saving ? '保存中…' : '保存'}
            </Text>
          </PressScale>
        </View>
      </KeyboardAvoidingView>

      {playing && (
        <RecordSuccessEffect mode={recordSuccessAnimation} onDone={finishAfterEffect} />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 17, paddingBottom: 96 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18.4,
    includeFontPadding: false,
    lineHeight: 22.4, fontWeight: '800', letterSpacing: -0.32 },
  closeBtn: {
    width: 30.3,
    height: 30.3,
    borderRadius: 15.2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  segment: {
    flexDirection: 'row',
    gap: 3.2,
    padding: 2.7,
    borderRadius: RADIUS.pill,
    marginTop: 11.9,
  },
  segItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  segText: { fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2, fontWeight: '800', letterSpacing: 0.4 },

  amountLabel: {
    fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3,
    textAlign: 'center',
    marginTop: 12.1,
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 4.3,
    paddingTop: 4.3,
    paddingBottom: 10.8,
  },
  currency: { fontSize: 18.4,
    includeFontPadding: false,
    lineHeight: 22.4, fontWeight: '700', marginRight: 4.3, marginBottom: 4.9 },
  amt: {
    fontSize: 41.1,
    includeFontPadding: false,
    fontWeight: '800',
    letterSpacing: -1.62,
    lineHeight: 39,
    fontVariant: ['tabular-nums'],
    /* 空态也要留一点宽度，否则 TextInput 塌成 0 宽、光标看不见。 */
    minWidth: 18,
    textAlign: 'left',
    padding: 0,
  },
  amtHint: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, textAlign: 'center', marginTop: 1.1 },

  label: {
    fontSize: 7.0,
    includeFontPadding: false,
    lineHeight: 8.5,
    marginBottom: 7,
    marginTop: 15,
    letterSpacing: 1.1,
    fontWeight: '700',
    paddingLeft: 2,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  /* 原型 screen1 是 `<div class="chipRow" style="margin-top:14px">` → 7.6dp */
  chipRowLoose: { marginTop: 7.6 },
  pickerWrap: { marginTop: 4.3 },
  chip: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11.9,
    paddingVertical: 6.5,
  },
  chipTiny: { paddingHorizontal: 10.8, paddingVertical: 5.4 },
  chipText: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '700' },
  chipTextOn: { fontWeight: '800' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7.6,
    paddingHorizontal: 11.9,
    paddingVertical: 9.7,
    borderRadius: 14.1,
    marginTop: 4.9,
  },
  fieldLbl: { width: 33.6, fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '600' },
  fieldVal: { flex: 1, fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '700', padding: 0 },

  calWrap: { marginTop: 9 },

  error: { fontSize: 7.0,
    includeFontPadding: false,
    lineHeight: 8.5, marginTop: 12 },

  saveWrap: {
    paddingHorizontal: 17,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    height: 41.1,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 16px 36px rgba(32,60,52,0.28)',
  },
  saveText: { fontSize: 11.4,
    includeFontPadding: false,
    lineHeight: 13.9, fontWeight: '800', letterSpacing: 1 },
});
