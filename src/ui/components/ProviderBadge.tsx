import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ProviderIconStyle } from '../../core/model/finance';
import { manualProviderLabel, providerLabels } from '../../core/model/providers';
import { providerColors, radius, ThemeColors } from '../theme';
import { useTheme } from '../ThemeContext';
import { useThemedStyles } from '../hooks/useThemedStyles';

type FontAwesomeName = React.ComponentProps<typeof FontAwesome5>['name'];

const providerLogos: Record<string, { name: FontAwesomeName; color: string }> = {
  [providerLabels.alipay]: { name: 'alipay', color: providerColors.alipay },
  [providerLabels.wechat]: { name: 'weixin', color: providerColors.wechat },
  [providerLabels.cmb]: { name: 'university', color: providerColors.cmb },
  [providerLabels.icbc]: { name: 'university', color: providerColors.icbc },
  [providerLabels.ccb]: { name: 'university', color: providerColors.ccb },
  [providerLabels.boc]: { name: 'university', color: providerColors.boc },
  [providerLabels.citic]: { name: 'credit-card', color: providerColors.citic },
  [providerLabels.douyin]: { name: 'tiktok', color: providerColors.douyin },
  [providerLabels.jd]: { name: 'shopping-cart', color: providerColors.jd },
  [providerLabels.dewu]: { name: 'shopping-bag', color: providerColors.dewu },
  [providerLabels.meituan]: { name: 'utensils', color: providerColors.meituan },
};

const providerBadges: Record<string, { label: string; background: string }> = {
  [providerLabels.alipay]: { label: '支', background: providerColors.alipay },
  [providerLabels.wechat]: { label: '微', background: providerColors.wechat },
  [providerLabels.cmb]: { label: '招', background: providerColors.cmb },
  [providerLabels.icbc]: { label: '工', background: providerColors.icbc },
  [providerLabels.ccb]: { label: '建', background: providerColors.ccb },
  [providerLabels.boc]: { label: '中', background: providerColors.boc },
  [providerLabels.citic]: { label: '信', background: providerColors.citic },
  [providerLabels.douyin]: { label: '抖', background: providerColors.douyin },
  [providerLabels.dewu]: { label: '得', background: providerColors.dewu },
  [providerLabels.jd]: { label: '京', background: providerColors.jd },
  [providerLabels.meituan]: { label: '美', background: providerColors.meituan },
};

export function ProviderBadge({ provider, mode, size = 30 }: { provider: string; mode: ProviderIconStyle; size?: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: size >= 40 ? radius.md : radius.sm };
  if (mode === 'logo') {
    const logo = provider === manualProviderLabel ? { name: 'edit' as const, color: colors.accent } : providerLogos[provider] ?? { name: 'ellipsis-h' as const, color: colors.muted };
    return <View style={[styles.logo, shape, { borderColor: logo.color }]}><FontAwesome5 name={logo.name} size={Math.round(size * 0.57)} color={logo.color} /></View>;
  }
  const badge = provider === manualProviderLabel ? { label: '记', background: colors.accent } : providerBadges[provider] ?? { label: provider.slice(0, 1) || '账', background: colors.muted };
  return <View style={[styles.badge, shape, { backgroundColor: badge.background }]}><Text style={[styles.badgeText, { fontSize: Math.round(size * 0.47) }]}>{badge.label}</Text></View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  logo: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '900', color: colors.surface },
  });
}

