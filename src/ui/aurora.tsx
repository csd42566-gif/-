/**
 * 背景底盘：浅色主题只铺米白底（方案 B 的干净纸面），暗色主题铺三层径向光晕。
 *
 * 实现说明（2026-11-17 实测）：
 * 整串 `radial-gradient(ellipse 80% 60% at -8% -6%, …)` 交给 RN 原生解析时，
 * 负百分比椭圆定位会退化成一团铺满屏幕的居中光，所以暗色下改成三个独立方块，
 * 每块只写最稳的 `radial-gradient(circle, …)`，位置和尺寸由普通 style 控制。
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

export interface AuroraProps {
  children: React.ReactNode;
  /** 内容容器样式（内边距交给调用方）。 */
  style?: StyleProp<ViewStyle>;
}

export function Aurora({ children, style }: AuroraProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const w = Math.round(width);
  const h = Math.round(height);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {theme.showGlow && (
        <>
          {/* 左上琥珀 */}
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: w * 0.98,
                height: w * 0.98,
                left: -w * 0.46,
                top: -w * 0.46,
                backgroundImage: theme.glowAmber,
              },
            ]}
          />
          {/* 右上蓝紫 */}
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: w * 0.78,
                height: w * 0.78,
                right: -w * 0.34,
                top: -w * 0.16,
                backgroundImage: theme.glowViolet,
              },
            ]}
          />
          {/* 底部薄荷 */}
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: w * 1.25,
                height: w * 1.25,
                left: -w * 0.12,
                bottom: -h * 0.3,
                backgroundImage: theme.glowMint,
              },
            ]}
          />
        </>
      )}
      <View style={[styles.content, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  glow: { position: 'absolute' },
  content: { flex: 1 },
});
