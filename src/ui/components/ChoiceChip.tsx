import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, ThemeColors } from '../theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

export function ChoiceChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
    chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    chipText: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
    chipTextSelected: { color: colors.ink, fontWeight: '800' },
  });
}
