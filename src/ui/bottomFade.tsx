/**
 * 底部渐隐：内容滚到 dock 后面时自然淡出，避免文字被胶囊硬切断。
 *
 * 高度与位置不写死，由调用方按 dock 实际占据的高度传 `bottom`：
 * dock 胶囊顶边 ≈ insets.bottom + 72（方案 B 定稿：胶囊高 57 + 底距 15）。
 *
 * 分两段：dock 下方到底边铺实色（否则流水/对比条会从胶囊底下露出半截），
 * dock 上方再叠 56dp 的渐隐带。两段都 pointerEvents="none"，
 * 且必须在 BottomDock 之前渲染，否则会盖住胶囊。
 */

import React from 'react';
import { View } from 'react-native';

import { useTheme } from './theme';

/* 原型 `.fade { height:80px }` × K=0.5414 = 43dp；56 会把最后两组流水压灰。 */
const FADE_HEIGHT = 43;

export function BottomFade({ bottom }: { bottom: number }) {
  const theme = useTheme();
  const { r, g, b } = parseHex(theme.bg);
  /* 实色段必须完全不透明：0.97 也会让底下滚过去的金额漏出 3%，深色主题下尤其明显。 */
  const solid = `rgb(${r},${g},${b})`;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bottom,
          backgroundColor: solid,
        }}
        pointerEvents="none"
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom,
          height: FADE_HEIGHT,
          backgroundImage: `linear-gradient(180deg, rgba(${r},${g},${b},0), ${solid})`,
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
