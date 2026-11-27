/**
 * 底部 dock（Pocket 参考定稿 2026-11-19）：无胶囊底色，五项直接排在米白页面上。
 * 选中项 = 深色图标 + 粗体深色文字；未选中 = 浅灰。
 * 记账钮 = 深绿圆角方块（参考 ~28% 圆角，不是全圆）。
 *
 * 五个格子全部 flex:1，包括中间的记账钮——按钮不额外占宽，
 * 否则左右两组会被挤成不等分（用户 2026-11-17 批注过「间隔要调整」）。
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { RADIUS, useTheme, type ThemeColors } from './theme';
import { PressScale } from './pressScale';

export type DockTab = 'overview' | 'insight' | 'goals' | 'settings';

export interface BottomDockProps {
  /** 当前页；记账页等模态页传 null。 */
  active: DockTab | null;
  /** 概览页点「概览」要滚回顶部，其他页只做跳转。 */
  onOverviewPress?: () => void;
  /** 安全区底部内边距。 */
  bottomInset: number;
}

/** dock 里的图标：原型 27px → 14.6dp，描边 2dp。 */
function DockIcon({ tab, color }: { tab: DockTab; color: string }) {
  switch (tab) {
    case 'overview':
      return (
        <Svg width={14.6} height={14.6} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={4} width={7} height={7} rx={1.6} stroke={color} strokeWidth={2} />
          <Rect x={13} y={4} width={7} height={7} rx={1.6} stroke={color} strokeWidth={2} />
          <Rect x={4} y={13} width={7} height={7} rx={1.6} stroke={color} strokeWidth={2} />
          <Rect x={13} y={13} width={7} height={7} rx={1.6} stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'insight':
      return (
        <Svg width={14.6} height={14.6} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 19V11M12 19V5M19 19V14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'goals':
      return (
        <Svg width={14.6} height={14.6} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={14.6} height={14.6} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
        </Svg>
      );
  }
}

export function BottomDock({ active, onOverviewPress, bottomInset }: BottomDockProps) {
  const theme = useTheme();
  const router = useRouter();

  const item = (tab: DockTab, label: string, onPress: () => void) => {
    const on = active === tab;
    return (
      <PressScale
        style={[styles.item, on && theme.tabOn]}
        pressedScale={0.92}
        haptic="light"
        onPress={onPress}
        accessibilityLabel={label}
      >
        <DockIcon tab={tab} color={on ? theme.text : theme.faint} />
        <Text style={[styles.label, on ? styles.labelOn : null, { color: on ? theme.text : theme.faint }]}>{label}</Text>
      </PressScale>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 14 }]} pointerEvents="box-none">
      <View style={[styles.dock, theme.dock]}>
        {item('overview', '概览', () => {
          if (onOverviewPress) onOverviewPress();
          else router.replace('/');
        })}
        {item('insight', '洞察', () => {
          if (active !== 'insight') router.replace('/stats');
        })}
        <View style={styles.fab}>
          <RecordButton theme={theme} onPress={() => router.push('/add')} />
        </View>
        {item('goals', '目标', () => {
          if (active !== 'goals') router.replace('/goals');
        })}
        {item('settings', '资料', () => {
          if (active !== 'settings') router.replace('/settings');
        })}
      </View>
    </View>
  );
}

/** dock 中央的记账钮：深绿圆角方块。按压反馈统一走 PressScale（缩放 + medium 触感）。 */
function RecordButton({ theme, onPress }: { theme: ThemeColors; onPress: () => void }) {
  return (
    <PressScale
      pressedScale={0.9}
      haptic="medium"
      style={[styles.recordButton, { backgroundImage: theme.purpleGradient, backgroundColor: theme.purple }]}
      accessibilityLabel="记一笔"
      onPress={onPress}
    >
      <Text style={styles.recordButtonText}>+</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 5.4,
    paddingVertical: 4.3,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.7,
    paddingVertical: 4.9,
    borderRadius: RADIUS.pill,
  },
  fab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '700', letterSpacing: 0.16 },
  labelOn: { fontWeight: '800' },
  recordButton: {
    width: 44.4,
    height: 44.4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 22px rgba(32,60,52,0.32)',
  },
  recordButtonText: { fontSize: 23.3,
    includeFontPadding: false, fontWeight: '500', lineHeight: 26, color: '#FFFFFF' },
});
