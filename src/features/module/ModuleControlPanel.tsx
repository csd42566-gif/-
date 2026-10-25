import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { logger } from '../../core/logging/logger';
import { nativeFinance } from '../../integrations/notifications/nativeFinance';
import { DEFAULT_MODULE_CONFIG, MagiskModuleStatus, ModuleFeatureKey } from '../../integrations/magisk/module';
import { useThemedStyles } from '../../ui/hooks/useThemedStyles';

type ModuleFeature = { key: ModuleFeatureKey; title: string; description: string; available: boolean };

const FEATURES: ModuleFeature[] = [
  { key: 'notificationCapture', title: '消费监听', description: '接收用户授权的支付通知，进入待确认列表。', available: true },
  { key: 'repaymentDetection', title: '代还识别', description: '识别还款和代还通知，确认时绑定对应欠款。', available: true },
  { key: 'billScan', title: '账单自动发现', description: '扫描下载目录中的账单文件，放入神罚导入收件箱。', available: true },
  { key: 'rootEnhancement', title: 'Root 增强', description: '提供模块状态和配置通道，不读取其他 App 私有数据。', available: true },
  { key: 'cloudSync', title: '云同步', description: '账号和云端 API 尚未接入，当前仅支持本地账本。', available: false },
];

const EMPTY_STATUS: MagiskModuleStatus = {
  available: false,
  installed: false,
  version: '',
  config: { ...DEFAULT_MODULE_CONFIG },
};

export function ModuleControlPanel({ onBack }: { onBack: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [busyFeature, setBusyFeature] = useState<ModuleFeatureKey | null>(null);
  const [error, setError] = useState('');
  const [scanMessage, setScanMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await nativeFinance.getMagiskModuleStatus());
      setError('');
    } catch (caught) {
      logger.log('warn', 'MAGISK_STATUS_UNAVAILABLE', caught instanceof Error ? caught.message : 'unknown');
      setStatus(EMPTY_STATUS);
      setError('未获得 Root 授权，或模块尚未安装。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleFeature = async (feature: ModuleFeatureKey, enabled: boolean) => {
    if (feature === 'cloudSync' || !status.installed) return;
    setBusyFeature(feature);
    try {
      setStatus(await nativeFinance.setMagiskModuleFeature(feature, enabled));
      setError('');
    } catch (caught) {
      logger.log('warn', 'MAGISK_FEATURE_WRITE_FAILED', caught instanceof Error ? caught.message : 'unknown');
      setError('设置没有保存，请确认 Magisk 已授予神罚 Root 权限。');
    } finally {
      setBusyFeature(null);
    }
  };

  const requestScan = async () => {
    setScanMessage('');
    try {
      const requested = await nativeFinance.requestBillScan();
      setScanMessage(requested ? '已请求扫描，结果会进入神罚收件箱。' : '模块未安装或未授予 Root 权限。');
    } catch (caught) {
      logger.log('warn', 'BILL_SCAN_REQUEST_FAILED', caught instanceof Error ? caught.message : 'unknown');
      setScanMessage('扫描请求失败，请确认 Root 权限。');
    }
  };
  const statusText = !status.available ? '不可用' : !status.installed ? '未安装模块' : status.config.moduleEnabled ? '运行中' : '已停用';
  const switchDisabled = !status.available || !status.installed;

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="返回设置" style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>返回设置</Text>
      </Pressable>
      <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.kicker}>MAGISK MODULE</Text><Text style={styles.title}>神罚核心</Text><Text style={styles.subtitle}>消费监听、代还识别和 Root 配置的统一控制面板</Text></View><View style={styles.statusBadge}><View style={[styles.statusDot, status.config.moduleEnabled && status.installed && styles.statusDotActive]} /><Text style={styles.statusBadgeText}>{statusText}</Text></View></View>
      <View style={styles.summary}><Text style={styles.summaryTitle}>{status.installed ? `版本 ${status.version || '未知'}` : '等待模块连接'}</Text><Text style={styles.summaryBody}>模块只提供本机状态与配置，不会自动执行支付、转账或还款。</Text><View style={styles.summaryActions}><Pressable onPress={refresh} disabled={loading} accessibilityRole="button" style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}><Ionicons name="refresh-outline" size={16} color={colors.ink} /><Text style={styles.refreshText}>{loading ? '检测中' : '重新检测'}</Text></Pressable>{status.installed && status.config.billScan && <Pressable onPress={requestScan} accessibilityRole="button" style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}><Ionicons name="folder-open-outline" size={16} color={colors.accent} /><Text style={styles.refreshText}>立即扫描</Text></Pressable>}</View></View>
      {!!scanMessage && <Text style={styles.scanMessage}>{scanMessage}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.sectionLabel}>模块功能</Text>
      <View style={styles.featureGroup}>
        {FEATURES.map((feature) => <FeatureRow key={feature.key} feature={feature} enabled={status.config[feature.key]} disabled={!feature.available || switchDisabled || busyFeature !== null} onToggle={(enabled) => toggleFeature(feature.key, enabled)} />)}
      </View>
      <Text style={styles.footnote}>云同步开关会在账号登录和加密同步服务接入后开放。通知识别结果仍需你在账本中确认。</Text>
    </ScrollView>
  </View>;
}

