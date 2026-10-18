import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { spacing, ThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors.ink]);
  return <Text style={styles.title}>{children}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ title: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm } });
}