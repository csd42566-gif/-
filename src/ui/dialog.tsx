/**
 * 方案 B 的弹窗族：确认 / 输入 / 通知三态，替代 react-native 的 Alert。
 *
 * 为什么不用 Alert：
 * 1. Android 上 Alert 是系统灰底、系统字体，跟方案 B 的米白底 + 白卡 + 琥珀按钮完全两张皮。
 * 2. Alert.prompt 只在 iOS 有实现（node_modules/react-native/Libraries/Alert/Alert.js:188
 *    的 `if (Platform.OS === 'ios')` 没有 else 分支），安卓上点「导出加密备份」什么都不会发生。
 *
 * 用法：受控组件。visible 为 false 时返回 null，不挂 Modal。
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RADIUS, useTheme } from './theme';
import { PressScale } from './pressScale';

export type DialogTone = 'primary' | 'danger';

interface BaseProps {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
}

export interface ConfirmDialogProps extends BaseProps {
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
  onConfirm: () => void;
}

export interface PromptDialogProps extends BaseProps {
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  /** 遮盖输入内容（备份密码）。 */
  secure?: boolean;
  /**
   * 返回 false 表示校验失败、弹窗保持打开；返回字符串时把该字符串显示成输入框下方的错误提示，
   * 同样保持打开。返回 void 或 true 表示成功、由调用方负责关闭。
   */
  onSubmit: (value: string) => boolean | string | void;
}

export interface NoticeDialogProps extends BaseProps {
  confirmText?: string;
}

/** 弹窗外壳：遮罩 + 白卡 + 标题正文 + 底部按钮行。三态共用。 */
function Shell({
  visible,
  title,
  message,
  children,
  buttons,
  buttonsJustify = 'flex-start',
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  buttons: React.ReactNode;
  /** 两个按钮靠 flex:1 自然等分；单按钮传 'center' 让它居中、不撑满整卡。 */
  buttonsJustify?: 'flex-start' | 'center' | 'flex-end';
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 点遮罩空白处关闭，跟系统 Alert 一致 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.card, theme.card]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: theme.muted }]}>{message}</Text>
          ) : null}
          {children}
          <View style={[styles.buttons, { justifyContent: buttonsJustify }]}>{buttons}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 底部按钮：取消永远是玻璃胶囊，确认按 tone 上色。 */
function ActionButton({
  label,
  tone,
  onPress,
  grow = true,
}: {
  label: string;
  tone: 'plain' | DialogTone;
  onPress: () => void;
  /** 单按钮弹窗传 false：按钮按文字宽度收窄，不拉成整卡横幅。 */
  grow?: boolean;
}) {
  const theme = useTheme();
  const filled = tone !== 'plain';
  const danger = tone === 'danger';
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      pressedScale={0.96}
      haptic={danger ? 'warning' : 'light'}
      style={[
        styles.btn,
        grow ? styles.btnGrow : styles.btnAuto,
        filled
          ? {
              backgroundColor: danger ? theme.expense : theme.amber,
              backgroundImage: danger ? undefined : theme.amberGradient,
              boxShadow: danger
                ? '0 6px 16px rgba(217,89,94,0.20)'
                : '0 6px 16px rgba(32,60,52,0.22)',
            }
          : { backgroundColor: theme.cardAlt.backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          { color: filled ? (danger ? '#FFFFFF' : theme.onAmber) : theme.muted },
        ]}
      >
        {label}
      </Text>
    </PressScale>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Shell
      visible={visible}
      title={title}
      message={message}
      onCancel={onCancel}
      buttons={
        <>
          <ActionButton label={cancelText} tone="plain" onPress={onCancel} />
          <ActionButton label={confirmText} tone={tone} onPress={onConfirm} />
        </>
      }
    />
  );
}

export function NoticeDialog({
  visible,
  title,
  message,
  confirmText = '知道了',
  onCancel,
}: NoticeDialogProps) {
  return (
    <Shell
      visible={visible}
      title={title}
      message={message}
      onCancel={onCancel}
      buttonsJustify="center"
      buttons={
        <ActionButton label={confirmText} tone="primary" grow={false} onPress={onCancel} />
      }
    />
  );
}

export function PromptDialog({
  visible,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  placeholder,
  secure = false,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');

  /** 每次重新打开都清空，避免上次的密码留在框里。 */
  useEffect(() => {
    if (visible) {
      setValue('');
      setHint('');
    }
  }, [visible]);

  const submit = () => {
    const result = onSubmit(value);
    if (typeof result === 'string') {
      setHint(result);
      return;
    }
    if (result === false) return;
    setValue('');
    setHint('');
  };

  return (
    <Shell
      visible={visible}
      title={title}
      message={message}
      onCancel={onCancel}
      buttons={
        <>
          <ActionButton label={cancelText} tone="plain" onPress={onCancel} />
          <ActionButton label={confirmText} tone="primary" onPress={submit} />
        </>
      }
    >
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
        ]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={theme.ghost}
        selectionColor={theme.amber}
        cursorColor={theme.amber}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
      />
      {hint !== '' && (
        <Text style={[styles.hint, { color: theme.expense }]}>{hint}</Text>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,20,8,0.22)',
    paddingHorizontal: 34,
  },
  card: {
    width: '100%',
    maxWidth: 288,
    borderRadius: 22,
    paddingTop: 20,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  title: { fontSize: 13.5,
    includeFontPadding: false,
    lineHeight: 16.5, fontWeight: '800', letterSpacing: -0.3 },
  message: { fontSize: 10.3,
    includeFontPadding: false, lineHeight: 16.5, marginTop: 7.6 },
  input: {
    height: 36,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 12,
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontSize: 11.9,
    includeFontPadding: false,
    lineHeight: 14.5,
    fontWeight: '700',
    marginTop: 12,
  },
  hint: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, marginTop: 5.4, marginLeft: 2 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: {
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGrow: { flex: 1 },
  btnAuto: { minWidth: 96, paddingHorizontal: 26 },
  btnText: { fontSize: 10.3,
    includeFontPadding: false,
    lineHeight: 12.6, fontWeight: '800' },
});
