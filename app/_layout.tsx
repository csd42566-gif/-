/**
 * 根布局（方案 B 定稿）：路由注册 + StatusBar 跟随主题 + 页面转场三档（决策 34）。
 * 转场档位存 MMKV：slide → slide_from_right、card → slide_from_bottom、shared → fade。
 *
 * 方案 B 的二级页自己画顶部导航（圆形白钮返回 + 「设置 · 管理」面包屑 + 大标题），
 * 所以这里一律 headerShown: false，不再让原生 header 叠一层返回箭头。
 */

import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { StackAnimationTypes } from 'react-native-screens';

import { useSettingsStore } from '../src/features/settings/settingsStore';
import { statusBarStyleFor, useTheme } from '../src/ui/theme';
import type { PageTransition } from '../src/features/settings/preferences';

const TRANSITION_ANIMATION: Record<PageTransition, StackAnimationTypes> = {
  slide: 'slide_from_right',
  card: 'slide_from_bottom',
  shared: 'fade',
};

/**
 * 详情页在「共享元素」档下关掉整页转场。
 * 现在这一档是「点的那一行自己撑开成详情卡」（src/ui/morphDetail.tsx）：
 * 形变在概览页的覆盖层里完成，形变结束后才 push 进详情页，此时整页再滑一次会破坏衔接。
 * 其余两档照常走导航器动画。
 */
const DETAIL_ANIMATION: Record<PageTransition, StackAnimationTypes> = {
  slide: 'slide_from_right',
  card: 'slide_from_bottom',
  shared: 'none',
};

export default function Layout() {
  const themeMode = useSettingsStore((s) => s.theme);
  const pageTransition = useSettingsStore((s) => s.pageTransition);
  const systemScheme = useColorScheme();
  const palette = useTheme();

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={statusBarStyleFor(themeMode, systemScheme)} />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: TRANSITION_ANIMATION[pageTransition],
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          {/*
            记一笔是一条贴在底部、可以拖着换档的面板（src/ui/bottomSheet.tsx）。
            所以这屏让出整块背景：透明 + 关掉整页转场，入场完全由面板自己的弹簧负责，
            否则原生转场和面板弹簧会叠成两层动画。
          */}
          <Stack.Screen
            name="add"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="stats" options={{ headerShown: false }} />
          <Stack.Screen name="goals" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="accounts" options={{ headerShown: false }} />
          <Stack.Screen name="categories" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen
            name="transaction/[id]"
            options={{ headerShown: false, animation: DETAIL_ANIMATION[pageTransition] }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
