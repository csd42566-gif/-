import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export type Tab = 'home' | 'ledger' | 'debts' | 'goals' | 'me';
const items: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; selectedIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: '首页', icon: 'home-outline', selectedIcon: 'home' },
  { key: 'ledger', label: '账本', icon: 'list-outline', selectedIcon: 'list' },
  { key: 'debts', label: '待还', icon: 'card-outline', selectedIcon: 'card' },
  { key: 'goals', label: '目标', icon: 'flag-outline', selectedIcon: 'flag' },
  { key: 'me', label: '我的', icon: 'person-outline', selectedIcon: 'person' },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { height: 56 + insets.bottom, paddingBottom: insets.bottom }]} accessibilityRole="tablist">{items.map(({ key, label, icon, selectedIcon }) => {
    const selected = key === active;
    return <Pressable key={key} onPress={() => onChange(key)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Ionicons name={selected ? selectedIcon : icon} size={20} color={selected ? colors.accent : colors.muted} />
      <Text style={[styles.label, selected && styles.active]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  item: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, color: colors.muted },
  active: { color: colors.accent, fontWeight: '800' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
});