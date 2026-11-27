/**
 * 主题（v2 · Pocket 参考定稿 2026-11-19）：浅色为默认，暗色是可选。
 *
 * 用户给出五屏参考（Overview / Insights / Add / Goals / Profile，深绿主卡），
 * 所以浅色是主设计，暗色保留成「夜间变体」：把白卡换成玻璃、米白换成近黑。
 *
 * 视觉语言（浅色，全部采样自参考图）：
 * - 底色 #F8F4F0 米白，无光晕（Aurora 在浅色下只铺平底色）。
 * - 主卡是深绿实色 #203C34（采样众数），白字；徽章浅绿 #CCD8BC。
 * - 普卡是 #FCFCFC + 1px 极淡边 + 内高光 + 软投影 + 大圆角。
 * - 分段控件轨道 #ECECE4 + 白色选中块。
 * - 强调色分两层：accent #2E5949 用于浅底上的文字/图标；amber #203C34 用于填充块。
 * - dock 无胶囊底（米白页面上直接排图标），选中项深色加粗，fab 深绿圆角方块。
 * 字段名 amber/purple 保留（历史语义），只改值——其他文件不用动。
 */

import type { ViewStyle } from 'react-native';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../features/settings/settingsStore';
import type { ThemeMode } from '../features/settings/preferences';

export interface ThemeColors {
  /** 页面底色。 */
  bg: string;
  /** 是否铺三层光晕（只有暗色铺）。 */
  showGlow: boolean;
  glowAmber: string;
  glowViolet: string;
  glowMint: string;

  /** 白卡（语义：次级卡片）。 */
  card: ViewStyle;
  /** 卡内浅灰块（输入框、轨道、chip 底）。 */
  cardAlt: ViewStyle;
  /** 琥珀实色主卡。 */
  heroCard: ViewStyle;
  /** dock 胶囊。 */
  dock: ViewStyle;
  /** 选中态胶囊（紫色软底）。 */
  tabOn: ViewStyle;

  /** 主色填充（进度条、选中块）。 */
  amber: string;
  /** 主色渐变（按钮）。 */
  amberGradient: string;
  /** 主色上的文字。 */
  onAmber: string;
  /** 浅底上的深琥珀强调色（文字/图标）。 */
  accent: string;
  /** 深琥珀软底（选中 chip）。 */
  accentSoft: string;
  /**
   * 小节标签色。
   *
   * 浅色下和 accent 一样是深绿（在米白上够暗、像标签）；
   * 暗色下必须比 accent 更暗一档——accent 在暗底上是亮绿 #A9C4AC，
   * 直接拿来当小节标题会比正文还抢眼（实测「钱 / 外观 / 动效」亮得盖过内容）。
   */
  sectionLabel: string;

  /** 主卡上的文字与分隔。 */
  heroText: string;
  heroMuted: string;
  heroLine: string;
  heroTrack: string;
  heroFill: string;
  /** 主卡弹性线网的描边色：主卡是琥珀实色，浅深两套底色不同，网格线要各自配。 */
  heroGrid: string;

  /** dock 选中态紫。 */
  purple: string;
  purpleSoft: string;
  purpleGradient: string;

  text: string;
  muted: string;
  faint: string;
  ghost: string;
  line: string;
  /** 拖拽把手 / 关闭钮这类「压在卡片上的中性小块」的底色，深色主题要提亮。 */
  handle: string;
  /**
   * 开关关态轨道 / 未选圆点的描边色。
   * 浅色是淡黑；暗色必须提到 0.30 以上 —— 0.16 铺在 0.06 的玻璃卡上实测几乎不可见
   * （像素最亮只有 62,65,64，卡底 25,29,27），用户看不出「这里有个可以点的圆」。
   */
  switchOff: string;
  expense: string;
  income: string;
  /** 图表/分类配色（柔彩 6 色）。 */
  chart: string[];
  /** 分类卡三底色（吃饭 / 购物 / 交通 式的柔块）。 */
  tint: string[];
  /** 与 tint 一一对应的名字色（设计稿每块用同色系的深调）。 */
  tintInk: string[];
  /** 与 tint 一一对应的金额色（比名字色更深一档）。 */
  tintInkStrong: string[];
}

