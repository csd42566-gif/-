/**
 * 设置 store（v2）：主题 / 动画三档 / 流水显示三开关 / 预算。
 * 用 selector 订阅，避免无谓重渲染。
 */

import { create } from 'zustand';

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from './preferences';
import type { Preferences } from './preferences';

interface SettingsState extends Preferences {
  hydrate: () => void;
  setTheme: (theme: Preferences['theme']) => void;
  setRecordSuccessAnimation: (value: Preferences['recordSuccessAnimation']) => void;
  setPageTransition: (value: Preferences['pageTransition']) => void;
  setNumberRoll: (value: Preferences['numberRoll']) => void;
  setDisplayToggles: (patch: Partial<Preferences['displayToggles']>) => void;
  setMonthlyBudgetCents: (cents: number) => void;
  setLastAccountId: (id: number | null) => void;
}

function persist(state: SettingsState): SettingsState {
  const prefs: Preferences = {
    theme: state.theme,
    recordSuccessAnimation: state.recordSuccessAnimation,
    pageTransition: state.pageTransition,
    numberRoll: state.numberRoll,
    displayToggles: state.displayToggles,
    monthlyBudgetCents: state.monthlyBudgetCents,
    lastAccountId: state.lastAccountId,
  };
  savePreferences(prefs);
  return state;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_PREFERENCES,
  hydrate: () => {
    const loaded = loadPreferences();
    set({ ...loaded });
  },
  setTheme: (theme) => set((s) => persist({ ...s, theme })),
  setRecordSuccessAnimation: (recordSuccessAnimation) =>
    set((s) => persist({ ...s, recordSuccessAnimation })),
  setPageTransition: (pageTransition) => set((s) => persist({ ...s, pageTransition })),
  setNumberRoll: (numberRoll) => set((s) => persist({ ...s, numberRoll })),
  setDisplayToggles: (patch) =>
    set((s) => persist({ ...s, displayToggles: { ...s.displayToggles, ...patch } })),
  setMonthlyBudgetCents: (monthlyBudgetCents) =>
    set((s) => persist({ ...s, monthlyBudgetCents })),
  setLastAccountId: (lastAccountId) => set((s) => persist({ ...s, lastAccountId })),
}));
