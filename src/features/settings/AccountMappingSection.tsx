import { ThemedModal } from '../../ui/components/ThemedModal';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Account, LedgerState, MotionLevel } from '../../core/model/finance';
import { radius, spacing, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { useThemedStyles } from '../../ui/hooks/useThemedStyles';

export function collectAccountLabels(state: LedgerState): string[] {
  const labels = new Set(Object.keys(state.settings.accountMapping));
  state.pendingTransactions.forEach((item) => {
    if (item.accountLabel?.trim()) labels.add(item.accountLabel.trim());
  });
  return [...labels].sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

export function AccountMappingSection({ labels, accounts, mapping, motionLevel, onChange }: {
  labels: string[];
  accounts: Account[];
  mapping: Record<string, string>;
  motionLevel: MotionLevel;
  onChange: (mapping: Record<string, string>) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const selectedAccountName = useMemo(() => {
    if (!selectedLabel) return '';
    return accounts.find((account) => account.id === mapping[selectedLabel])?.name ?? '未关联';
  }, [accounts, mapping, selectedLabel]);
  const choose = (accountId: string) => {
    if (!selectedLabel) return;
    const next = { ...mapping };
    if (accountId) next[selectedLabel] = accountId;
    else delete next[selectedLabel];
    onChange(next);
    setSelectedLabel(null);
  };

  return <>
    {labels.length ? labels.map((label) => <Pressable key={label} onPress={() => setSelectedLabel(label)} accessibilityRole="button" accessibilityLabel={`设置${label}的关联账户`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.hint}>{mapping[label] ? '已关联' : '下次导入时自动匹配'}</Text></View>
      <Text style={styles.value}>{accounts.find((account) => account.id === mapping[label])?.name ?? '选择账户'} ›</Text>
    </Pressable>) : <Text style={styles.empty}>导入账单并出现未匹配支付账户后，这里会列出可关联的账单账户名。</Text>}
    <ThemedModal visible={!!selectedLabel} transparent animationType={motionLevel ? 'none' : 'fade'} onRequestClose={() => setSelectedLabel(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.title}>{selectedLabel ?? '账户映射'}</Text>
        <Text style={styles.description}>当前关联：{selectedAccountName}</Text>
        {accounts.length ? <ScrollView style={styles.options}>{accounts.map((account) => <Pressable key={account.id} onPress={() => choose(account.id)} accessibilityRole="button" style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.optionLabel}>{account.name}</Text>{mapping[selectedLabel ?? ''] === account.id && <Text style={styles.selected}>已选择</Text>}</Pressable>)}</ScrollView> : <Text style={styles.empty}>还没有应用账户，请先在“我的 → 账户”中创建。</Text>}
        <View style={styles.actions}><Pressable onPress={() => setSelectedLabel(null)} style={styles.action}><Text style={styles.cancel}>取消</Text></Pressable>{mapping[selectedLabel ?? ''] && <Pressable onPress={() => choose('')} style={styles.action}><Text style={styles.clear}>取消关联</Text></Pressable>}</View>
      </View></View>
    </ThemedModal>
  </>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  copy: { flex: 1, paddingVertical: spacing.xs },
  label: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  hint: { fontSize: 10, color: colors.muted, marginTop: 2 },
  value: { fontSize: 11, color: colors.accent, fontWeight: '700', maxWidth: '48%', textAlign: 'right' },
  empty: { fontSize: 11, color: colors.muted, lineHeight: 18, paddingVertical: spacing.sm },
  pressed: { opacity: 0.65 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 30 },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  description: { fontSize: 11, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.sm },
  options: { maxHeight: 320 },
  option: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 13, color: colors.ink },
  selected: { fontSize: 10, color: colors.success, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.lg },
  action: { minHeight: 40, justifyContent: 'center' },
  cancel: { fontSize: 13, color: colors.muted },
  clear: { fontSize: 13, color: colors.danger, fontWeight: '700' },
  });
}

