import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, ThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';

export function MetricCard({ label, value, tone = 'normal', caption }: { label: string; value: string; tone?: 'normal' | 'success' | 'danger' | 'warning'; caption?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors.surface, colors.line, colors.muted, colors.ink]);
  const toneColor = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.ink;
  return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={[styles.value, { color: toneColor }]}>{value}</Text>{caption && <Text style={styles.caption}>{caption}</Text>}</View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 12 },
    label: { fontSize: 12, color: colors.muted },
    value: { fontSize: 18, fontWeight: '800', marginTop: 5, fontVariant: ['tabular-nums'] },
    caption: { fontSize: 11, color: colors.muted, marginTop: 4 },
  });
}