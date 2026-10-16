import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

type Props = Pick<PressableProps, 'onPress' | 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PressableCard({ children, style, ...pressableProps }: Props) {
  return <Pressable {...pressableProps} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>{children}</Pressable>;
}
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:18,padding:spacing.md},pressed:{transform:[{scale:.98}],opacity:.88}});
