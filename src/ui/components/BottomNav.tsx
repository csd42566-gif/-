import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export type Tab = 'home' | 'ledger' | 'debts' | 'goals' | 'me';
const items: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: '首页', icon: 'home-outline' },
  { key: 'ledger', label: '账本', icon: 'receipt-outline' },
  { key: 'debts', label: '待还', icon: 'calendar-outline' },
  { key: 'goals', label: '目标', icon: 'flag-outline' },
  { key: 'me', label: '我的', icon: 'person-outline' },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return <View style={styles.bar} accessibilityRole="tablist">{items.map(({ key, label, icon }) => {
    const selected = key === active;
    return <Pressable key={key} onPress={() => onChange(key)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Ionicons name={icon} size={19} color={selected ? colors.ink : colors.muted} />
      <Text style={[styles.label, selected && styles.active]}>{label}</Text>
      {selected && <View style={styles.dot} />}
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({ bar:{height:68,backgroundColor:colors.surface,borderTopWidth:1,borderTopColor:colors.line,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},item:{height:58,minWidth:58,alignItems:'center',justifyContent:'center',gap:2},label:{fontSize:10,color:colors.muted},active:{color:colors.ink,fontWeight:'800'},dot:{position:'absolute',bottom:1,width:16,height:2,borderRadius:2,backgroundColor:colors.accent},pressed:{opacity:.65} });
