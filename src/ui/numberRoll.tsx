/**
 * 余额数字滚动组件（v2）：三档可选的数字变化动效。
 * instant：直接跳变；flip：滚动翻牌（旧值上翻淡出、新值从下翻入，共 400ms）；pop：先缩后放。
 * 设置档位来自 preferences（numberRoll）。
 *
 * 注意：withTiming/withSpring 的完成回调在 Reanimated 4 里跑在 UI runtime 上，
 * 回调里任何 setState / JS 函数调用都必须经 runOnJS 转回 JS 线程，否则
 * 会抛 "[Worklets] Tried to synchronously call a Remote Function" 并直接崩溃。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { NumberRoll } from '../features/settings/preferences';

const FLIP_HALF_DURATION_MS = 200;
const POP_DOWN_DURATION_MS = 120;
const POP_SCALE_DOWN = 0.85;

export interface NumberRollTextProps {
  /** 展示字符串（如 ¥13,520.00）。 */
  value: string;
  mode: NumberRoll;
  /** 外层 Text 样式（字号/颜色/字重）。 */
  style?: object;
}

/** 滚动翻牌：两阶段——旧值上翻淡出，新值从下翻入。动画期间再变值则直接落到最终值。 */
function FlipText({ value, style }: { value: string; style?: object }) {
  const [shown, setShown] = useState(value);
  const [phase, setPhase] = useState<'still' | 'out' | 'in'>('still');
  const progress = useSharedValue(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const settle = useCallback(() => setPhase('still'), []);

  /** 第二阶段：新值从下翻入。由 UI runtime 经 runOnJS 回到这里。 */
  const startIn = useCallback(() => {
    setShown(valueRef.current);
    setPhase('in');
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: FLIP_HALF_DURATION_MS, easing: Easing.inOut(Easing.quad) },
      (finishedIn) => {
        if (finishedIn) runOnJS(settle)();
      },
    );
  }, [progress, settle]);

  useEffect(() => {
    if (value === shown) return;
    if (phaseRef.current !== 'still') {
      cancelAnimation(progress);
      progress.value = 0;
      setShown(value);
      setPhase('still');
      return;
    }
    setPhase('out');
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: FLIP_HALF_DURATION_MS, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(startIn)(); // 被取消则不推进，外部已置好 shown/phase
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, shown]);

  const outStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -18 * progress.value }],
    opacity: 1 - progress.value,
  }));
  const inStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 18 * (1 - progress.value) }],
    opacity: progress.value,
  }));

  const activeStyle = phase === 'out' ? outStyle : phase === 'in' ? inStyle : undefined;
  // 静止态必须用普通 Text：Animated.Text 一旦带 transform 就会被送进离屏图层，
  // 真机上文字会掉到约 75% 不透明度（实测纯色 #1A1408 渲染成 rgb(82,64,31)）。
  if (phase === 'still') {
    return <Text style={style}>{shown}</Text>;
  }
  return <Animated.Text style={[style, activeStyle]}>{shown}</Animated.Text>;
}

/** 先缩后放：缩小、换值、弹回。 */
function PopText({ value, style }: { value: string; style?: object }) {
  const [shown, setShown] = useState(value);
  const [animating, setAnimating] = useState(false);
  const scale = useSharedValue(1);
  const valueRef = useRef(value);
  valueRef.current = value;
  const busy = useRef(false);

  const finish = useCallback(() => {
    busy.current = false;
    setAnimating(false);
  }, []);

  /** 第二阶段：换值并弹回。 */
  const startSpring = useCallback(() => {
    setShown(valueRef.current);
    scale.value = 1;
    scale.value = withSpring(1, { damping: 9, stiffness: 220 }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [finish, scale]);

  const onShrunk = useCallback(() => {
    startSpring();
  }, [startSpring]);

  useEffect(() => {
    if (value === shown) return;
    if (busy.current) {
      cancelAnimation(scale);
      scale.value = 1;
      setShown(value);
      setAnimating(false);
      return;
    }
    busy.current = true;
    setAnimating(true);
    scale.value = withTiming(POP_SCALE_DOWN, { duration: POP_DOWN_DURATION_MS }, (finished) => {
      if (finished) runOnJS(onShrunk)();
      else runOnJS(finish)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, shown]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // 静止态用普通 Text：带 transform 的 Animated.Text 会进离屏图层，真机上文字掉到约 75% 不透明度。
  if (!animating) {
    return <Text style={style}>{shown}</Text>;
  }
  return <Animated.Text style={[style, animatedStyle]}>{shown}</Animated.Text>;
}

export function NumberRollText({ value, mode, style }: NumberRollTextProps) {
  if (mode === 'instant') {
    return <Text style={style}>{value}</Text>;
  }
  if (mode === 'flip') {
    return <FlipText value={value} style={style} />;
  }
  return <PopText value={value} style={style} />;
}
