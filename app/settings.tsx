/**
 * 资料页（Pocket 参考定稿 2026-11-20）：头像 + 名称头部，下面接一组扁平列表。
 *
 * 视觉对齐 Pocket 参考图第 5 屏（Profile）：页头下是头像卡（深绿圆 + 名称 + 副标题），
 * 之后是分节标题 + 白卡分组。选项胶囊选中态深绿渐变，开关手写胶囊，
 * 管理/数据是链接行 + 右侧箭头。功能与旧设置页完全一致，只改了页面身份与头部。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatCurrencyAmount } from '../src/core/currency';
import { DEFAULT_CURRENCY } from '../src/core/currency';
import { totalBalanceByCurrencyCents } from '../src/core/balance';
import { useAccountsStore } from '../src/features/accounts/accountsStore';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import { useLedgerStore } from '../src/features/ledger/ledgerStore';
import { useSettingsStore } from '../src/features/settings/settingsStore';
import type {
  NumberRoll,
  PageTransition,
  RecordSuccessAnimation,
  ThemeMode,
} from '../src/features/settings/preferences';
import { Aurora } from '../src/ui/aurora';
import { BottomDock } from '../src/ui/dock';
import { BottomFade } from '../src/ui/bottomFade';
import { TopFade } from '../src/ui/topFade';
import { ConfirmDialog, NoticeDialog, PromptDialog } from '../src/ui/dialog';
import { PageHead } from '../src/ui/pageHead';
import { PressScale } from '../src/ui/pressScale';
import { RADIUS, useTheme, type ThemeColors } from '../src/ui/theme';
import {
  exportEncryptedBackup,
  importEncryptedBackup,
  restorePayload,
} from '../src/features/backup/backupStore';

/** 等宽三选一（或多选一）胶囊行：flex:1 均分，选中琥珀渐变。 */
function OptionChips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  const theme = useTheme();
  return (
    <View style={styles.optRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <PressScale
            key={opt}
            style={[
              styles.opt,
              { backgroundColor: theme.cardAlt.backgroundColor },
              active && { backgroundImage: theme.amberGradient, backgroundColor: theme.amber },
            ]}
            pressedScale={0.95}
            onPress={() => onChange(opt)}
          >
            <Text
              style={[
                styles.optText,
                { color: active ? theme.onAmber : theme.muted },
                active && styles.optTextActive,
              ]}
              numberOfLines={1}
            >
              {labels[opt]}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

/** 手写开关：52×30 胶囊 + 白钮。RN Switch 在各机型色差大，原型里是琥珀渐变。 */
function Toggle({ on, onPress, theme }: { on: boolean; onPress: () => void; theme: ThemeColors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[
        styles.track,
        on
          ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
          : { backgroundColor: theme.switchOff },
      ]}
    >
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

/** 链接行：文字 + 右侧当前值 + 箭头。 */
function LinkRow({
  label,
  value,
  onPress,
  tone = 'plain',
  theme,
  first,
}: {
  label: string;
  /** 右侧当前值，不传则只有箭头。 */
  value?: string;
  onPress: () => void;
  tone?: 'plain' | 'amber';
  theme: ThemeColors;
  first: boolean;
}) {
  return (
    <PressScale
      style={[styles.linkRow, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}
      pressedScale={0.98}
      haptic="light"
      onPress={onPress}
    >
      <Text
        style={[
          styles.linkText,
          { color: tone === 'amber' ? theme.accent : theme.text },
          tone === 'amber' && styles.linkTextStrong,
        ]}
      >
        {label}
      </Text>
      {value !== undefined && (
        <Text style={[styles.linkValue, { color: theme.faint }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
        <Path
          d="M3 1 L7 5 L3 9"
          stroke={theme.ghost}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </PressScale>
  );
}

/**
 * 可展开的设置行（方案 B 清单式）。
 *
 * 收起时是「名字 —— 当前值 —— 箭头」，点一下就地展开选项胶囊；不跳二级页。
 * 主题和动效都只有三档，为它们各开一个二级页要多两次跳转，清单式在这里更省。
 */
function ExpandRow<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
  theme,
  first,
}: {
  label: string;
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
  theme: ThemeColors;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={!first ? { borderTopWidth: 1, borderTopColor: theme.line } : undefined}>
      <PressScale
        style={styles.linkRow}
        pressedScale={0.98}
        haptic="light"
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.linkText, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.linkValue, { color: theme.faint }]} numberOfLines={1}>
          {labels[value]}
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
            <Path
              d="M3 1 L7 5 L3 9"
              stroke={theme.ghost}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </PressScale>
      {open && (
        <View style={styles.expandBody}>
          <OptionChips<T>
            options={options}
            value={value}
            onChange={(v) => {
              onChange(v);
              setOpen(false);
            }}
            labels={labels}
          />
        </View>
      )}
    </View>
  );
}

/** 三选一里「当前值」被勾选的那一行（外观的清单式呈现）。 */
function PickRow({
  label,
  hint,
  active,
  onPress,
  theme,
  first,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
  theme: ThemeColors;
  first: boolean;
}) {
  return (
    <PressScale
      style={[styles.linkRow, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}
      pressedScale={0.98}
      haptic="light"
      onPress={onPress}
    >
      <Text style={[styles.linkText, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.linkValue, { color: theme.faint }]} numberOfLines={1}>
        {hint}
      </Text>
      {active ? (
        <View style={[styles.check, { backgroundColor: theme.amber }]}>
          <Svg width={9} height={9} viewBox="0 0 12 12" fill="none">
            <Path
              d="M2 6.4 L4.8 9 L10 3.4"
              stroke={theme.onAmber}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : (
        <View style={[styles.checkEmpty, { borderColor: theme.switchOff }]} />
      )}
    </PressScale>
  );
}

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const themeMode = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const recordSuccessAnimation = useSettingsStore((s) => s.recordSuccessAnimation);
  const setRecordSuccessAnimation = useSettingsStore((s) => s.setRecordSuccessAnimation);
  const pageTransition = useSettingsStore((s) => s.pageTransition);
  const setPageTransition = useSettingsStore((s) => s.setPageTransition);
  const numberRoll = useSettingsStore((s) => s.numberRoll);
  const setNumberRoll = useSettingsStore((s) => s.setNumberRoll);
  const displayToggles = useSettingsStore((s) => s.displayToggles);
  const setDisplayToggles = useSettingsStore((s) => s.setDisplayToggles);
  const monthlyBudgetCents = useSettingsStore((s) => s.monthlyBudgetCents);
  const setMonthlyBudgetCents = useSettingsStore((s) => s.setMonthlyBudgetCents);
  const transactions = useLedgerStore((s) => s.transactions);
  const accounts = useAccountsStore((s) => s.accounts);
  const categories = useCategoriesStore((s) => s.categories);
  const categoriesLoaded = useCategoriesStore((s) => s.loaded);
  const loadCategories = useCategoriesStore((s) => s.load);

  /**
   * 直接冷启动进资料页时分类还没人加载过（首页/洞察才会 load），
   * 「分类管理 N 个」会显示成 0 个。这里补一次。
   */
  useEffect(() => {
    if (!categoriesLoaded) void loadCategories();
  }, [categoriesLoaded, loadCategories]);

  const [budgetText, setBudgetText] = useState(
    monthlyBudgetCents > 0 ? String(monthlyBudgetCents / 100) : '',
  );
  /** 钱那块的「月预算」行是否展开编辑框。 */
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** 总余额（仅启用账户，主币种）。 */
  const totalBalanceCents = useMemo(
    () =>
      totalBalanceByCurrencyCents(
        accounts.filter((a) => a.enabled),
        transactions,
      )[DEFAULT_CURRENCY] ?? 0,
    [accounts, transactions],
  );

  /** 本月支出（主币种），用于「预算已用 N%」这行。 */
  const monthSpendCents = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
    let sum = 0;
    for (const t of transactions) {
      if (t.kind !== 'expense' || t.currency !== DEFAULT_CURRENCY) continue;
      if (t.occurredAt < monthStart) continue;
      sum += t.amountCents;
    }
    return sum;
  }, [transactions]);

  /**
   * 弹窗全部改成页面内的受控组件（src/ui/dialog.tsx）。
   * 不用 Alert 的原因：安卓上 Alert 是系统灰底、与方案 B 两张皮；Alert.prompt 只在 iOS 有实现
   * （react-native/Libraries/Alert/Alert.js:188 只有 if (ios) 分支，没有 else），
   * 安卓点「导出加密备份」原本什么都不会发生。
   */
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message?: string;
    confirmText: string;
    tone: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);
  const [prompt, setPrompt] = useState<{
    mode: 'export' | 'import';
    title: string;
    message: string;
    confirmText: string;
  } | null>(null);

  const saveBudget = () => {
    const text = budgetText.trim();
    if (text === '') {
      setMonthlyBudgetCents(0);
      return;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      setNotice({ title: '预算不对', message: '只填数字（如 5000），清空等于不设预算。' });
      return;
    }
    setMonthlyBudgetCents(Math.round(value * 100));
  };

  const doExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const header = '日期,类型,金额,币种,分类,账户,备注';
      const nameOfAccount = (id: number) => accounts.find((a) => a.id === id)?.name ?? `#${id}`;
      const rows = [...transactions]
        .sort((a, b) => a.occurredAt - b.occurredAt)
        .map((t) => {
          const day = new Date(t.occurredAt * 1000);
          const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
            day.getDate(),
          ).padStart(2, '0')}`;
          const kind = { expense: '支出', income: '收入', transfer: '转账' }[t.kind];
          const amount = (t.amountCents / 100).toFixed(2);
          const note = t.note.replace(/"/g, '""');
          return `${dayStr},${kind},${amount},${t.currency},${t.categoryId ?? ''},${nameOfAccount(t.accountId)},"${note}"`;
        });
      const csv = [header, ...rows].join('\r\n');
      const file = new FileSystem.File(FileSystem.Paths.cache, 'feiyu-ledger-export.csv');
      file.create({ overwrite: true });
      await file.write(csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
      } else {
        setNotice({ title: '已导出', message: `CSV 已写入 ${file.uri}` });
      }
    } catch (caught) {
      setNotice({ title: '导出失败', message: caught instanceof Error ? caught.message : '未知错误' });
    } finally {
      setExporting(false);
    }
  };

  /** 导出：只是打开密码弹窗，真正加密在弹窗的 onSubmit 里做。 */
  const doExportBackup = () => {
    setPrompt({
      mode: 'export',
      title: '设置备份密码',
      message: '导入时需要这个密码，忘记就找不回数据。',
      confirmText: '导出',
    });
  };

  /** 导入第一步：打开密码弹窗。选文件 + 解密在 onSubmit 里做。 */
  const doImportBackup = () => {
    setPrompt({
      mode: 'import',
      title: '输入备份密码',
      message: '将用所选备份覆盖当前全部数据。',
      confirmText: '选择文件',
    });
  };

  /** 弹窗提交：返回 false 表示密码为空、弹窗保持打开。 */
  const submitPrompt = (raw: string): boolean | string | void => {
    const password = raw.trim();
    if (prompt === null) return false;
    if (password === '') return '密码不能为空。';
    const mode = prompt.mode;
    setPrompt(null);
    if (mode === 'export') {
      void (async () => {
        setExporting(true);
        try {
          await exportEncryptedBackup(password);
        } catch (caught) {
          setNotice({
            title: '导出失败',
            message: caught instanceof Error ? caught.message : '未知错误',
          });
        } finally {
          setExporting(false);
        }
      })();
      return;
    }
    void (async () => {
      try {
        const payload = await importEncryptedBackup(password);
        setConfirm({
          title: '确认恢复',
          message: `备份包含 ${payload.accounts.length} 个账户、${payload.transactions.length} 笔流水，恢复将覆盖当前全部数据。`,
          confirmText: '恢复',
          tone: 'danger',
          onConfirm: () => {
            setConfirm(null);
            void (async () => {
              try {
                await restorePayload(payload);
                setNotice({ title: '恢复完成', message: '数据已恢复。' });
              } catch (caught) {
                setNotice({
                  title: '恢复失败',
                  message: caught instanceof Error ? caught.message : '未知错误',
                });
              }
            })();
          },
        });
      } catch (caught) {
        setNotice({
          title: '导入失败',
          message: caught instanceof Error ? caught.message : '未知错误',
        });
      }
    })();
  };

  return (
    <Aurora>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHead
          kicker="个人 · 本机数据"
          title="资料"
          action={
            <PressScale pressedScale={0.9}
              style={[styles.roundBtn, theme.card]}
              accessibilityLabel="设置"
              hitSlop={8}
              onPress={() => router.push('/categories')}
            >
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 20v-6M6 9V4M12 20v-9M12 6V4M18 20v-4M18 11V4"
                  stroke={theme.accent}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                />
                <Circle cx={6} cy={11} r={2} stroke={theme.accent} strokeWidth={1.9} />
                <Circle cx={12} cy={8} r={2} stroke={theme.accent} strokeWidth={1.9} />
                <Circle cx={18} cy={13} r={2} stroke={theme.accent} strokeWidth={1.9} />
              </Svg>
            </PressScale>
          }
        />

        {/* 头像卡：Pocket 参考第 5 屏，右侧是身份胶囊。 */}
        <View style={[styles.profileCard, theme.card]}>
          <View style={[styles.profileAvatar, { backgroundColor: theme.amber }]}>
            <Text style={styles.profileInitial}>肥</Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={[styles.profileName, { color: theme.text }]}>肥鱼的米饭</Text>
            <Text style={[styles.profileSub, { color: theme.faint }]}>
              {accounts.length} 个账户 · {transactions.length} 笔账 · {categories.length} 个分类
            </Text>
          </View>
          <View style={[styles.profilePill, { backgroundColor: theme.cardAlt.backgroundColor }]}>
            <Text style={[styles.profilePillText, { color: theme.muted }]}>仅本机</Text>
          </View>
        </View>

        {/* 钱（方案 B 清单式）：三行键值，总余额最大，预算可点着改。 */}
        <Text style={[styles.secTitle, { color: theme.sectionLabel }]}>钱</Text>
        <View style={[styles.setCard, styles.linkCard, theme.card]}>
          <View style={styles.kvRow}>
            <Text style={[styles.kvKey, { color: theme.text }]}>总余额</Text>
            <Text style={[styles.kvValueBig, { color: theme.text }]} numberOfLines={1}>
              {formatCurrencyAmount(totalBalanceCents, DEFAULT_CURRENCY)}
            </Text>
            {/* 占位：让本行数值与下面带箭头的「月预算」行共享同一右边缘。 */}
            <View style={styles.chevSlot} />
          </View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: theme.line }]}>
            <Text style={[styles.kvKey, { color: theme.text }]}>本月支出</Text>
            <Text style={[styles.kvValue, { color: theme.muted }]} numberOfLines={1}>
              {formatCurrencyAmount(monthSpendCents, DEFAULT_CURRENCY)}
            </Text>
            <View style={styles.chevSlot} />
          </View>
          <PressScale
            style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: theme.line }]}
            pressedScale={0.98}
            haptic="light"
            onPress={() => setBudgetOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: budgetOpen }}
          >
            <Text style={[styles.kvKey, { color: theme.text }]}>月预算</Text>
            <Text style={[styles.kvValue, { color: theme.muted }]} numberOfLines={1}>
              {monthlyBudgetCents > 0
                ? formatCurrencyAmount(monthlyBudgetCents, DEFAULT_CURRENCY)
                : '未设'}
            </Text>
            <View style={{ transform: [{ rotate: budgetOpen ? '90deg' : '0deg' }] }}>
              <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
                <Path
                  d="M3 1 L7 5 L3 9"
                  stroke={theme.ghost}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </PressScale>

          {budgetOpen && (
            <View style={styles.expandBody}>
              <View style={styles.budgetRow}>
                <TextInput
                  style={[
                    styles.budgetInput,
                    { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
                  ]}
                  value={budgetText}
                  onChangeText={setBudgetText}
                  placeholder="0.00"
                  placeholderTextColor={theme.ghost}
                  keyboardType="decimal-pad"
                  onSubmitEditing={saveBudget}
                />
                <PressScale
                  style={[styles.budgetSave, { backgroundImage: theme.amberGradient }]}
                  pressedScale={0.95}
                  haptic="success"
                  onPress={saveBudget}
                >
                  <Text style={[styles.budgetSaveText, { color: theme.onAmber }]}>保存</Text>
                </PressScale>
              </View>
              <Text style={[styles.budgetHint, { color: theme.faint }]}>
                {monthlyBudgetCents > 0
                  ? `清空等于不设预算；只记 CNY 支出与它对比。`
                  : '不填等于不设预算；只记 CNY 支出与它对比。'}
              </Text>
            </View>
          )}
        </View>
        {monthlyBudgetCents > 0 && (
          <Text style={[styles.statHint, { color: theme.faint }]}>
            预算已用 {Math.round((monthSpendCents / monthlyBudgetCents) * 100)}%，剩余{' '}
            {formatCurrencyAmount(Math.max(0, monthlyBudgetCents - monthSpendCents), DEFAULT_CURRENCY)}
          </Text>
        )}

        {/* 外观（清单式：三行各带勾选，点一行即切） */}
        <Text style={[styles.secTitle, { color: theme.sectionLabel }]}>外观</Text>
        <View style={[styles.setCard, styles.linkCard, theme.card]}>
          <PickRow
            label="浅色"
            hint="米白纸面"
            active={themeMode === 'light'}
            onPress={() => setTheme('light')}
            theme={theme}
            first
          />
          <PickRow
            label="暗色"
            hint="深绿夜色"
            active={themeMode === 'dark'}
            onPress={() => setTheme('dark')}
            theme={theme}
            first={false}
          />
          <PickRow
            label="跟随系统"
            hint="按设备设置"
            active={themeMode === 'system'}
            onPress={() => setTheme('system')}
            theme={theme}
            first={false}
          />
        </View>

        {/* 动效（清单式：三行，点开就地选档） */}
        <Text style={[styles.secTitle, { color: theme.sectionLabel }]}>动效</Text>
        <View style={[styles.setCard, styles.linkCard, theme.card]}>
          <ExpandRow<RecordSuccessAnimation>
            label="记账成功"
            options={['clean', 'swift', 'dramatic']}
            value={recordSuccessAnimation}
            onChange={setRecordSuccessAnimation}
            labels={{ clean: '清爽', swift: '轻快', dramatic: '戏剧' }}
            theme={theme}
            first
          />
          <ExpandRow<PageTransition>
            label="页面转场"
            options={['slide', 'shared', 'card']}
            value={pageTransition}
            onChange={setPageTransition}
            labels={{ slide: '左右滑动', shared: '共享元素', card: '上滑' }}
            theme={theme}
            first={false}
          />
          <ExpandRow<NumberRoll>
            label="数字滚动"
            options={['instant', 'flip', 'pop']}
            value={numberRoll}
            onChange={setNumberRoll}
            labels={{ instant: '瞬时', flip: '翻牌', pop: '缩放' }}
            theme={theme}
            first={false}
          />
        </View>

        {/* 账本（清单式：开关行紧挨管理行，同一种行高） */}
        <Text style={[styles.secTitle, { color: theme.sectionLabel }]}>账本</Text>
        <View style={[styles.setCard, styles.linkCard, theme.card]}>
          <View style={styles.kvRow}>
            <Text style={[styles.kvKey, { color: theme.text }]}>流水里显示备注</Text>
            <Toggle
              theme={theme}
              on={displayToggles.note}
              onPress={() => setDisplayToggles({ note: !displayToggles.note })}
            />
          </View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: theme.line }]}>
            <Text style={[styles.kvKey, { color: theme.text }]}>流水里显示账户</Text>
            <Toggle
              theme={theme}
              on={displayToggles.account}
              onPress={() => setDisplayToggles({ account: !displayToggles.account })}
            />
          </View>
          <View style={[styles.kvRow, { borderTopWidth: 1, borderTopColor: theme.line }]}>
            <Text style={[styles.kvKey, { color: theme.text }]}>流水里显示分类</Text>
            <Toggle
              theme={theme}
              on={displayToggles.category}
              onPress={() => setDisplayToggles({ category: !displayToggles.category })}
            />
          </View>
          <LinkRow
            label="分类管理"
            value={`${categories.length} 个`}
            theme={theme}
            first={false}
            onPress={() => router.push('/categories')}
          />
          <LinkRow
            label="账户管理"
            value={`${accounts.length} 个`}
            theme={theme}
            first={false}
            onPress={() => router.push('/accounts')}
          />
        </View>
        {/* 数据 */}
        <Text style={[styles.secTitle, { color: theme.sectionLabel }]}>数据</Text>
        <View style={[styles.setCard, styles.linkCard, theme.card]}>
          <LinkRow
            label="导出 CSV"
            value={exporting ? '导出中…' : `${transactions.length} 笔`}
            theme={theme}
            first
            onPress={() => {
              if (!exporting) void doExportCsv();
            }}
          />
          <LinkRow
            label="导出加密备份"
            theme={theme}
            tone="amber"
            first={false}
            onPress={() => {
              if (!exporting) void doExportBackup();
            }}
          />
          <LinkRow
            label="导入备份恢复"
            theme={theme}
            first={false}
            onPress={() => {
              if (!exporting) void doImportBackup();
            }}
          />
        </View>
        <Text style={[styles.footNote, { color: theme.faint }]}>
          加密备份用密码加密，导入会覆盖当前全部数据。
        </Text>
        {/* 版本号唯一来源是 app.json，改版本时两处一起改。 */}
        <Text style={[styles.version, { color: theme.ghost }]}>肥鱼的米饭 · v2.0.0（11）</Text>
      </ScrollView>

      <TopFade top={insets.top} />

      <BottomFade bottom={insets.bottom + 68} />
      <BottomDock active="settings" bottomInset={insets.bottom} />

      <NoticeDialog
        visible={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message}
        onCancel={() => setNotice(null)}
      />
      <ConfirmDialog
        visible={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message}
        confirmText={confirm?.confirmText ?? '确定'}
        tone={confirm?.tone ?? 'primary'}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
      <PromptDialog
        visible={prompt !== null}
        title={prompt?.title ?? ''}
        message={prompt?.message}
        confirmText={prompt?.confirmText ?? '确定'}
        placeholder="备份密码"
        secure
        onSubmit={submitPrompt}
        onCancel={() => setPrompt(null)}
      />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 17, paddingBottom: 150 },

  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 头像卡（Pocket 参考第 5 屏）
  profileCard: {
    marginTop: 4.9,
    borderRadius: RADIUS.card,
    paddingTop: 11.9,
    paddingBottom: 11.9,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10.8,
  },
  profileAvatar: {
    width: 33.5,
    height: 33.5,
    borderRadius: 16.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: 16.2, fontWeight: '800', color: '#FFFFFF',
    includeFontPadding: false,
    lineHeight: 18,
  },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 13.5, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 16.2,
  },
  profileSub: { fontSize: 8.1, fontWeight: '600', marginTop: 2.7,
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  profilePill: {
    paddingHorizontal: 8.7,
    paddingVertical: 4.3,
    borderRadius: RADIUS.pill,
  },
  profilePillText: { fontSize: 7.6, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 9.3,
  },

  /* 资产概览两栏（方案 A 用；方案 B 改清单后仍保留样式，避免以后回退时重写）。 */
  /** 清单下方的一行说明（如「预算已用 18%，剩余 ¥2,465」）。 */
  statHint: { fontSize: 8.4, fontWeight: '600', marginTop: 5.4, paddingLeft: 2.2,
    includeFontPadding: false,
    lineHeight: 11,
  },

  /* 清单式键值行（方案 B）：名字在左、值在右，行高一致。 */
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9.7,
  },
  kvKey: { flex: 1, fontSize: 10.8, fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 13.2,
  },
  kvValue: { fontSize: 10.3, fontWeight: '600', flexShrink: 0, fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 12.6,
  },
  kvValueBig: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.5, flexShrink: 0,
    includeFontPadding: false,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },

  /** 与箭头等宽的占位，保证「有箭头」和「没箭头」的行数值右边缘一致。 */
  chevSlot: { width: 9, flexShrink: 0 },

  /** 展开后放选项的区域：上方留条分隔线，与键值行视觉上仍属同一张卡。 */
  expandBody: {
    paddingTop: 4.3,
    paddingBottom: 6.5,
  },

  /** 勾选圆点（外观清单用）：选中 = 深绿实心 + 白勾；未选 = 空心描边。 */
  check: {
    width: 17.3,
    height: 17.3,
    borderRadius: 8.7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkEmpty: {
    width: 17.3,
    height: 17.3,
    borderRadius: 8.7,
    borderWidth: 1.6,
    flexShrink: 0,
  },

  version: { fontSize: 7.6, fontWeight: '600', marginTop: 14.1, textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 9.3,
  },

  secTitle: {
    fontSize: 10.3,
    includeFontPadding: false,
    lineHeight: 13.4,
    letterSpacing: 0.6,
    fontWeight: '700',
    marginTop: 12.1,
    marginBottom: 4.3,
    paddingLeft: 2.2,
  },
  setCard: {
    marginTop: 4.9,
    borderRadius: RADIUS.cardSm,
    paddingTop: 8.1,
    paddingBottom: 9.2,
    paddingHorizontal: 10.8,
  },
  optRow: { flexDirection: 'row', gap: 4.3 },
  opt: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6.0,
    borderRadius: 8.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optText: { fontSize: 7.8,
    includeFontPadding: false,
    lineHeight: 9.5, fontWeight: '700' },
  optTextActive: { fontWeight: '800' },

  track: {
    width: 28.1,
    height: 17.3,
    borderRadius: 8.7,
    padding: 1.6,
    justifyContent: 'center',
  },
  knob: {
    width: 14.1,
    height: 14.1,
    borderRadius: 7.0,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },

  budgetRow: { flexDirection: 'row', gap: 5.4 },
  budgetInput: {
    flex: 1,
    height: 29.2,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 10.8,
    // Android TextInput 默认带上下内边距，会把字顶出可视区（实测「3000」被切）。
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontSize: 11.9,
    includeFontPadding: false,
    lineHeight: 14.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  budgetSave: {
    paddingHorizontal: 13,
    height: 29.2,
    borderRadius: RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetSaveText: { fontSize: 8.7,
    includeFontPadding: false,
    lineHeight: 10.6, fontWeight: '800' },
  budgetHint: { fontSize: 7.6,
    includeFontPadding: false, marginTop: 4.9, paddingLeft: 2.2, lineHeight: 11 },

  linkCard: { paddingTop: 2.2, paddingBottom: 2.2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8.1,
  },
  linkText: { flex: 1, fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '600' },
  linkTextStrong: { fontWeight: '800' },
  linkValue: { fontSize: 8.7, fontWeight: '600', flexShrink: 0,
    includeFontPadding: false,
    lineHeight: 10.6 },

  footNote: { fontSize: 7.6,
    includeFontPadding: false, marginTop: 5.4, paddingLeft: 2.2, lineHeight: 11 },
});