/** 柔彩 6 色：浅色主题的分类/图表色（参考图的柔绿灰系）。 */
const LIGHT_CHART = ['#8FAF92', '#B7C9AE', '#5E7F6B', '#A9BFA0', '#C9D8C4', '#6E8F7C'];
/** 对应浅色底（分类卡的块底色）：参考图 Top categories 是白卡 + 浅绿灰图标底。 */
const LIGHT_TINT = ['#EEF1E9', '#F0EAE2', '#E7EAE4', '#E9EDE6', '#F0ECE3', '#EAE9E1'];
/** 浅色块上的分类名色（同色系深调）。 */
const LIGHT_TINT_INK = ['#3D4A42', '#5C4A3D', '#44504A', '#3F4A50', '#504A3D', '#4A4A42'];
/** 浅色块上的金额色（再深一档）。 */
const LIGHT_TINT_INK_STRONG = ['#22302A', '#3A2A20', '#26332C', '#243036', '#332D20', '#2E2E26'];

const DARK_CHART = ['#8FAF92', '#B7C9AE', '#5E7F6B', '#A9BFA0', '#C9D8C4', '#6E8F7C'];
const DARK_TINT = ['#1C2620', '#26201A', '#1A211D', '#18211E', '#242019', '#1F1F1B'];
/** 暗色块上的文字与金额色（亮色系，保持可读）。 */
const DARK_TINT_INK = ['#A9C4AC', '#D8C4A9', '#A9C0B2', '#A9BFC4', '#D4C4A9', '#C4C4A9'];
const DARK_TINT_INK_STRONG = ['#C9E0CC', '#EADCC4', '#C4DCCE', '#C4DCE2', '#E6D6C4', '#DCDCC4'];

const LIGHT_GLOW_AMBER = 'radial-gradient(circle, rgba(46,89,73,0.18), rgba(46,89,73,0) 64%)';
const LIGHT_GLOW_VIOLET = 'radial-gradient(circle, rgba(124,139,255,0.10), rgba(124,139,255,0) 64%)';
const LIGHT_GLOW_MINT = 'radial-gradient(circle, rgba(95,227,155,0.08), rgba(95,227,155,0) 66%)';

/** 深绿实色主卡（采样自参考图 #203C34）。 */
const GREEN = '#203C34';
/** 深绿卡上的浅绿（进度条填充、徽章底，采样 #CCD8BC）。 */
const GREEN_SOFT = '#CCD8BC';
/** 主色填充：深绿进度条。 */
const HERO_FILL = 'linear-gradient(90deg, #CCD8BC, #CCD8BC)';

export const LIGHT_THEME: ThemeColors = {
  bg: '#F8F4F0',
  showGlow: false,
  glowAmber: LIGHT_GLOW_AMBER,
  glowViolet: LIGHT_GLOW_VIOLET,
  glowMint: LIGHT_GLOW_MINT,

  card: {
    backgroundColor: '#FCFCFC',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 30px rgba(0,0,0,0.05)',
  },
  cardAlt: {
    backgroundColor: '#ECECE4',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  heroCard: {
    backgroundColor: GREEN,
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: '0 14px 30px rgba(32,60,52,0.24)',
  },
  dock: {
    backgroundColor: 'rgba(248,244,240,0.985)',
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  },
  tabOn: { backgroundColor: '#FFFFFF' },

  amber: GREEN,
  amberGradient: 'linear-gradient(160deg, #2A4A3F, #203C34)',
  onAmber: '#F8F4F0',
  accent: '#2E5949',
  accentSoft: 'rgba(32,60,52,0.08)',
  sectionLabel: '#2E5949',

  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.62)',
  heroLine: 'rgba(255,255,255,0.16)',
  heroTrack: 'rgba(255,255,255,0.22)',
  heroFill: HERO_FILL,
  /* 深绿卡上的网格线用半透明白。 */
  heroGrid: 'rgba(255,255,255,0.10)',

  purple: GREEN,
  purpleSoft: '#ECECE4',
  purpleGradient: 'linear-gradient(160deg, #2A4A3F, #203C34)',

  text: '#1D2420',
  muted: '#5F6B63',
  faint: '#8C948D',
  ghost: '#B0B6B0',
  line: 'rgba(0,0,0,0.06)',
  handle: 'rgba(0,0,0,0.14)',
  switchOff: '#D8D8D0',
  expense: '#C96F5A',
  income: '#4C7A5C',
  chart: LIGHT_CHART,
  tint: LIGHT_TINT,
  tintInk: LIGHT_TINT_INK,
  tintInkStrong: LIGHT_TINT_INK_STRONG,
};

