/**
 * 首开引导页（方案 B 定稿）：一次性填写三个默认账户初始余额（可跳过）。
 * 决策 12：开记时手动填一次；决策 16（验收）：跳过后可后续补填。
 *
 * 视觉：无标题栏，品牌行小字距 + 28px 大标题 + 白卡账户行（名称 + 大额输入）；
 * 主按钮琥珀渐变胶囊，跳过是一行小字链接。
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SEED_ACCOUNTS } from '../src/core/seeds';
import { validateOnboardingBalances } from '../src/core/onboarding';
import { useOnboardingStore } from '../src/features/onboarding/onboardingStore';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { Aurora } from '../src/ui/aurora';
import { RADIUS, useTheme } from '../src/ui/theme';
import { PressScale } from '../src/ui/pressScale';

export default function Onboarding() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, skipOnboarding } = useOnboardingStore();
  const loadAccounts = useAccountsStore((s) => s.load);

  const [amounts, setAmounts] = useState<string[]>(SEED_ACCOUNTS.map(() => ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setAmount = (index: number, text: string) => {
    setAmounts((prev) => prev.map((v, i) => (i === index ? text : v)));
    setError('');
  };

  const finish = async (skip: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      if (skip) {
        await skipOnboarding();
      } else {
        const result = validateOnboardingBalances(
          SEED_ACCOUNTS.map((a, i) => ({ name: a.name, amountText: amounts[i] })),
        );
        if (result.error !== '') {
          setError(result.error);
          setSaving(false);
          return;
        }
        await completeOnboarding(result.balances);
      }
      await loadAccounts();
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败');
      setSaving(false);
    }
  };

  return (
    <Aurora>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.brand, { color: theme.accent }]}>肥 鱼 的 米 饭</Text>
          <Text style={[styles.title, { color: theme.text }]}>先告诉它{'\n'}你手里有多少</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            之后每一笔账都会让余额自己滚动。跳过也行，回头在账户管理里补。
          </Text>

          {SEED_ACCOUNTS.map((account, index) => (
            <View key={account.name} style={[styles.accountCard, theme.card]}>
              <Text style={[styles.accountName, { color: theme.ghost }]}>{account.name}</Text>
              <View style={styles.amountRow}>
                <Text style={[styles.currency, { color: theme.accent }]}>¥</Text>
                <TextInput
                  style={[styles.amountInput, { color: theme.text }]}
                  value={amounts[index]}
                  onChangeText={(text) => setAmount(index, text)}
                  placeholder="0.00"
                  placeholderTextColor={theme.ghost}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          ))}

          {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}

          <PressScale pressedScale={0.94}
            style={[styles.primaryButton, { backgroundImage: theme.amberGradient }]}
            onPress={() => void finish(false)}
            disabled={saving}
          >
            <Text style={[styles.primaryText, { color: theme.onAmber }]}>
              {saving ? '保存中…' : '开始记账'}
            </Text>
          </PressScale>
          <PressScale pressedScale={0.94} style={styles.skipButton} onPress={() => void finish(true)} disabled={saving}>
            <Text style={[styles.skipText, { color: theme.faint }]}>先跳过</Text>
          </PressScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </Aurora>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 22 },

  brand: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, letterSpacing: 3.4, fontWeight: '800', marginBottom: 14 },
  title: { fontSize: 28.2,
    includeFontPadding: false, fontWeight: '800', letterSpacing: -1, lineHeight: 38 },
  subtitle: { fontSize: 9.7,
    includeFontPadding: false, lineHeight: 19, marginTop: 10, marginBottom: 22 },

  accountCard: {
    borderRadius: RADIUS.cardSm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 9,
  },
  accountName: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, letterSpacing: 1.6, fontWeight: '800', marginBottom: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  currency: { fontSize: 18.4,
    includeFontPadding: false,
    lineHeight: 22.4, fontWeight: '700', marginRight: 3, marginBottom: 5 },
  amountInput: {
    flex: 1,
    fontSize: 26,
    includeFontPadding: false,
    lineHeight: 28.6,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    padding: 0,
  },

  error: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, marginTop: 6, marginBottom: 4 },

  primaryButton: {
    height: 54,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    boxShadow: '0 16px 36px rgba(32,60,52,0.28)',
  },
  primaryText: { fontWeight: '800', fontSize: 11.4,
    includeFontPadding: false,
    lineHeight: 13.9, letterSpacing: 1 },

  skipButton: { paddingVertical: 15, alignItems: 'center' },
  skipText: { fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2, fontWeight: '600' },
});
