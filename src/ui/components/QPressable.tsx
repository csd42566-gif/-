import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type QPressableProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  reducedMotion: boolean;
  containerStyle: StyleProp<ViewStyle>;
  style?: PressableProps['style'];
};

export function QPressable({ children, reducedMotion, containerStyle, style, disabled, onPressIn, onPressOut, ...rest }: QPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const pressIn = () => {
    scale.stopAnimation();
    if (reducedMotion) { scale.setValue(1); return; }
    Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    scale.stopAnimation();
    if (reducedMotion) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 300, useNativeDriver: true }).start();
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