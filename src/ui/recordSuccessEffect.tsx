/**
 * 记账成功动效组件（方案 B）：三档可选（决策 32）。
 * clean：无特别动效，交给页面转场。
 * swift：保存成功后表单"咻"地收成一个点飞向底部（模拟飞向流水列表）。
 * dramatic：保存瞬间屏幕中心炸开暖橙光点，涟漪荡开。
 * 播放完成后调 onDone。
 *
 * 注意：withTiming/withSpring 的完成回调用 runOnJS 转回 JS 线程后再调 onDone，
 * 直接在 UI runtime 里调 JS 回调会抛 "[Worklets] Tried to synchronously call a Remote Function"。
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { RecordSuccessAnimation } from '../features/settings/preferences';
import { useTheme } from './theme';

export interface RecordSuccessEffectProps {
  mode: RecordSuccessAnimation;
  onDone: () => void;
}

export function RecordSuccessEffect({ mode, onDone }: RecordSuccessEffectProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  useEffect(() => {
    if (mode === 'clean') {
      onDone();
      return;
    }
    if (mode === 'swift') {
      scale.value = 1;
      opacity.value = 1;
      translateY.value = 0;
      scale.value = withTiming(0.05, { duration: 220, easing: Easing.in(Easing.quad) });
      translateY.value = withTiming(260, { duration: 260, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(
        0,
        { duration: 240, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
      return;
    }
    // dramatic：光点从中心炸开 + 涟漪
    burstScale.value = 0;
    burstOpacity.value = 0.9;
    burstScale.value = withSpring(2.6, { damping: 12, stiffness: 160 });
    burstOpacity.value = withTiming(
      0,
      { duration: 560, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstScale.value }],
    opacity: burstOpacity.value,
  }));
  const flyStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (mode === 'clean') return null;

  if (mode === 'swift') {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.swiftDot, { backgroundColor: theme.amber }, flyStyle]}
      />
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.burstRing, { borderColor: theme.amber }, ringStyle]}
    >
      <Animated.View style={[styles.burstCore, { backgroundColor: theme.amber }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swiftDot: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
  },
  burstRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginLeft: -60,
    marginTop: -60,
    borderRadius: 60,
    borderWidth: 3,
  },
  burstCore: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
  },
});
