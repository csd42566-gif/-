import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { spacing, ThemeColors } from '../theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <Text style={styles.title}>{children}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ title: { fontSize: 13, fontWeight: '800', color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm } });
}