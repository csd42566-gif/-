/**
 * 流水详情页（方案 B 定稿）：全字段展示 + 编辑 + 删除（二次确认）+ 转账双腿互跳。
 *
 * 决策 19/20：金额/分类/账户/日期/备注随便改；删除二次确认。
 * 转账不变量（验收 3/4）：kind 锁定 transfer 不可改；金额编辑同步双腿（|转出|=|转入|）；
 * 日期与备注同步双腿；账户只改当前腿（双腿可挂不同账户，总余额仍为 0）。
 *
 * 视觉：返回钮 + 「账本 · 明细」面包屑；详情是白卡（彩色图标块 + 30px 金额 + 分隔线后的
 * 元信息行 + 备注）；编辑态在同卡内换成字段行，底部保存/取消胶囊。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { dayKeyOf } from '../../src/core/ledger/grouping';
import { dayLabel } from '../../src/core/ledger/dayLabel';
import { formatCurrencyAmount } from '../../src/core/currency';
import { parseAmountToCents } from '../../src/core/money';
import { useAccountsStore } from '../../src/features/accounts/accountsStore';
import { useCategoriesStore } from '../../src/features/categories/categoriesStore';
import { useLedgerStore } from '../../src/features/ledger/ledgerStore';
import { Aurora } from '../../src/ui/aurora';
import { Calendar } from '../../src/ui/calendar';
import { ConfirmDialog } from '../../src/ui/dialog';
import { CategoryIcon } from '../../src/ui/categoryIcon';
import { RADIUS, useTheme } from '../../src/ui/theme';
import { TopFade } from '../../src/ui/topFade';
import { PressScale } from '../../src/ui/pressScale';

const KIND_LABEL = { expense: '支出', income: '收入', transfer: '转账' } as const;
const EDITABLE_KINDS = ['expense', 'income'] as const;

export default function TransactionDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const { transactions, loaded: ledgerLoaded, load: loadLedger, update, remove } =
    useLedgerStore();
  const { accounts, loaded: accountsLoaded, load: loadAccounts } = useAccountsStore();
  const { categories, loaded: categoriesLoaded, load: loadCategories } = useCategoriesStore();

  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editKind, setEditKind] = useState<(typeof EDITABLE_KINDS)[number]>('expense');
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editOccurredAt, setEditOccurredAt] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState('');
  /** 删除确认走页内弹窗（src/ui/dialog.tsx），不用系统 Alert。 */
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!ledgerLoaded) void loadLedger();
    if (!accountsLoaded) void loadAccounts();
    if (!categoriesLoaded) void loadCategories();
  }, [ledgerLoaded, accountsLoaded, categoriesLoaded, loadLedger, loadAccounts, loadCategories]);

  const tx = useMemo(() => transactions.find((t) => t.id === txId), [transactions, txId]);
  const related = useMemo(
    () => (tx?.relatedId != null ? transactions.find((t) => t.id === tx.relatedId) : undefined),
    [transactions, tx],
  );
  const account = useMemo(() => accounts.find((a) => a.id === tx?.accountId), [accounts, tx]);
  const category = useMemo(
    () => (tx?.categoryId != null ? categories.find((c) => c.id === tx.categoryId) : undefined),
    [categories, tx],
  );
  const relatedAccount = useMemo(
    () => (related ? accounts.find((a) => a.id === related.accountId) : undefined),
    [accounts, related],
  );
  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === editKind),
    [categories, editKind],
  );

  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() / 1000;
  })();
  const calendarDate = new Date(editOccurredAt * 1000);
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth() + 1;
  const editDayText = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(
    calendarDate.getDate(),
  ).padStart(2, '0')}`;

  if (!tx) {
    return (
      <Aurora>
        <Text style={[styles.hint, { color: theme.muted }]}>
          {ledgerLoaded ? '这笔账不存在（可能已删除）。' : '加载中…'}
        </Text>
      </Aurora>
    );
  }

  const startEdit = () => {
    setEditing(true);
    setEditKind(tx.kind === 'transfer' ? 'expense' : tx.kind);
    setEditAmount(String(Math.abs(tx.amountCents) / 100));
    setEditNote(tx.note);
    setEditCategoryId(tx.categoryId);
    setEditAccountId(tx.accountId);
    setEditOccurredAt(tx.occurredAt);
    setShowCalendar(false);
    setError('');
  };

  const doSave = async () => {
    const cents = parseAmountToCents(editAmount);
    if (cents === null || cents <= 0) {
      setError('金额不对，只填数字。');
      return;
    }
    if (editAccountId === null) {
      setError('先选账户。');
      return;
    }
    if (tx.kind !== 'transfer' && editCategoryId === null) {
      setError('先选分类。');
      return;
    }
    setError('');
    try {
      if (tx.kind === 'transfer') {
        // 双腿同步：|转出|=|转入|、日期/备注一致；账户只改当前腿。
        const sign = tx.amountCents < 0 ? -1 : 1;
        await update(tx.id, {
          amountCents: sign * cents,
          accountId: editAccountId,
          occurredAt: editOccurredAt,
          note: editNote.trim(),
        });
        if (related) {
          await update(related.id, {
            amountCents: -sign * cents,
            occurredAt: editOccurredAt,
            note: editNote.trim(),
          });
        }
      } else {
        await update(tx.id, {
          kind: editKind,
          amountCents: cents,
          categoryId: editCategoryId,
          accountId: editAccountId,
          occurredAt: editOccurredAt,
          note: editNote.trim(),
        });
      }
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败');
    }
  };

  const doRemove = () => setConfirmDelete(true);

  const kindLabel = KIND_LABEL[tx.kind];
  const amountText = `${
    tx.kind === 'transfer'
      ? tx.amountCents > 0
        ? '+'
        : '-'
      : tx.kind === 'expense'
        ? '-'
        : '+'
  }${formatCurrencyAmount(Math.abs(tx.amountCents), tx.currency)}`;
  const amountColor =
    tx.kind === 'expense' ? theme.expense : tx.kind === 'income' ? theme.income : theme.muted;

  const todayKey = dayKeyOf(Date.now() / 1000);
  const yesterdayKey = dayKeyOf(Date.now() / 1000 - 86400);
  const dayText = dayLabel(dayKeyOf(tx.occurredAt), todayKey, yesterdayKey);

  /** 操作胶囊：primary 琥珀渐变 / plain 浅灰面 / danger 描边红。 */
  const pill = (label: string, onPress: () => void, tone: 'primary' | 'plain' | 'danger') => (
    <PressScale
      style={[
        styles.pill,
        tone === 'primary'
          ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
          : tone === 'danger'
            ? { borderWidth: 1, borderColor: 'rgba(217,89,94,0.4)' }
            : { backgroundColor: theme.cardAlt.backgroundColor },
      ]}
      pressedScale={0.94}
      haptic={tone === 'danger' ? 'warning' : 'light'}
      onPress={onPress}
    >
      <Text
        style={[
          styles.pillText,
          {
            color:
              tone === 'primary' ? theme.onAmber : tone === 'danger' ? theme.expense : theme.muted,
          },
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
          <Pressable
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
          </Pressable>
          <Text style={[styles.navKicker, { color: theme.ghost }]}>账本 · 明细</Text>
        </View>

        {editing ? (
          <View style={[styles.card, theme.card]}>
            {tx.kind === 'transfer' ? (
              <Text style={[styles.lockedKind, { color: theme.faint }]}>
                转账不可改类型 · 金额/日期/备注双腿同步
              </Text>
            ) : (
              <View style={[styles.segment, { backgroundColor: theme.cardAlt.backgroundColor }]}>
                {EDITABLE_KINDS.map((k) => (
                  <Pressable
                    key={k}
                    style={[
                      styles.segItem,
                      editKind === k && {
                        backgroundImage: theme.amberGradient,
                        backgroundColor: theme.amber,
                      },
                    ]}
                    onPress={() => {
                      setEditKind(k);
                      setEditCategoryId(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.segText,
                        { color: editKind === k ? theme.onAmber : theme.faint },
                      ]}
                    >
                      {KIND_LABEL[k]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.editAmountBox}>
              <Text style={[styles.editCurrency, { color: theme.accent }]}>¥</Text>
              <TextInput
                style={[styles.editAmount, { color: theme.text }]}
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0"
                placeholderTextColor={theme.ghost}
                keyboardType="decimal-pad"
              />
            </View>

            {tx.kind !== 'transfer' && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.sectionLabel }]}>分类</Text>
                <View style={styles.chips}>
                  {kindCategories.map((c) => {
                    const on = editCategoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.chip,
                          on
                            ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
                            : { backgroundColor: theme.cardAlt.backgroundColor },
                        ]}
                        onPress={() => setEditCategoryId(c.id)}
                      >
                        <Text
                          style={[styles.chipText, { color: on ? theme.onAmber : theme.muted }]}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[styles.fieldLabel, { color: theme.sectionLabel }]}>账户</Text>
            <View style={styles.chips}>
              {accounts.map((a) => {
                const on = editAccountId === a.id;
                return (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.chip,
                      on
                        ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
                        : { backgroundColor: theme.cardAlt.backgroundColor },
                    ]}
                    onPress={() => setEditAccountId(a.id)}
                  >
                    <Text style={[styles.chipText, { color: on ? theme.onAmber : theme.muted }]}>
                      {a.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: theme.sectionLabel }]}>日期</Text>
            <Pressable
              style={[styles.fieldRow, { backgroundColor: theme.cardAlt.backgroundColor }]}
              onPress={() => setShowCalendar((v) => !v)}
            >
              <Text style={[styles.fieldVal, { color: theme.text }]}>{editDayText}</Text>
              <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
                <Path
                  d="M3 1 L7 5 L3 9"
                  stroke={theme.ghost}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            {showCalendar && (
              <View style={styles.calendarWrap}>
                <Calendar
                  year={calYear}
                  month={calMonth}
                  selected={editOccurredAt}
                  todayStart={todayStart}
                  onSelect={(epoch) => {
                    setEditOccurredAt(epoch);
                    setShowCalendar(false);
                  }}
                  onPrevMonth={() => {
                    const prev = new Date(calYear, calMonth - 2, 1);
                    setEditOccurredAt(prev.getTime() / 1000);
                  }}
                  onNextMonth={() => {
                    const next = new Date(calYear, calMonth, 1);
                    const nextStart = next.getTime() / 1000;
                    if (nextStart <= todayStart) setEditOccurredAt(nextStart);
                  }}
                />
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.sectionLabel }]}>备注</Text>
            <TextInput
              style={[
                styles.noteInput,
                { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
              ]}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="备注"
              placeholderTextColor={theme.ghost}
            />

            {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}
            <View style={styles.row}>
              {pill('保存修改', () => void doSave(), 'primary')}
              {pill('取消', () => setEditing(false), 'plain')}
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.card, theme.card]}>
              <View style={styles.detailHead}>
                <View
                  style={[
                    styles.bigIcon,
                    { backgroundColor: theme.tint[tx.id % theme.tint.length] },
                  ]}
                >
                  <CategoryIcon
                    icon={tx.kind === 'transfer' ? 'transfer' : category?.icon || 'more'}
                    size={24}
                    color={theme.accent}
                  />
                </View>
                <View style={styles.detailHeadText}>
                  <Text style={[styles.kind, { color: theme.ghost }]}>{kindLabel}</Text>
                  <Text style={[styles.amount, { color: amountColor }]}>{amountText}</Text>
                </View>
              </View>

              <View style={[styles.metaBlock, { borderTopColor: theme.line }]}>
                <View style={styles.metaLine}>
                  <Text style={[styles.metaKey, { color: theme.ghost }]}>日期</Text>
                  <Text style={[styles.metaVal, { color: theme.text }]}>{dayText}</Text>
                </View>
                <View style={styles.metaLine}>
                  <Text style={[styles.metaKey, { color: theme.ghost }]}>账户</Text>
                  <Text style={[styles.metaVal, { color: theme.text }]}>
                    {account?.name ?? `#${tx.accountId}`}
                  </Text>
                </View>
                {category && (
                  <View style={styles.metaLine}>
                    <Text style={[styles.metaKey, { color: theme.ghost }]}>分类</Text>
                    <Text style={[styles.metaVal, { color: theme.text }]}>{category.name}</Text>
                  </View>
                )}
                <View style={styles.metaLine}>
                  <Text style={[styles.metaKey, { color: theme.ghost }]}>币种</Text>
                  <Text style={[styles.metaVal, { color: theme.text }]}>{tx.currency}</Text>
                </View>
                {tx.note !== '' && (
                  <View style={styles.metaLine}>
                    <Text style={[styles.metaKey, { color: theme.ghost }]}>备注</Text>
                    <Text style={[styles.metaVal, { color: theme.text }]}>{tx.note}</Text>
                  </View>
                )}
              </View>

              {related && (
                <Pressable
                  style={[
                    styles.related,
                    { backgroundColor: theme.accentSoft, borderColor: 'rgba(32,60,52,0.16)' },
                  ]}
                  onPress={() => router.replace(`/transaction/${related.id}` as never)}
                >
                  <Text style={[styles.relatedText, { color: theme.accent }]}>
                    另一腿 · {relatedAccount?.name ?? `#${related.accountId}`}
                  </Text>
                  <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
                    <Path
                      d="M3 1 L7 5 L3 9"
                      stroke={theme.accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              )}
            </View>

            <View style={styles.row}>
              {pill('编辑', startEdit, 'primary')}
              {pill('删除', doRemove, 'danger')}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      <TopFade top={insets.top} />

      <ConfirmDialog
        visible={confirmDelete}
        title="删除这笔账"
        message="删除后余额会自动重算。确定删除？"
        confirmText="确认删除"
        tone="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          void remove(tx.id);
          router.back();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 17, paddingBottom: 20 },
  hint: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, textAlign: 'center', marginTop: 64 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
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

  card: {
    borderRadius: RADIUS.card,
    paddingVertical: 17,
    paddingHorizontal: 17,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },

  detailHead: { flexDirection: 'row', alignItems: 'center' },
  bigIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  detailHeadText: { flex: 1, minWidth: 0 },
  kind: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, letterSpacing: 1.4, fontWeight: '700' },
  amount: {
    fontSize: 28.2,
    includeFontPadding: false,
    lineHeight: 31.0,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: 3,
  },

  metaBlock: { borderTopWidth: 1, marginTop: 14, paddingTop: 4 },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 7,
  },
  metaKey: { width: 34, fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '600', paddingTop: 1 },
  metaVal: { flex: 1, fontSize: 9.2,
    includeFontPadding: false, fontWeight: '700', lineHeight: 18 },

  related: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 13,
  },
  relatedText: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '800' },

  lockedKind: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '700', marginBottom: 12, letterSpacing: 0.4 },

  segment: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: RADIUS.pill,
    marginBottom: 10,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  segText: { fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2, fontWeight: '800' },

  editAmountBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 6,
    paddingBottom: 2,
  },
  editCurrency: { fontSize: 18.4,
    includeFontPadding: false,
    lineHeight: 22.4, fontWeight: '700', marginRight: 3, marginBottom: 5 },
  editAmount: {
    flex: 1,
    fontSize: 41.1,
    includeFontPadding: false,
    lineHeight: 45.2,
    fontWeight: '800',
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },

  fieldLabel: {
    fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 7,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '700' },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fieldVal: { fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  calendarWrap: { marginTop: 10 },

  noteInput: {
    fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8,
    fontWeight: '600',
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  pill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pillText: { fontWeight: '800', fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, letterSpacing: 0.3 },
  error: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, marginTop: 10 },
});
