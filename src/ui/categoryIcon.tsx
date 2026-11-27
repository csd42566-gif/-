/**
 * 分类图标（v2）：把种子/自定义分类的 icon 键名映射到 MaterialCommunityIcons 字形。
 * 无匹配键名回退 help-circle-outline，不吞错误（未知名直接显示回退图标而非崩溃）。
 * 决策 25：流水行默认显示「分类图标 + 备注 + 金额」。
 */

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from './theme';

type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const GLYPHS: Record<string, GlyphName> = {
  // 支出大类
  rice: 'rice',
  bus: 'bus',
  bag: 'shopping',
  home: 'home',
  game: 'gamepad-variant',
  more: 'dots-horizontal',
  // 吃饭小类
  sunrise: 'weather-sunset-up',
  sun: 'white-balance-sunny',
  moon: 'weather-night',
  delivery: 'silverware-fork-knife',
  people: 'account-group',
  // 交通小类
  metro: 'subway-variant',
  car: 'taxi',
  gas: 'gas-station',
  // 购物小类
  shirt: 'tshirt-crew',
  phone: 'cellphone',
  sofa: 'sofa',
  // 日用小类
  bolt: 'lightning-bolt',
  soap: 'bottle-tonic',
  // 娱乐小类
  joystick: 'gamepad',
  video: 'movie-open',
  barbell: 'dumbbell',
  // 收入
  salary: 'cash-multiple',
  laptop: 'laptop',
  receipt: 'receipt',
  // 账户
  wechat: 'wechat',
  alipay: 'alpha-a-circle',
  bank: 'bank',
  // 转账
  transfer: 'bank-transfer',
};

export interface CategoryIconProps {
  /** 分类/账户的 icon 键名；空字符串或未知名回退默认图标。 */
  icon: string;
  size?: number;
  color?: string;
}

export function CategoryIcon({ icon, size = 18, color }: CategoryIconProps) {
  const theme = useTheme();
  const glyph = icon !== '' && GLYPHS[icon] !== undefined ? GLYPHS[icon] : 'help-circle-outline';
  return <MaterialCommunityIcons name={glyph} size={size} color={color ?? theme.text} />;
}
