/**
 * 顶部压边：列表滚到状态栏底下时，内容会跟时间、信号图标叠在一起。
 *
 * 分两段：状态栏等高铺实色（挡住滚上来的内容），下面再接 8dp 渐隐，
 * 让裁切边不至于像刀切在字上。8dp 是算过的——各页 `paddingTop = insets.top + 12`，
 * 静止时首行文字落在渐隐带下沿之外，不会被压暗。
 *
 * `top` 传 insets.top，别写死。pointerEvents="none"。
 */

import React from 'react';
import { View } from 'react-native';

import { useTheme } from './theme';

const FADE_HEIGHT = 8;

export function TopFade({ top }: { top: number }) {
  const theme = useTheme();
  const { r, g, b } = parseHex(theme.bg);
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: top,
          backgroundColor: theme.bg,
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top,
          height: FADE_HEIGHT,
          backgroundImage: `linear-gradient(180deg, rgba(${r},${g},${b},1), rgba(${r},${g},${b},0))`,
        }}
        pointerEvents="none"
      />
    </>
  );
}

/** 主题底色只在浅色 #RRGGBB 与暗色 #RRGGBB 之间取值，解析失败回退米白。 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { r: 247, g: 245, b: 240 };
  }
  return { r, g, b };
}
