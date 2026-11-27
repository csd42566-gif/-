/**
 * 账户管理页（方案 B 定稿）：顶部合计余额卡 + 每个账户一张白卡
 * （图标块 + 名称 + 笔数 + 余额 + 分隔线后的操作胶囊）。
 *
 * 三态与原型一致：
 * - 正常账户：绿/蓝色块图标，余额深色；操作「改名 / 停用」。
 * - 零笔数账户：多一个描边红「删除」，卡下一行小字说明「没有账目的账户才能删，删了就找不回来。」
 * - 已停用账户：整卡 50% 透明，副标题「已停用 · N 笔账」，操作变「启用」。
 *
 * 决策 13/14：账户可新增；停用只是藏起来，流水仍在；删除只对空账户开放（数据完整性硬边界）。
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
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { formatCents, parseAmountToCents } from '../src/core/money';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import { Aurora } from '../src/ui/aurora';
import { CategoryIcon } from '../src/ui/categoryIcon';
import { ConfirmDialog } from '../src/ui/dialog';
import { RADIUS, useTheme, type ThemeColors } from '../src/ui/theme';
import { TopFade } from '../src/ui/topFade';
import { PressScale } from '../src/ui/pressScale';

/** 按账户名猜一个图标与底色；认不出就退回银行卡色。原型里微信绿、支付宝蓝、银行卡琥珀。 */
function lookOf(name: string, theme: ThemeColors, index: number) {
  const n = name.toLowerCase();
  if (n.includes('微信') || n.includes('wechat')) {
    return { icon: 'wechat', tint: '#DDF3E3', ink: '#22A05A' };
  }
  if (n.includes('支付宝') || n.includes('alipay')) {
    return { icon: 'alipay', tint: '#DDE7FA', ink: '#3B6FD4' };
  }
  if (n.includes('银行') || n.includes('卡') || n.includes('bank')) {
    return { icon: 'bank', tint: '#FDF0D5', ink: theme.accent };
  }
  return { icon: 'bank', tint: theme.tint[index % theme.tint.length], ink: theme.accent };
}

