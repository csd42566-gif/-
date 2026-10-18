import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ProviderIconStyle } from '../../core/model/finance';
import { colors, providerColors, radius } from '../theme';

type FontAwesomeName = React.ComponentProps<typeof FontAwesome5>['name'];

const providerLogos: Record<string, { name: FontAwesomeName; color: string }> = {
  支付宝: { name: 'alipay', color: providerColors.alipay },
  微信: { name: 'weixin', color: providerColors.wechat },
  招商银行: { name: 'university', color: providerColors.cmb },
  工商银行: { name: 'university', color: providerColors.icbc },
  建设银行: { name: 'university', color: providerColors.ccb },
  中国银行: { name: 'university', color: providerColors.boc },
  中信银行: { name: 'credit-card', color: providerColors.citic },
  抖音: { name: 'tiktok', color: providerColors.douyin },
  京东: { name: 'shopping-cart', color: providerColors.jd },
  得物: { name: 'shopping-bag', color: providerColors.dewu },
  美团: { name: 'utensils', color: providerColors.meituan },
  手动记账: { name: 'edit', color: colors.accent },
};

const providerBadges: Record<string, { label: string; background: string }> = {
  支付宝: { label: '支', background: providerColors.alipay },
  微信: { label: '微', background: providerColors.wechat },
  招商银行: { label: '招', background: providerColors.cmb },
  工商银行: { label: '工', background: providerColors.icbc },
  建设银行: { label: '建', background: providerColors.ccb },
  中国银行: { label: '中', background: providerColors.boc },
  中信银行: { label: '信', background: providerColors.citic },
  抖音: { label: '抖', background: providerColors.douyin },
  得物: { label: '得', background: providerColors.dewu },
  京东: { label: '京', background: providerColors.jd },
  美团: { label: '美', background: providerColors.meituan },
  手动记账: { label: '记', background: colors.accent },
};

export function ProviderBadge({ provider, mode, size = 30 }: { provider: string; mode: ProviderIconStyle; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size >= 40 ? radius.md : radius.sm };
  if (mode === 'logo') {
    const logo = providerLogos[provider] ?? { name: 'ellipsis-h' as const, color: colors.muted };
    return <View style={[styles.logo, shape, { borderColor: logo.color }]}><FontAwesome5 name={logo.name} size={Math.round(size * 0.57)} color={logo.color} /></View>;
  }
  const badge = providerBadges[provider] ?? { label: provider.slice(0, 1) || '账', background: colors.muted };
  return <View style={[styles.badge, shape, { backgroundColor: badge.background }]}><Text style={[styles.badgeText, { fontSize: Math.round(size * 0.47) }]}>{badge.label}</Text></View>;
}

const styles = StyleSheet.create({
  logo: { borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '900', color: colors.surface },
});