export const DARK_THEME: ThemeColors = {
  bg: '#0B0F0D',
  showGlow: true,
  glowAmber: 'radial-gradient(circle, rgba(46,89,73,0.30), rgba(46,89,73,0) 62%)',
  glowViolet: 'radial-gradient(circle, rgba(124,139,255,0.10), rgba(124,139,255,0) 60%)',
  glowMint: 'radial-gradient(circle, rgba(95,227,155,0.06), rgba(95,227,155,0) 58%)',

  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 18px 40px rgba(0,0,0,0.35)',
  },
  cardAlt: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  heroCard: {
    backgroundColor: '#16302A',
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: '0 14px 30px rgba(0,0,0,0.4)',
  },
  dock: {
    /* 暗色下必须近乎不透明：RN 没有 backdropFilter，半透明胶囊会让底下滚过的流水文字直接透出来。 */
    backgroundColor: 'rgba(14,18,16,0.985)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 34px rgba(0,0,0,0.62)',
  },
  tabOn: { backgroundColor: 'rgba(204,216,188,0.16)' },

  amber: '#2A4A3F',
  amberGradient: 'linear-gradient(160deg, #2E544A, #1C3830)',
  onAmber: '#F8F4F0',
  accent: '#A9C4AC',
  accentSoft: 'rgba(169,196,172,0.12)',
  /* 比 accent 暗两档：暗底上当小节标题不能抢过正文。 */
  sectionLabel: 'rgba(169,196,172,0.72)',

  heroText: '#FFFFFF',
  heroMuted: 'rgba(255,255,255,0.62)',
  heroLine: 'rgba(255,255,255,0.16)',
  heroTrack: 'rgba(255,255,255,0.22)',
  heroFill: HERO_FILL,
  heroGrid: 'rgba(255,255,255,0.10)',

  purple: '#A9C4AC',
  purpleSoft: 'rgba(169,196,172,0.14)',
  purpleGradient: 'linear-gradient(160deg, #2E544A, #1C3830)',

  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.42)',
  ghost: 'rgba(255,255,255,0.28)',
  line: 'rgba(255,255,255,0.09)',
  handle: 'rgba(255,255,255,0.22)',
  switchOff: 'rgba(255,255,255,0.34)',
  expense: '#E8A18F',
  income: '#8FC4A5',
  chart: DARK_CHART,
  tint: DARK_TINT,
  tintInk: DARK_TINT_INK,
  tintInkStrong: DARK_TINT_INK_STRONG,
};

/**
 * 圆角尺度：原型 `mockups/*.html` 的 `.phone` 宽 760px 对应 411dp 屏，换算系数 0.5414。
 * 下表每个值都注明原型 CSS 原值，避免再出现「照抄 px 数字」把圆角放大的问题。
 */
export const RADIUS = {
  /** 琥珀实色主卡：原型 40px → 21.7dp。 */
  hero: 22,
  /** 大白卡（账户合计卡、目标卡、洞察卡）：原型 34–36px → 18.4–19.5dp。 */
  card: 20,
  /** 次级卡（分类卡、留意卡、字段行、日历）：原型 26–30px → 14.1–16.2dp。 */
  cardSm: 15,
  /** 分类三彩卡：原型 28px → 15.2dp。 */
  tri: 15,
  pill: 999,
  /** 输入框 / chip / 记账页宫格：原型 22–24px → 11.9–13dp。 */
  chip: 12,
  /** 更小的图标块：原型 20px → 10.8dp。 */
  row: 11,
} as const;

/** 组件里用 useTheme() 拿当前色板，主题切换全 App 立即生效。 */
export function useTheme(): ThemeColors {
  const mode = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();
  return resolveThemeMode(mode, systemScheme) === 'light' ? LIGHT_THEME : DARK_THEME;
}

/** 'system' 跟随系统深浅色；其余原样返回。systemScheme 为 null 时按浅色处理。 */
export function resolveThemeMode(mode: ThemeMode, systemScheme?: 'light' | 'dark' | null): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

/** StatusBar 用：暗色主题亮字，浅色主题暗字。 */
export function statusBarStyleFor(mode: ThemeMode, systemScheme?: 'light' | 'dark' | null): 'light' | 'dark' {
  return resolveThemeMode(mode, systemScheme) === 'dark' ? 'light' : 'dark';
}