export default function Accounts() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    accounts,
    loaded,
    load,
    addAccount,
    renameAccount,
    setEnabled,
    setInitialBalance,
    removeAccount,
  } = useAccountsStore();
  const { transactions } = useLedgerStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [error, setError] = useState('');
  /** 删除确认走页内弹窗（src/ui/dialog.tsx），不用系统 Alert——安卓上灰底与方案 B 两张皮。 */
  const [pendingDelete, setPendingDelete] = useState<{
    name: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const txCountByAccount = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of transactions) map.set(t.accountId, (map.get(t.accountId) ?? 0) + 1);
    return map;
  }, [transactions]);

  const totalCents = accounts.reduce((sum, a) => sum + a.balanceCents, 0);
  const disabledCount = accounts.filter((a) => !a.enabled).length;
  const txTotal = transactions.length;
  const namesJoined = accounts.map((a) => a.name).join('、');

  const doAdd = async () => {
    const name = newName.trim();
    if (name === '') {
      setError('账户名不能为空。');
      return;
    }
    const cents = newBalance.trim() === '' ? 0 : parseAmountToCents(newBalance);
    if (cents === null || cents < 0) {
      setError('初始余额只填数字（如 5000）。');
      return;
    }
    setError('');
    await addAccount({
      name,
      icon: '',
      color: '',
      initialBalanceCents: cents,
      initialCurrency: 'CNY',
    });
    setShowAdd(false);
    setNewName('');
    setNewBalance('');
  };

  const doRename = async (id: number) => {
    const name = editName.trim();
    if (name === '') {
      setError('账户名不能为空。');
      return;
    }
    const cents = parseAmountToCents(editBalance);
    if (cents === null || cents < 0) {
      setError('初始余额只填数字。');
      return;
    }
    setError('');
    await renameAccount(id, { name });
    await setInitialBalance(id, cents);
    setEditing(null);
  };

  const doRemove = (id: number, name: string) => {
    const count = txCountByAccount.get(id) ?? 0;
    if (count > 0) {
      setError(`「${name}」还有 ${count} 笔账，只能停用，不能删除。`);
      return;
    }
    setPendingDelete({
      name,
      onConfirm: () => {
        setPendingDelete(null);
        void removeAccount(id);
      },
    });
  };

  /** 操作胶囊：primary 琥珀渐变 / plain 浅灰面 / danger 描边红。 */
  const pill = (label: string, onPress: () => void, tone: 'primary' | 'plain' | 'danger') => (
    <PressScale
      key={label}
      style={[
        styles.pill,
        tone === 'primary'
          ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
          : tone === 'danger'
            ? { borderWidth: 1, borderColor: 'rgba(217,89,94,0.4)' }
            : { backgroundColor: theme.cardAlt.backgroundColor },
      ]}
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
          <Text style={[styles.navKicker, { color: theme.ghost }]}>设置 · 管理</Text>
        </View>

        <View style={styles.headRow}>
          <Text style={[styles.headTitle, { color: theme.text }]}>账户</Text>
        </View>
        <Text style={[styles.headSub, { color: theme.faint }]}>
          {accounts.length} 个
          {disabledCount > 0 ? ` · ${disabledCount} 个已停用` : ''}
        </Text>

        <View style={[styles.sumCard, theme.card]}>
          <Text style={[styles.sumLbl, { color: theme.faint }]}>合计余额</Text>
          <Text style={[styles.sumVal, { color: theme.text }]}>
            {formatCents(totalCents)}
          </Text>
          <Text style={[styles.sumCap, { color: theme.ghost }]}>
            {txTotal} 笔账{namesJoined ? ` · ${namesJoined}` : ''}
          </Text>
        </View>

        {accounts.map((a, i) => {
          const count = txCountByAccount.get(a.id) ?? 0;
          const look = lookOf(a.name, theme, i);
          const zero = a.balanceCents === 0;

          return (
            <View
              key={a.id}
              style={[styles.acctCard, theme.card, !a.enabled && styles.cardDisabled]}
            >
              {editing === a.id ? (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
                    ]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="账户名"
                    placeholderTextColor={theme.ghost}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
                    ]}
                    value={editBalance}
                    onChangeText={setEditBalance}
                    placeholder="初始余额（对账修正）"
                    placeholderTextColor={theme.ghost}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.acctActs}>
                    {pill('保存', () => void doRename(a.id), 'primary')}
                    {pill('取消', () => setEditing(null), 'plain')}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.acctTop}>
                    <View style={[styles.acctIcon, { backgroundColor: look.tint }]}>
                      <CategoryIcon icon={look.icon} size={24} color={look.ink} />
                    </View>
                    <View style={styles.acctBody}>
                      <Text style={[styles.acctName, { color: theme.text }]} numberOfLines={1}>
                        {a.name}
                      </Text>
                      <Text style={[styles.acctMeta, { color: theme.faint }]}>
                        {count} 笔账{a.enabled ? '' : ' · 已停用'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.acctBal,
                        { color: zero ? theme.ghost : theme.text },
                      ]}
                    >
                      {formatCents(a.balanceCents)}
                    </Text>
                  </View>

                  <View style={[styles.acctActs, { borderTopColor: theme.line }]}>
                    {pill(
                      '改名',
                      () => {
                        setEditing(a.id);
                        setEditName(a.name);
                        setEditBalance(String(a.initialBalanceCents / 100));
                      },
                      'plain',
                    )}
                    {pill(
                      a.enabled ? '停用' : '启用',
                      () => void setEnabled(a.id, !a.enabled),
                      'plain',
                    )}
                    {count === 0 && pill('删除', () => doRemove(a.id, a.name), 'danger')}
                  </View>

                  {count === 0 && (
                    <Text style={[styles.acctNote, { color: theme.ghost }]}>
                      没有账目的账户才能删，删了就找不回来。
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })}

        {showAdd ? (
          <View style={[styles.acctCard, theme.card]}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="账户名（如 现金钱包）"
              placeholderTextColor={theme.ghost}
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
              ]}
              value={newBalance}
              onChangeText={setNewBalance}
              placeholder="初始余额（可不填 = 0）"
              placeholderTextColor={theme.ghost}
              keyboardType="decimal-pad"
            />
            <View style={styles.acctActs}>
              {pill('添加', () => void doAdd(), 'primary')}
              {pill('取消', () => setShowAdd(false), 'plain')}
            </View>
          </View>
        ) : (
          <PressScale pressedScale={0.94}
            style={[styles.addBtn, { backgroundImage: theme.amberGradient }]}
            onPress={() => setShowAdd(true)}
          >
            <Text style={[styles.addBtnText, { color: theme.onAmber }]}>+ 新增账户</Text>
          </PressScale>
        )}

        {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}

        <View style={{ height: 40 }} />
      </ScrollView>
      <TopFade top={insets.top} />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="删除账户"
        message={`确定删除「${pendingDelete?.name ?? ''}」？删了就找不回来。`}
        confirmText="删除"
        tone="danger"
        onConfirm={() => pendingDelete?.onConfirm()}
        onCancel={() => setPendingDelete(null)}
      />
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

  headRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  headTitle: { fontSize: 26.0,
    includeFontPadding: false,
    lineHeight: 28.6, fontWeight: '800', letterSpacing: -1.1 },
  headSub: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, marginTop: 4, letterSpacing: 0.2 },

  sumCard: {
    marginTop: 10.8,
    borderRadius: 18.4,
    paddingTop: 11.9,
    paddingBottom: 10.8,
    paddingHorizontal: 13,
  },
  sumLbl: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, letterSpacing: 1.8, fontWeight: '700' },
  sumVal: {
    fontSize: 22.7,
    includeFontPadding: false,
    lineHeight: 25.0,
    fontWeight: '800',
    letterSpacing: -0.65,
    marginTop: 2.2,
    fontVariant: ['tabular-nums'],
  },
  sumCap: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, marginTop: 3.8 },

  acctCard: {
    marginTop: 7.6,
    borderRadius: 17.3,
    paddingTop: 13,
    paddingBottom: 10.8,
    paddingHorizontal: 13,
  },
  cardDisabled: { opacity: 0.45 },

  acctTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acctIcon: {
    width: 27.1,
    height: 27.1,
    borderRadius: 9.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acctBody: { flex: 1, minWidth: 0 },
  acctName: { fontSize: 11.4,
    includeFontPadding: false,
    lineHeight: 13.9, fontWeight: '800', letterSpacing: -0.2 },
  acctMeta: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, marginTop: 2.2 },
  acctBal: {
    fontSize: 13.0,
    includeFontPadding: false,
    lineHeight: 15.9,
    fontWeight: '800',
    letterSpacing: -0.27,
    fontVariant: ['tabular-nums'],
  },

  acctActs: {
    flexDirection: 'row',
    gap: 4.9,
    marginTop: 9.7,
    paddingTop: 9.2,
    borderTopWidth: 1,
    flexWrap: 'wrap',
  },
  acctNote: { fontSize: 7.3,
    includeFontPadding: false, marginTop: 5.4, lineHeight: 11 },

  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  pillText: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '700' },

  input: {
    fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 7,
    fontWeight: '600',
  },

  addBtn: {
    marginTop: 8.7,
    height: 37.9,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 26px rgba(32,60,52,0.22)',
  },
  addBtnText: { fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '800', letterSpacing: 0.5 },

  error: { fontSize: 7.0,
    includeFontPadding: false,
    lineHeight: 8.5, marginTop: 10 },
});
