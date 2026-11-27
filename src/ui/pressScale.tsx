/**
 * 按压反馈（统一手感）：缩放 + 压暗 + 可选触感。
 *
 * 背景：全项目 61 个 `Pressable` 原来只有 dock 的记账钮有按压缩放，其余按下毫无回应——
 * 用户点 chip、点胶囊按钮、点列表项时，界面不给任何「我收到了」的信号。
 *
 * 实现上直接给 Pressable 套 `createAnimatedComponent`，而不是外面再包一层
 * `Animated.View`——包一层会多一个 flex 容器，原来靠 `flex:1`、`alignSelf`、
 * `marginTop` 参与父级排版的按钮会全部错位。
 *
 * 弹簧口径与 `src/core/ui/springProfile.ts` 一致（ζ≈0.9，不来回摆）：按下更硬
 * （stiffness 420）保证跟手，松手稍软（280）让回弹有余韵。
 *
 * 触感：默认 `haptic="light"`（chip、胶囊这类轻动作），记账保存、删除确认这类
 * 重动作用 `haptic="medium"`。安卓侧 expo-haptics 走 Vibrator，不支持时静默降级。
 */

import React from 'react';
import { Platform } from 'react-native';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressHaptic = 'none' | 'light' | 'medium' | 'success' | 'warning';

/** 只在这些档位上真的触发；其余（含 disabled）静默跳过。 */
export function fireHaptic(kind: PressHaptic): void {
  if (kind === 'none') return;
  /* 触感失败不该影响点击——用户看不到震动时按钮仍然要正常响应。 */
  try {
    if (kind === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (kind === 'medium') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (kind === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    /* 不支持触感的设备/权限缺失，忽略 */
  }
}

export type PressScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** 按下时的缩放倍率，默认 0.96；小圆钮这类小元素用 0.9 更有感。 */
  pressedScale?: number;
  /** 按下时的不透明度，默认 0.94。 */
  pressedOpacity?: number;
  /** 触感强度，默认 light。`none` 表示不震（列表行这类高频触点建议关掉）。 */
  haptic?: PressHaptic;
};

export function PressScale({
  style,
  pressedScale = 0.96,
  pressedOpacity = 0.94,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressScaleProps) {
  const scale = useSharedValue(1);
  const fade = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: fade.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(pressedScale, { damping: 24, stiffness: 420 });
          fade.value = withSpring(pressedOpacity, { damping: 24, stiffness: 420 });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) {
          scale.value = withSpring(1, { damping: 18, stiffness: 280 });
          fade.value = withSpring(1, { damping: 18, stiffness: 280 });
        }
        onPressOut?.(e);
      }}
      onPress={(e) => {
        /* 震动放在 onPress 而不是 onPressIn：手指按下又滑走取消点击时不该震。 */
        if (!disabled && Platform.OS !== 'web') fireHaptic(haptic);
        onPress?.(e);
      }}
    />
  );
}
