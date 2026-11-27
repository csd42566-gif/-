/**
 * 偏好存储（v2）：主题 / 动画三档 / 流水显示三开关 / 预算单值。
 * 走 MMKV，不进 SQLite（设置是键值，非关系数据）。
 */

import { createMMKV } from 'react-native-mmkv';

export const preferenceStorage = createMMKV({ id: 'feiyu-preferences' });

export type ThemeMode = 'dark' | 'light' | 'system';
export type RecordSuccessAnimation = 'clean' | 'swift' | 'dramatic';
export type PageTransition = 'slide' | 'shared' | 'card';
export type NumberRoll = 'instant' | 'flip' | 'pop';

export interface DisplayToggles {
  note: boolean;
  account: boolean;
  category: boolean;
}

export interface Preferences {
  theme: ThemeMode;
  recordSuccessAnimation: RecordSuccessAnimation;
  pageTransition: PageTransition;
  numberRoll: NumberRoll;
  displayToggles: DisplayToggles;
  monthlyBudgetCents: number; // 0 = 未设置
  /** 上次记账用的账户 id（记账表单默认选中）。 */
  lastAccountId: number | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  // 方案 B 定稿是浅色（米白 + 琥珀主卡），暗色作为夜间变体保留。
  theme: 'light',
  recordSuccessAnimation: 'swift',
  pageTransition: 'shared',
  numberRoll: 'pop',
  displayToggles: { note: true, account: false, category: false },
  monthlyBudgetCents: 0,
  lastAccountId: null,
};

const KEY = 'preferences-v1';

export function loadPreferences(): Preferences {
  const raw = preferenceStorage.getString(KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      displayToggles: { ...DEFAULT_PREFERENCES.displayToggles, ...(parsed.displayToggles ?? {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Preferences): void {
  preferenceStorage.set(KEY, JSON.stringify(prefs));
}
