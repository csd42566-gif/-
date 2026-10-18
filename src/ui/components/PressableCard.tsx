import React, { useMemo } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';

type Props = Pick<PressableProps, 'onPress' | 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PressableCard({ children, style, ...pressableProps }: Props) {
  const styles = useStyles();
  return <Pressable {...pressableProps} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>{children}</Pressable>;
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({ card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md }, pressed: { transform: [{ scale: 0.98 }], opacity: 0.88 } });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors.line, colors.surface]);
}
