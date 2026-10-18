import React from 'react';
import { Modal, ModalProps } from 'react-native';
import { ThemeProvider, useTheme } from '../ThemeContext';

export function ThemedModal(props: ModalProps) {
  const { mode } = useTheme();
  return <ThemeProvider mode={mode}><Modal {...props} /></ThemeProvider>;
}