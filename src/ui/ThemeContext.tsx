import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { modeThemes, ThemeColors, ThemeMode } from './theme';

type ThemeValue = { mode: ThemeMode; colors: ThemeColors };

const fallbackTheme: ThemeValue = { mode: 'strict', colors: modeThemes.strict };
const ThemeContext = createContext<ThemeValue>(fallbackTheme);

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const value = useMemo(() => ({ mode, colors: modeThemes[mode] }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}