function FeatureRow({ feature, enabled, disabled, onToggle }: { feature: ModuleFeature; enabled: boolean; disabled: boolean; onToggle: (enabled: boolean) => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return <View style={[styles.featureRow, !feature.available && styles.featureUnavailable]}>
    <View style={styles.featureIcon}><Ionicons name={feature.key === 'cloudSync' ? 'cloud-outline' : feature.key === 'rootEnhancement' ? 'shield-checkmark-outline' : feature.key === 'repaymentDetection' ? 'repeat-outline' : feature.key === 'billScan' ? 'folder-open-outline' : 'notifications-outline'} size={18} color={feature.available ? colors.accent : colors.muted} /></View>
    <View style={styles.featureCopy}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureDescription}>{feature.description}</Text>{!feature.available && <Text style={styles.pending}>待接入</Text>}</View>
    {feature.available && <Switch value={enabled} onValueChange={onToggle} disabled={disabled} trackColor={{ false: colors.line, true: colors.accentSoft }} thumbColor={enabled ? colors.accent : colors.surface} accessibilityLabel={`${feature.title}开关`} />}
  </View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  back: { minHeight: 40, alignSelf: 'flex-start', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface },
  backText: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  headingCopy: { flex: 1 },
  kicker: { fontSize: 10, letterSpacing: 1, color: colors.muted, fontWeight: '800' },
  title: { fontSize: 27, fontWeight: '900', color: colors.ink, marginTop: 4 },
  subtitle: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 5 },
  statusBadge: { minHeight: 30, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface },
  statusDot: { width: 7, height: 7, borderRadius: radius.sm, backgroundColor: colors.muted },
  statusDotActive: { backgroundColor: colors.success },
  statusBadgeText: { fontSize: 10, color: colors.muted, fontWeight: '800' },
  summary: { marginTop: 18, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  summaryBody: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 5 },
  summaryActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  refresh: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshText: { fontSize: 12, color: colors.accent, fontWeight: '800' },
  scanMessage: { fontSize: 11, lineHeight: 16, color: colors.success, marginTop: 8 },
  sectionLabel: { fontSize: 11, color: colors.muted, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  featureGroup: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, overflow: 'hidden' },
  featureRow: { minHeight: 78, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  featureUnavailable: { opacity: 0.72 },
  featureIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  featureDescription: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  pending: { fontSize: 10, color: colors.warning, fontWeight: '800', marginTop: 3 },
  footnote: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 14 },
  error: { fontSize: 11, lineHeight: 16, color: colors.danger, marginTop: 10 },
  pressed: { opacity: 0.65 },
  });
}

