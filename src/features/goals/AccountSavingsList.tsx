import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, PanResponder, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Account, MotionLevel } from '../../core/model/finance';
import { calculateExistingSavings } from '../accounts/accountSavings';
import { moveAccountId, orderAccounts } from '../accounts/accountOrder';
import { motion, radius, spacing, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';

const ROW_HEIGHT = 68;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  accounts: Account[];
  savedOrder: string[];
  motionLevel: MotionLevel;
  onOrderChange: (order: string[]) => void;
};

export function AccountSavingsList({ accounts, savedOrder, motionLevel, onOrderChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const eligibleAccounts = useMemo(() => accounts.filter((account) => account.kind !== 'credit'), [accounts]);
  const orderedAccounts = useMemo(() => orderAccounts(eligibleAccounts, savedOrder), [eligibleAccounts, savedOrder]);
  const orderedIds = useMemo(() => orderedAccounts.map((account) => account.id), [orderedAccounts]);
  const [editing, setEditing] = useState(false);
  const total = calculateExistingSavings(eligibleAccounts);

  const move = useCallback((draggedId: string, targetIndex: number) => {
    const targetId = orderedAccounts[targetIndex]?.id;
    if (!targetId) return;
    const next = moveAccountId(orderedIds, draggedId, targetId);
    if (next.join('|') === orderedIds.join('|')) return;
    if (motionLevel !== 'standard') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onOrderChange(next);
  }, [onOrderChange, orderedAccounts, orderedIds, motionLevel]);

  return <View style={styles.section}>
    <View style={styles.heading}>
      <View>
        <Text style={styles.sectionTitle}>现有存款</Text>
        <Text style={styles.sectionCaption}>支付宝、微信、银行卡、现金及其他账户</Text>
      </View>
      {orderedAccounts.length > 1 && <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: editing }}
        onPress={() => setEditing((current) => !current)}
        style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}
      >
        <Ionicons name={editing ? 'checkmark' : 'swap-vertical-outline'} size={16} color={colors.accent} />
        <Text style={styles.orderText}>{editing ? '完成' : '调整顺序'}</Text>
      </Pressable>}
    </View>
    <View style={styles.panel}>
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>可计入存款</Text>
          <Text style={styles.totalValue}>¥{total.toFixed(2)}</Text>
        </View>
        <Ionicons name="wallet-outline" size={25} color={colors.success} />
      </View>
      {orderedAccounts.length === 0 ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>还没有可展示的账户</Text>
        <Text style={styles.emptyCaption}>先在“我的”里创建支付宝、微信、银行卡或现金账户。</Text>
      </View> : orderedAccounts.map((account, index) => <DraggableAccountRow
        key={account.id}
        account={account}
        index={index}
        count={orderedAccounts.length}
        editing={editing}
        motionLevel={motionLevel}
        onMove={move}
      />)}
    </View>
    {editing && <Text style={styles.editHint}>拖动左侧把手调整显示顺序，新增账户会排在最后。</Text>}
  </View>;
}

function DraggableAccountRow({ account, index, count, editing, motionLevel, onMove }: {
  account: Account;
  index: number;
  count: number;
  editing: boolean;
  motionLevel: MotionLevel;
  onMove: (draggedId: string, targetIndex: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => editing,
    onMoveShouldSetPanResponder: (_, gesture) => editing && Math.abs(gesture.dy) > 4,
    onPanResponderMove: (_, gesture) => translateY.setValue(gesture.dy),
    onPanResponderRelease: (_, gesture) => finishDrag(gesture.dy),
    onPanResponderTerminate: () => finishDrag(0),
  }), [editing, index, count, motionLevel, account.id]);

  const finishDrag = (distance: number) => {
    const targetIndex = Math.max(0, Math.min(count - 1, index + Math.round(distance / ROW_HEIGHT)));
    const config = motion.levels[motionLevel];
    if (motionLevel === 'standard' || !config.spring) translateY.setValue(0);
    else Animated.spring(translateY, { toValue: 0, ...config.spring, useNativeDriver: true }).start();
    if (targetIndex !== index) moveRef.current(account.id, targetIndex);
  };

  return <Animated.View style={[styles.accountRow, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
    <View style={[styles.handle, !editing && styles.handleHidden]}>
      <Ionicons name="reorder-three-outline" size={19} color={colors.muted} />
    </View>
    <View style={styles.accountMain}>
      <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
      <Text style={styles.accountType}>{accountTypeLabel(account)}</Text>
    </View>
    <Text style={styles.accountBalance}>¥{Math.max(0, account.balance).toFixed(2)}</Text>
  </Animated.View>;
}

function accountTypeLabel(account: Account): string {
  if (account.name.includes('支付宝')) return '支付宝账户';
  if (account.name.includes('微信')) return '微信账户';
  if (account.kind === 'bank' || account.name.includes('银行卡')) return '银行卡账户';
  if (account.kind === 'cash' || account.name.includes('现金')) return '现金账户';
  return '第三方账户';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  section: { marginTop: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  sectionCaption: { fontSize: 10, color: colors.muted, marginTop: 3, fontVariant: ['tabular-nums'] },
  orderButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  orderText: { fontSize: 11, color: colors.accent, fontWeight: '800' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  totalRow: { minHeight: 92, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.successSoft },
  totalLabel: { fontSize: 11, color: colors.muted },
  totalValue: { fontSize: 26, fontWeight: '900', color: colors.ink, marginTop: 5, fontVariant: ['tabular-nums'] },
  accountRow: { minHeight: ROW_HEIGHT, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  handle: { width: 27, alignItems: 'flex-start' },
  handleHidden: { opacity: 0 },
  accountMain: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 13, fontWeight: '800', color: colors.ink },
  accountType: { fontSize: 10, color: colors.muted, marginTop: 3 },
  accountBalance: { fontSize: 13, color: colors.ink, fontWeight: '800', marginLeft: spacing.sm, fontVariant: ['tabular-nums'] },
  empty: { padding: spacing.lg },
  emptyTitle: { fontSize: 13, color: colors.ink, fontWeight: '800' },
  emptyCaption: { fontSize: 11, color: colors.muted, lineHeight: 17, marginTop: 5 },
  editHint: { fontSize: 10, color: colors.muted, marginTop: 7 },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors.accent, colors.ink, colors.line, colors.muted, colors.success, colors.successSoft, colors.surface]);
}
