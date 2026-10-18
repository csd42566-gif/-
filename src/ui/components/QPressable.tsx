import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { MotionLevel } from '../../core/model/finance';
import { motion } from '../theme';

type QPressableProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  motionLevel: MotionLevel;
  containerStyle: StyleProp<ViewStyle>;
  style?: PressableProps['style'];
};

export function QPressable({ children, motionLevel, containerStyle, style, disabled, onPressIn, onPressOut, ...rest }: QPressableProps) {
  const config = motion.levels[motionLevel];
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const pressIn = () => {
    scale.stopAnimation();
    Animated.timing(scale, { toValue: config.pressScale, duration: config.duration, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    scale.stopAnimation();
    if (!config.spring) {
      Animated.timing(scale, { toValue: 1, duration: config.duration, useNativeDriver: true }).start();
      return;
    }
    Animated.spring(scale, { toValue: 1, ...config.spring, useNativeDriver: true }).start();
  };
  return <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => { if (!disabled) pressIn(); onPressIn?.(event); }}
      onPressOut={(event) => { pressOut(); onPressOut?.(event); }}
      style={style}
    >{children}</Pressable>
  </Animated.View>;
}