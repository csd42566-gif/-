import { useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { ThemeColors } from '../theme';

export function useThemedStyles<T>(createStyles: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
