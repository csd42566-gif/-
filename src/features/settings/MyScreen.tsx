import { ThemedModal } from '../../ui/components/ThemedModal';
import React, { useState } from 'react';
import { Alert, AppState, BackHandler, LayoutAnimation, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { AccountKind, LedgerState, RiskCardMode, Settings, WorkProfile } from '../../core/model/finance';
import { spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { createAccount } from '../accounts/accounts';
import { BalanceReconcileEntry, lastBalanceReconciliation } from '../accounts/reconcile';
import { logger } from '../../core/logging/logger';
import { nativeFinance } from '../../integrations/notifications/nativeFinance';
import { ModuleControlPanel } from '../module/ModuleControlPanel';
import { buildBackupFileName } from './escape';
import { AccountMappingSection, collectAccountLabels } from './AccountMappingSection';
import { EssentialItemsSection } from './EssentialItemsSection';
import { essentialItemsTotal } from './essentialItems';
import { WorkSettingsSection } from './WorkSettingsSection';
import { AttendanceCalendar } from '../attendance/AttendanceCalendar';
import { isDefaultWorkProfile } from './workSettings';
import { useThemedStyles } from '../../ui/hooks/useThemedStyles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SettingKey = keyof Settings;
type Choice = { label: string; value: string | number | boolean };
const definitions: Partial<Record<SettingKey, { title: string; description: string; choices?: Choice[] }>> = {
  riskCardMode: { title: '现金流风险卡片', description: '真实资金缺口提醒始终会保留。', choices: [{ label: '始终显示', value: 'always' }, { label: '仅风险时显示', value: 'risk-only' }, { label: '首页隐藏', value: 'hidden' }] },
  reminderMode: { title: '模式', description: '神罚每笔消费实时警示；严厉支付后提醒；一般为轻提醒。', choices: [{ label: '神罚', value: 'punish' }, { label: '严厉', value: 'strict' }, { label: '一般', value: 'normal' }] },
  providerIconStyle: { title: '账单 App 图标', description: '品牌图标使用官方品牌字标，字符徽章使用来源首字。', choices: [{ label: '品牌图标', value: 'logo' }, { label: '字符徽章', value: 'badge' }] },
  repaymentReminders: { title: '还款到期提醒', description: '显示账本中记录的还款和账单到期提示。', choices: [{ label: '关闭', value: false }, { label: '开启', value: true }] },
  motionLevel: { title: '动效', description: '控制按钮回弹、弹层和页面过渡的动画强度。', choices: [{ label: '超级动效', value: 'super' }, { label: '强化动效', value: 'enhanced' }, { label: '一般动效', value: 'standard' }] },
  billSource: { title: '账单来源', description: '决定接收哪些自动账单通道；两者都开会按统一去重键合并。', choices: [{ label: '仅通知（App 通知监听）', value: 'notification' }, { label: '仅自动记账（AutoAccounting 推送）', value: 'autoaccounting' }, { label: '两者都开（自动去重）', value: 'both' }] },
};
const integrations = {
  bank: { title: '银行与支付平台', body: '当前版本未连接任何银行或支付平台。不会读取账户凭证，也不会同步交易。接入服务与授权流程尚未配置。' },
  root: { title: 'Root 通知增强', body: '当前版本没有安装 Root 模块，也不会读取其他应用数据。未来接入前需要单独安装、授权并可随时关闭。' },
  sync: { title: '账号与云同步', body: '当前数据保存在本机，尚未提供账号登录、云端 API 或端到端加密同步。卸载应用前请勿假设数据已备份。' },
  privacy: { title: '隐私说明', body: '诊断日志仅记录应用事件，不记录短信正文、通知正文、账号凭证或完整账户号码。日志保存在当前运行期间的内存中。' },
  about: { title: '关于', body: '记账 App · 本地优先的个人记账工具。当前版本为 Android 第一版。' },
} as const;
type IntegrationKey = keyof typeof integrations;

export function MyScreen({ state, onChangeRiskMode, onUpdateSettings, onUpdateWorkProfile, onSetStatusServiceEnabled, onClockInAttendance, onMarkAttendanceRest, onCreateAccount, onReconcileBalances, onClearAllData, openModulePanel, onModulePanelOpened }: {
  state: LedgerState;
  onChangeRiskMode: (mode: RiskCardMode) => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onUpdateWorkProfile: (patch: Partial<WorkProfile>) => Promise<void>;
  onSetStatusServiceEnabled: (enabled: boolean) => Promise<void>;
  onClockInAttendance: (at: Date) => Promise<void>;
  onMarkAttendanceRest: (at: Date) => Promise<void>;
  onCreateAccount: (account: ReturnType<typeof createAccount>) => void;
  onReconcileBalances: (entries: BalanceReconcileEntry[]) => Promise<void>;
  onClearAllData: () => Promise<void>;
  openModulePanel?: boolean;
  onModulePanelOpened?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [page, setPage] = useState<'me' | 'settings' | 'module' | 'attendance'>('me');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ accounts: state.accounts.length === 0, salary: false, attendance: false, reminders: false });
  const [activeKey, setActiveKey] = useState<SettingKey | null>(null);
  const [integration, setIntegration] = useState<IntegrationKey | null>(null);
  const [logVersion, setLogVersion] = useState(0);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind>('cash');
  const [accountBalance, setAccountBalance] = useState('0');
  const [accountError, setAccountError] = useState('');
  const [notificationAccess, setNotificationAccess] = useState(false);
  const [rootStatus, setRootStatus] = useState<'detected' | 'not-detected' | 'unavailable'>('unavailable');
  const [reconcileModal, setReconcileModal] = useState(false);
  const [reconcileInputs, setReconcileInputs] = useState<Record<string, string>>({});
  const [reconcileError, setReconcileError] = useState('');
  const [statusServiceBusy, setStatusServiceBusy] = useState(false);
  const [statusServiceError, setStatusServiceError] = useState('');
  const lastReconcile = lastBalanceReconciliation(state);
  const settings = state.settings;
  const accountMappingLabels = collectAccountLabels(state);
  const entries = logger.getEntries();

  React.useEffect(() => {
    if (openModulePanel) {
      setPage('module');
      onModulePanelOpened?.();
    }
  }, [openModulePanel, onModulePanelOpened]);

  React.useEffect(() => {
    if (page === 'me') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage(page === 'module' ? 'settings' : 'me');
      return true;
    });
    return () => subscription.remove();
  }, [page]);

  const refreshIntegrations = React.useCallback(async () => {
    try {
      const [access, root] = await Promise.all([nativeFinance.isNotificationAccessEnabled(), nativeFinance.getRootStatus()]);
      setNotificationAccess(access);
      setRootStatus(root);
    } catch {
      setNotificationAccess(false);
      setRootStatus('unavailable');
    }
  }, []);
  React.useEffect(() => {
    refreshIntegrations();
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') refreshIntegrations(); });
    return () => subscription.remove();
  }, [refreshIntegrations]);

  const toggleSection = (key: string) => {
    if (settings.motionLevel !== 'standard') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  };
  const openSetting = (key: SettingKey) => { setActiveKey(key); };
  const saveChoice = (key: SettingKey, value: string | number | boolean) => {
    if (key === 'riskCardMode') onChangeRiskMode(value as RiskCardMode);
    else onUpdateSettings({ [key]: value } as Partial<Settings>);
    setActiveKey(null);
  };
  const reconcileEntries: BalanceReconcileEntry[] = state.accounts.flatMap((account) => {
    const raw = reconcileInputs[account.id]?.trim() ?? '';
    if (!raw) return [];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return [];
    return [{ accountId: account.id, actualValue: value }];
  });
  const hasReconcileInput = state.accounts.some((account) => !!reconcileInputs[account.id]?.trim());
  const hasInvalidReconcileInput = state.accounts.some((account) => {
    const raw = reconcileInputs[account.id]?.trim() ?? '';
    if (!raw) return false;
    const value = Number(raw);
    return !Number.isFinite(value) || value < 0;
  });
  const reconcileDisabled = !hasReconcileInput || hasInvalidReconcileInput;
  const reconcileDifference = (account: (typeof state.accounts)[number]): number | null => {
    const raw = reconcileInputs[account.id]?.trim() ?? '';
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    const actualBalance = account.kind === 'credit' && value !== 0 ? -Math.abs(value) : value;
    return Math.round((actualBalance - account.balance) * 100) / 100;
  };
  const submitReconcile = async () => {
    if (reconcileDisabled) return;
    setReconcileError('');
    try {
      await onReconcileBalances(reconcileEntries);
      setReconcileModal(false);
      setReconcileInputs({});
    } catch {
      setReconcileError('校准失败，请确认输入后重试。');
    }
  };
  const openReconcile = () => {
    setReconcileInputs({});
    setReconcileError('');
    setReconcileModal(true);
  };
  const saveAccount = async () => {
    try {
      if (!accountBalance.trim()) throw new Error('account-balance-invalid');
      const enteredBalance = Number(accountBalance);
      if (editingAccountId) {
        const existing = state.accounts.find((account) => account.id === editingAccountId);
        if (!existing || enteredBalance < 0) throw new Error('account-balance-invalid');
        await onReconcileBalances([{ accountId: existing.id, actualValue: enteredBalance }]);
      } else {
        const balance = accountKind === 'credit' && enteredBalance !== 0 ? -Math.abs(enteredBalance) : enteredBalance;
        onCreateAccount(createAccount({ name: accountName, kind: accountKind, balance }));
      }
      setAccountModal(false);
      setAccountName('');
      setAccountKind('cash');
      setAccountBalance('0');
      setEditingAccountId(null);
      setAccountError('');
    } catch (error) {
      setAccountError(error instanceof Error && error.message === 'account-name-invalid' ? '请输入账户名称。' : '请输入不小于 0 的有效余额。');
    }
  };
  const toggleStatusService = async (enabled: boolean) => {
    setStatusServiceBusy(true);
    setStatusServiceError('');
    try {
      await onSetStatusServiceEnabled(enabled);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setStatusServiceError(code === 'notification-permission-denied' ? '未获得通知权限，无法启用常驻状态。' : '常驻状态切换失败，请重试。');
    } finally {
      setStatusServiceBusy(false);
    }
  };
  const clearLogs = () => Alert.alert('清空诊断日志？', '此操作不可撤销，不会删除账本交易。', [
    { text: '取消', style: 'cancel' },
    { text: '清空日志', style: 'destructive', onPress: () => { logger.clear(); setLogVersion(logVersion + 1); } },
  ]);
  const currentValue = (key: SettingKey) => {
    const value = settings[key];
    if (key === 'riskCardMode') return ({ always: '始终显示', 'risk-only': '仅风险时显示', hidden: '首页隐藏' } as Record<string, string>)[String(value)];
    if (key === 'reminderMode') return ({ punish: '神罚', strict: '严厉', normal: '一般' } as Record<string, string>)[String(value)];
    if (key === 'motionLevel') return ({ super: '超级动效', enhanced: '强化动效', standard: '一般动效' } as Record<string, string>)[String(value)];
    if (key === 'billSource') return ({ notification: '仅通知', autoaccounting: '仅自动记账', both: '两者都开' } as Record<string, string>)[String(value)];
    if (key === 'providerIconStyle') return ({ logo: '品牌图标', badge: '字符徽章' } as Record<string, string>)[String(value)];
    if (typeof value === 'boolean') return value ? '开启' : '关闭';
    return `${value}`;
  };
  const createBackupFile = async (): Promise<string> => {
    const raw = await AsyncStorage.getItem('strict-ledger/state') ?? await AsyncStorage.getItem('strict-ledger/state.tmp');
    if (!raw) throw new Error('未找到可导出的本地账本数据。');
    if (!FileSystem.cacheDirectory) throw new Error('缓存目录不可用。');
    const uri = `${FileSystem.cacheDirectory}${buildBackupFileName()}`;
    await FileSystem.writeAsStringAsync(uri, raw, { encoding: FileSystem.EncodingType.UTF8 });
    return uri;
  };
  const exportBackup = async () => {
    try {
      const uri = await createBackupFile();
      await Share.share({ url: uri, message: uri, title: '神罚数据备份' });
    } catch (error) {
      Alert.alert('导出失败', error instanceof Error ? error.message : String(error));
    }
  };
  const clearAllData = async () => {
    let backupPath = '';
    try {
      backupPath = await createBackupFile();
      await onClearAllData();
      Alert.alert('已清空所有数据', `账户、流水、欠款、目标已全部清空，不可恢复。\n备份文件：${backupPath}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert('清空失败', `${reason}${backupPath ? `\n备份文件：${backupPath}` : ''}`);
    }
  };
  const confirmClearAllData = () => {
    Alert.alert('清空所有数据？', '账户、流水、欠款、目标将全部清空，不可恢复', [
      { text: '取消', style: 'cancel' },
      { text: '继续', style: 'destructive', onPress: () => {
        Alert.alert('再次确认', '此操作不可撤销。系统会先自动备份到缓存目录。', [
          { text: '取消', style: 'cancel' },
          { text: '确认清空', style: 'destructive', onPress: () => { void clearAllData(); } },
        ]);
      } },
    ]);
  };
  const renderRow = (key: SettingKey) => <Row key={key} label={definitions[key]?.title ?? key} value={currentValue(key)} onPress={() => openSetting(key)} />;
  const accordion = (key: string, title: string, summary: string, children: React.ReactNode, badge?: string) => <View style={styles.section}>
    <Pressable onPress={() => toggleSection(key)} accessibilityRole="button" accessibilityState={{ expanded: !!expanded[key] }} style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
      <View style={styles.sectionHeading}><View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{badge && <Text style={styles.defaultBadge}>{badge}</Text>}</View><Text style={styles.sectionSummary}>{summary}</Text></View>
      <Ionicons name={expanded[key] ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
    </Pressable>
    {expanded[key] && <View style={styles.sectionBody}>{children}</View>}
  </View>;

  return <View style={styles.root}>
    {page === 'module' ? <ModuleControlPanel onBack={() => setPage('settings')} /> : page === 'attendance' ? <AttendanceCalendar state={state} onBack={() => setPage('me')} onClockIn={onClockInAttendance} onMarkRest={onMarkAttendanceRest} /> : page === 'me' ? <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>个人中心</Text><Text style={styles.title}>我的</Text>
      {accordion('accounts', '账户', `${state.accounts.length} 个账户`, <>
        {state.accounts.length ? state.accounts.map((account) => <Pressable key={account.id} onPress={() => { setEditingAccountId(account.id); setAccountBalance(String(account.kind === 'credit' ? Math.abs(account.balance) : account.balance)); setAccountError(''); setAccountModal(true); }} accessibilityRole="button" accessibilityLabel={`修改${account.name}余额`} style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}><Text style={styles.rowLabel}>{account.name}</Text><View style={styles.accountValue}><Text style={styles.rowValue}>{account.kind === 'credit' ? `欠款 ¥${Math.abs(account.balance).toFixed(2)}` : `¥${account.balance.toFixed(2)}`}</Text><Ionicons name="create-outline" size={16} color={colors.muted} /></View></Pressable>) : <Text style={styles.emptyText}>还没有账户。创建账户后即可开始记账。</Text>}
        <Pressable onPress={() => setAccountModal(true)} accessibilityRole="button" style={styles.inlineAction}><Ionicons name="add" size={17} color={colors.accent} /><Text style={styles.actionText}>{state.accounts.length ? '添加账户' : '创建第一个账户'}</Text></Pressable>
        {state.accounts.length > 0 && <Pressable onPress={openReconcile} accessibilityRole="button" style={styles.inlineAction}><Ionicons name="calculator-outline" size={17} color={colors.accent} /><Text style={styles.actionText}>校准账户余额</Text></Pressable>}
        {state.accounts.length > 0 && <Text style={styles.lastReconcile}>{lastReconcile ? `上次校准：${formatReconcileDate(lastReconcile.occurredAt)}，调整 ${formatSignedMoney(lastReconcile.totalAdjustment)}` : '尚未校准账户余额'}</Text>}
      </>)}
      {accordion('salary', '工资', '底薪、试用期、补贴与发薪', <WorkSettingsSection section="salary" profile={settings.work} motionLevel={settings.motionLevel} onChange={onUpdateWorkProfile} />, isDefaultWorkProfile(settings.work) ? '默认值 · 待确认' : undefined)}
      {accordion('accountMapping', '账户映射', '把账单里的支付账户名关联到应用账户', <AccountMappingSection labels={accountMappingLabels} accounts={state.accounts} mapping={settings.accountMapping} motionLevel={settings.motionLevel} onChange={(accountMapping) => onUpdateSettings({ accountMapping })} />)}
      {accordion('essentials', '每月固定花费', '吃住、会员与其他每月固定支出', <EssentialItemsSection items={settings.essentialItems} motionLevel={settings.motionLevel} onChange={(items) => onUpdateSettings({ essentialItems: items, essentialMonthlyExpenses: essentialItemsTotal(items) })} />, '合计 ¥' + essentialItemsTotal(settings.essentialItems).toFixed(2))}
      {accordion('attendance', '考勤', '月休、每天工时与考勤日历', <><WorkSettingsSection section="attendance" profile={settings.work} motionLevel={settings.motionLevel} onChange={onUpdateWorkProfile} /><Pressable onPress={() => setPage('attendance')} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Text style={styles.rowLabel}>考勤日历</Text><Text style={styles.rowValue}>查看 ›</Text></Pressable></>)}
      {accordion('reminders', '提醒偏好', '现金流与消费提醒', <>{renderRow('riskCardMode')}{renderRow('reminderMode')}</>)}
      <Pressable onPress={() => setPage('settings')} accessibilityRole="button" style={({ pressed }) => [styles.settingsEntry, pressed && styles.pressed]}>
        <View style={styles.settingsIcon}><Ionicons name="settings-outline" size={19} color={colors.ink} /></View>
        <View style={styles.settingsCopy}><Text style={styles.settingsTitle}>设置</Text><Text style={styles.sectionSummary}>连接、隐私、日志与关于</Text></View>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
    </ScrollView> : <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => setPage('me')} accessibilityRole="button" accessibilityLabel="返回我的" style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>返回我的</Text></Pressable>
      <Text style={styles.title}>设置</Text>
      <Text style={styles.groupLabel}>偏好设置</Text><View style={styles.group}><View style={styles.statusServiceRow}><View style={styles.statusServiceCopy}><Text style={styles.rowLabel}>状态栏常驻</Text><Text style={styles.statusServiceDescription}>显示已存、目标还差和本月缺口。ColorOS 可能杀服务，需要手动允许后台运行和自启动。</Text>{!!statusServiceError && <Text style={styles.error}>{statusServiceError}</Text>}</View><Switch value={settings.statusServiceEnabled} disabled={statusServiceBusy} onValueChange={(value) => { void toggleStatusService(value); }} trackColor={{ false: colors.line, true: colors.accentSoft }} thumbColor={settings.statusServiceEnabled ? colors.accent : colors.muted} /></View><View style={styles.statusServiceRow}><View style={styles.statusServiceCopy}><Text style={styles.rowLabel}>触感反馈</Text><Text style={styles.statusServiceDescription}>记一笔确认和打卡成功时振动 8ms。</Text></View><Switch value={settings.hapticsEnabled} onValueChange={(value) => onUpdateSettings({ hapticsEnabled: value })} trackColor={{ false: colors.line, true: colors.accentSoft }} thumbColor={settings.hapticsEnabled ? colors.accent : colors.muted} /></View>{renderRow('repaymentReminders')}{renderRow('motionLevel')}{renderRow('providerIconStyle')}</View>
      <Text style={styles.groupLabel}>账单导入</Text><View style={styles.group}>{renderRow('billSource')}<Row label="支付通知识别" value={notificationAccess ? '已授权' : '未授权'} onPress={() => setIntegration('bank')} /></View>
      <Text style={styles.groupLabel}>连接与数据</Text><View style={styles.group}><Row label="Root 状态检测" value={rootStatus === 'detected' ? '检测到标志' : rootStatus === 'not-detected' ? '未检测到' : '不可用'} onPress={() => setIntegration('root')} /><Row label="Magisk 控制面板" value="打开" onPress={() => setPage('module')} /><Row label="账号与云同步" value="本地模式" onPress={() => setIntegration('sync')} /></View>
      <Text style={styles.groupLabel}>数据管理</Text>
      <View style={styles.group}><Row label="导出数据备份" value="JSON" onPress={exportBackup} /><Row label="清空所有数据" value="危险操作" onPress={confirmClearAllData} /></View>
      <Text style={styles.groupLabel}>诊断日志 · {logVersion >= 0 ? entries.length : 0}</Text>
      <View style={styles.log}>{entries.length ? entries.slice(0, 8).map((entry, index) => <Text style={styles.logText} key={`${entry.at}-${index}`}>{entry.at.slice(11, 19)}  {entry.event}</Text>) : <Text style={styles.logText}>暂无日志记录</Text>}</View>
      <Pressable onPress={clearLogs} accessibilityRole="button" style={styles.clear}><Text style={styles.clearText}>清空诊断日志</Text></Pressable>
      <View style={styles.group}><Row label="隐私说明" value="查看" onPress={() => setIntegration('privacy')} /><Row label="关于" value="版本信息" onPress={() => setIntegration('about')} /></View>
    </ScrollView>}

    <ThemedModal visible={!!activeKey} transparent animationType={settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setActiveKey(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{activeKey ? definitions[activeKey]?.title : ''}</Text>
        <Text style={styles.description}>{activeKey ? definitions[activeKey]?.description : ''}</Text>
        {activeKey && definitions[activeKey]?.choices?.map((choice) => <Pressable key={String(choice.value)} onPress={() => saveChoice(activeKey, choice.value)} style={styles.option}><Text style={styles.optionLabel}>{choice.label}</Text>{settings[activeKey] === choice.value && <Text style={styles.selected}>已选择</Text>}</Pressable>)}
      </View></View>
    </ThemedModal>
    <ThemedModal visible={!!integration} transparent animationType={settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setIntegration(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>{integration ? integrations[integration].title : ''}</Text><Text style={styles.detail}>{integration === 'bank' ? `通知访问${notificationAccess ? '已授权' : '未授权'}。支持支付宝、微信支付及部分短信 App 的交易通知；不会读取短信数据库，也不保证覆盖所有银行通知格式。识别结果仅进入待确认列表。` : integration === 'root' ? `Root 状态：${rootStatus === 'detected' ? '检测到常见安装标志' : rootStatus === 'not-detected' ? '未检测到常见安装标志' : '当前平台不可用'}。该结果仅供参考，不执行 su 命令，不访问其他 App 私有数据；当前没有安装 Root 模块。` : integration ? integrations[integration].body : ''}</Text>{integration === 'bank' && <Pressable onPress={async () => { await nativeFinance.openNotificationAccessSettings(); }} style={styles.done}><Text style={styles.doneText}>打开通知访问设置</Text></Pressable>}{integration === 'root' && <Pressable onPress={refreshIntegrations} style={styles.done}><Text style={styles.doneText}>重新检测</Text></Pressable>}<Pressable onPress={() => setIntegration(null)} style={[styles.done, (integration === 'bank' || integration === 'root') && styles.secondaryDone]}><Text style={[styles.doneText, (integration === 'bank' || integration === 'root') && styles.secondaryDoneText]}>知道了</Text></Pressable></View></View>
    </ThemedModal>
    <ThemedModal visible={accountModal} transparent animationType={settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setAccountModal(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>{editingAccountId ? '修改账户余额' : '添加账户'}</Text>
        {!editingAccountId && <><Text style={styles.fieldLabel}>账户名称</Text><TextInput value={accountName} onChangeText={setAccountName} placeholder="例如：现金" style={styles.input} />
        <Text style={styles.fieldLabel}>账户类型</Text><View style={styles.kindChoices}>{([['cash', '现金'], ['bank', '储蓄卡'], ['credit', '信用卡'], ['wallet', '支付账户']] as [AccountKind, string][]).map(([kind, label]) => <Pressable key={kind} onPress={() => setAccountKind(kind)} style={[styles.kindChoice, accountKind === kind && styles.kindSelected]}><Text style={[styles.kindText, accountKind === kind && styles.kindTextSelected]}>{label}</Text></Pressable>)}</View></>}
        <Text style={styles.fieldLabel}>{(editingAccountId ? state.accounts.find((account) => account.id === editingAccountId)?.kind : accountKind) === 'credit' ? '欠款金额' : '账户余额'}</Text><TextInput value={accountBalance} onChangeText={setAccountBalance} keyboardType="decimal-pad" style={styles.input} />
        {!!accountError && <Text style={styles.error}>{accountError}</Text>}
        <View style={styles.actions}><Text onPress={() => { setAccountModal(false); setEditingAccountId(null); setAccountError(''); }} style={styles.cancel}>取消</Text><Text onPress={saveAccount} style={styles.save}>{editingAccountId ? '保存余额' : '创建账户'}</Text></View>
      </View></View>
    </ThemedModal>
    <ThemedModal visible={reconcileModal} transparent animationType={settings.motionLevel === 'standard' ? 'none' : 'fade'} onRequestClose={() => setReconcileModal(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>校准账户余额</Text>
        <Text style={styles.description}>只填写需要校准的账户。信用账户请填写欠款金额，保存时仍按负数记账。</Text>
        <ScrollView style={styles.reconcileList}>
          {state.accounts.map((account) => {
            const difference = reconcileDifference(account);
            return <View key={account.id} style={styles.reconcileRow}>
              <View style={styles.reconcileHead}><Text style={styles.rowLabel}>{account.name}</Text><Text style={styles.rowValue}>记录值 {account.kind === 'credit' ? `欠款 ¥${Math.abs(account.balance).toFixed(2)}` : `¥${account.balance.toFixed(2)}`}</Text></View>
              <TextInput value={reconcileInputs[account.id] ?? ''} onChangeText={(value) => setReconcileInputs((current) => ({ ...current, [account.id]: value }))} keyboardType="decimal-pad" placeholder={account.kind === 'credit' ? '填写欠款金额' : '填写真实余额'} placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={[styles.reconcileDiff, difference !== null && difference !== 0 && styles.reconcileDifference]}>差额 {difference === null ? '¥0.00' : formatSignedMoney(difference)}</Text>
            </View>;
          })}
        </ScrollView>
        <Text style={styles.reconcileNote}>确认后会同时写入“余额校准”流水。删除流水不会回滚账户余额；如余额有误，需要再次校准。</Text>
        {!!reconcileError && <Text style={styles.error}>{reconcileError}</Text>}
        <View style={styles.actions}><Text onPress={() => setReconcileModal(false)} style={styles.cancel}>取消</Text><Pressable disabled={reconcileDisabled} onPress={submitReconcile} style={[styles.confirmButton, reconcileDisabled && styles.disabled]}><Text style={styles.doneText}>确认校准</Text></Pressable></View>
      </View></View>
    </ThemedModal>
  </View>;
}


function formatSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}¥${Math.abs(value).toFixed(2)}`;
}

function formatReconcileDate(value: string): string {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const styles = useThemedStyles(createStyles); return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}  ›</Text></Pressable>; }

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, scroll: { padding: spacing.lg, paddingBottom: 90 },
  kicker: { fontSize: 12, color: colors.muted }, title: { fontSize: 25, fontWeight: '800', color: colors.ink, marginTop: 4, marginBottom: 16 },
  section: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, marginBottom: 9, overflow: 'hidden' },
  sectionHeader: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, sectionHeading: { flex: 1 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }, sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.ink }, defaultBadge: { fontSize: 9, color: colors.warning, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2, fontWeight: '800' }, sectionSummary: { fontSize: 11, color: colors.muted, marginTop: 3 },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line }, row: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, rowLabel: { fontSize: 12, color: colors.ink, flexShrink: 1 }, rowValue: { fontSize: 11, color: colors.muted, fontWeight: '700', fontVariant: ['tabular-nums'] }, accountRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, accountValue: { flexDirection: 'row', alignItems: 'center', gap: 7 }, emptyText: { color: colors.muted, fontSize: 12, lineHeight: 19, paddingVertical: 12 },
  inlineAction: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 5 }, actionText: { fontSize: 12, fontWeight: '700', color: colors.accent }, settingsEntry: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingHorizontal: 4 }, settingsIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line }, settingsCopy: { flex: 1 }, settingsTitle: { fontSize: 13, color: colors.ink, fontWeight: '800' }, pressed: { opacity: 0.65 },
  back: { minHeight: 40, alignSelf: 'flex-start', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface }, backText: { fontSize: 12, color: colors.ink, fontWeight: '700' }, groupLabel: { fontSize: 11, color: colors.muted, marginTop: 12, marginBottom: 7, fontWeight: '700' }, group: { paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  log: { backgroundColor: colors.ink, borderRadius: radius.sm, padding: 12, minHeight: 64 }, logText: { fontFamily: 'monospace', fontSize: 10, color: colors.surface, lineHeight: 17 }, clear: { minHeight: 42, justifyContent: 'center', alignItems: 'center' }, clearText: { fontSize: 12, color: colors.danger, fontWeight: '800' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: 20, paddingBottom: 30 }, sheetTitle: { fontSize: 18, fontWeight: '900', color: colors.ink }, description: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8, marginBottom: 12 }, input: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, color: colors.ink, fontSize: 16 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 18 }, cancel: { fontSize: 13, color: colors.muted }, save: { fontSize: 13, color: colors.success, fontWeight: '800' }, option: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, optionLabel: { fontSize: 13, color: colors.ink }, selected: { fontSize: 11, color: colors.success, fontWeight: '700' }, detail: { fontSize: 13, color: colors.ink, lineHeight: 21, marginTop: 14 }, done: { height: 44, backgroundColor: colors.accent, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, secondaryDone: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line }, secondaryDoneText: { color: colors.ink }, doneText: { fontSize: 12, color: colors.surface, fontWeight: '800' },
  lastReconcile: { color: colors.muted, fontSize: 10, lineHeight: 16, paddingBottom: 8, fontVariant: ['tabular-nums'] }, reconcileList: { maxHeight: 360 }, reconcileRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 7 }, reconcileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, reconcileDiff: { color: colors.muted, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }, reconcileDifference: { color: colors.danger }, reconcileNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 }, confirmButton: { height: 44, minWidth: 104, backgroundColor: colors.accent, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.4 },
  statusServiceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line }, statusServiceCopy: { flex: 1, paddingVertical: spacing.sm }, statusServiceDescription: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: spacing.xxs },
  fieldLabel: { fontSize: 11, color: colors.muted, marginTop: 14, marginBottom: 7 }, kindChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, kindChoice: { minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, kindSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, kindText: { fontSize: 11, color: colors.muted }, kindTextSelected: { color: colors.ink, fontWeight: '800' }, error: { fontSize: 11, color: colors.danger, marginTop: 8 },
  });
}

