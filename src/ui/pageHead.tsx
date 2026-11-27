/**
 * 页头（方案 B 定稿）：kicker 小字距标签 + 大标题 + 右侧可选圆钮。
 *
 * 原型 `.headKicker` 16px / 字距 3.4、`.headTitle` 52px / 字距 -1.2、`.roundBtn` 68px，
 * 按 `.phone` 760px → 411dp 的系数 0.5414 折算：8.7dp / 1.84 字距 / 28.2dp / 36.8dp。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme';

export interface PageHeadProps {
  /** 标题上方的小字，如「账本 · 本月」。传空串则不渲染。 */
  kicker: string;
  /** 大标题，如「概览」。 */
  title: string;
  /** 标题下方的一行补充说明。 */
  sub?: string;
  /** 右侧动作区，通常是圆形白钮。 */
  action?: React.ReactNode;
}

export function PageHead({ kicker, title, sub, action }: PageHeadProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        {kicker !== '' && (
          <Text style={[styles.kicker, { color: theme.accent }]}>{kicker}</Text>
        )}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {sub !== undefined && (
          <Text style={[styles.sub, { color: theme.faint }]}>{sub}</Text>
        )}
      </View>
      {action !== undefined && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  texts: { flex: 1, minWidth: 0 },
  // 三处都必须关掉安卓默认 font padding 并写死 lineHeight：
  // 不写的话每行多出约 1.2–1.5dp 的上下留白，kicker→标题的间隙会从 11.9dp 涨到 14.8dp，
  // 整块页头被推低，主卡跟着下移 3dp（与设计稿对不上的根因）。
  kicker: {
    fontSize: 8.7,
    fontWeight: '700',
    letterSpacing: 1.84,
    includeFontPadding: false,
    lineHeight: 11.0,
  },
  title: {
    fontSize: 28.2,
    fontWeight: '800',
    letterSpacing: -0.65,
    marginTop: 7.6,
    includeFontPadding: false,
    lineHeight: 33.8,
  },
  sub: {
    fontSize: 9.7,
    marginTop: 3,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 12.0,
  },
  action: { paddingBottom: 6 },
});
