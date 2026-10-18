export type ThemeMode = 'punish' | 'strict' | 'normal';
export type MotionLevel = 'super' | 'enhanced' | 'standard';

export type ThemeColors = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  accent: string;
  accentSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  overlay: string;
};

export const modeThemes: Record<ThemeMode, ThemeColors> = {
  punish: {
    background: '#121212', surface: '#1E1E1E', ink: '#E6E4E1', muted: '#9E9E9E',
    line: '#2C2C2C', soft: '#1A1A1A', accent: '#C65A4A', accentSoft: '#33201C',
    warning: '#E8C547', warningSoft: '#332B14', danger: '#E57373', dangerSoft: '#331D1D',
    success: '#5CB299', successSoft: '#1B2E28', overlay: 'rgba(0,0,0,0.72)',
  },
  strict: {
    background: '#F6F7F5', surface: '#FFFFFF', ink: '#1C1F1D', muted: '#6B706C',
    line: '#E2E4E1', soft: '#EDEFEC', accent: '#2F4A6D', accentSoft: '#DDE5EF',
    warning: '#9A6700', warningSoft: '#FAEEDA', danger: '#B3261E', dangerSoft: '#FBE9E7',
    success: '#1F6F4F', successSoft: '#E3F0EA', overlay: 'rgba(0,0,0,0.38)',
  },
  normal: {
    background: '#F5F7F4', surface: '#FFFFFF', ink: '#1E211E', muted: '#6B706B',
    line: '#E1E4DF', soft: '#ECEFEA', accent: '#1F6F4F', accentSoft: '#DCEBE2',
    warning: '#9A6700', warningSoft: '#FAEEDA', danger: '#B3261E', dangerSoft: '#FBE9E7',
    success: '#1F6F4F', successSoft: '#E3F0EA', overlay: 'rgba(0,0,0,0.38)',
  },
};

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const motion = {
  sheetDuration: 180,
  standardDuration: 140,
  levels: {
    standard: { pressScale: 0.98, spring: null, distance: 0, duration: 140 },
    enhanced: { pressScale: 0.97, spring: { mass: 1, damping: 17, stiffness: 250 }, distance: 6, duration: 180 },
    super: { pressScale: 0.95, spring: { mass: 1, damping: 10, stiffness: 300 }, distance: 10, duration: 180 },
  },
} as const;

export const providerColors = {
  alipay: '#1677FF', wechat: '#07C160', cmb: '#D71920', icbc: '#C7000B',
  ccb: '#0066B3', boc: '#B01F24', citic: '#E60012', douyin: '#161823',
  dewu: '#111111', jd: '#E1251B', meituan: '#F5B800',
};