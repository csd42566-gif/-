import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Keyboard } from 'react-native';
import { MotionLevel } from '../../core/model/finance';
import { motion } from '../theme';

export function useKeyboardSheet(motionLevel: MotionLevel, heightFactor = 0.85) {
  const duration = motion.levels[motionLevel].duration;
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      Animated.timing(keyboardHeight, {
        toValue: event.endCoordinates.height,
        duration,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
      keyboardHeight.stopAnimation();
    };
  }, [keyboardHeight]);

  return {
    keyboardHeight,
    sheetStyle: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: keyboardHeight,
      height: keyboardHeight.interpolate({
        inputRange: [0, screenHeight],
        outputRange: [screenHeight * heightFactor, 0],
      }),
    },
  };
}