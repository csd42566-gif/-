import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LedgerState, RiskCardMode, Settings } from '../../core/model/finance';
import { colors, spacing } from '../../ui/theme';
import { SectionTitle } from '../../ui/components/SectionTitle';
import { logger } from '../../core/logging/logger';

type SettingKey = keyof Settings;
type Choice = { label: string; value: string | number | boolean };
const definitions: Partial<Record<SettingKey, { title: string; description: string; choices?: Choice[]; numeric?: boolean }>> = {
  riskCardMode: { title: '现金流风险卡片', description: '真实资金缺口提醒始终会保留。', choices: [{ label: '始终显示', value: 'always' }, { label: '仅风险时显示', value: 'risk-only' }, { label: '首页隐藏', value: 'hidden' }] },
  reminderMode: { title: '消费后提醒', description: '只提示预算变化，不会锁定或阻止消费。', choices: [{ label: '平衡提醒', value: 'balanced' }, { label: '轻提醒', value: 'light' }, { label: '详细提醒', value: 'strict' }] },
  strictMode: { title: '严格模式', description: '启用后增加超预算提示，但仍允许用户正常记账。', choices: [{ label: '关闭', value: false }, { label: '开启', value: true }] },
  repaymentReminders: { title: '还款到期提醒', description: '显示账本中记录的还款和账单到期提示。', choices: [{ label: '关闭', value: false }, { label: '开启', value: true }] },
  reducedMotion: { title: '减少动效', description: '关闭弹层和切换的非必要动画。', choices: [{ label: '跟随默认动效', value: false }, { label: '减少动效', value: true }] },
  monthlyIncome: { title: '月收入', description: '用于现金流预测与工时换算。', numeric: true },
  essentialMonthlyExpenses: { title: '每月必要支出', description: '填写尚未计入账本的预计必要支出；已记录的必要支出会抵扣这笔预留。', numeric: true },
  workDaysPerMonth: { title: '每月工作天数', description: '用于估算每日收入。', numeric: true },
  workHoursPerDay: { title: '每日工作时长', description: '用于将预算缺口折算为工作时间。', numeric: true },
};
const integrations = {
  bank: { title: '银行与支付平台', body: '当前版本未连接任何银行或支付平台。不会读取账户凭证，也不会同步交易。接入服务与授权流程尚未配置。' },
  root: { title: 'Root 通知增强', body: '当前版本没有安装 Root 模块，也不会读取其他应用数据。未来接入前需要单独安装、授权并可随时关闭。' },
  sync: { title: '账号与云同步', body: '当前数据保存在本机，尚未提供账号登录、云端 API 或端到端加密同步。卸载应用前请勿假设数据已备份。' },
  privacy: { title: '隐私与日志', body: '诊断日志仅记录应用事件，不记录短信正文、通知正文、账号凭证或完整账户号码。日志保存在当前运行期间的内存中。' },
} as const;

export function SettingsScreen({ state, onChangeRiskMode, onUpdateSettings }: {
  state: LedgerState;
  onChangeRiskMode: (mode: RiskCardMode) => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}) {
  const [activeKey, setActiveKey] = useState<SettingKey | null>(null);
  const [integration, setIntegration] = useState<keyof typeof integrations | null>(null);
  const [numberValue, setNumberValue] = useState('');
  const [logVersion, setLogVersion] = useState(0);
  const settings = state.settings;
  const entries = logger.getEntries();
  const openSetting = (key: SettingKey) => { setActiveKey(key); setNumberValue(String(settings[key])); };
  const saveChoice = (key: SettingKey, value: string | number | boolean) => {
    if (key === 'riskCardMode') onChangeRiskMode(value as RiskCardMode);
    else onUpdateSettings({ [key]: value } as Partial<Settings>);
    setActiveKey(null);
  };
  const saveNumber = () => {
    const parsed = Number(numberValue);
    if (!Number.isFinite(parsed) || parsed < 0 || (activeKey !== 'monthlyIncome' && parsed <= 0)) return;
    if (activeKey) onUpdateSettings({ [activeKey]: parsed } as Partial<Settings>);
    setActiveKey(null);
  };
  const clearLogs = () => Alert.alert('清空诊断日志？', '此操作不可撤销，不会删除账本交易。', [
    { text: '取消', style: 'cancel' },
    { text: '清空日志', style: 'destructive', onPress: () => { logger.clear(); setLogVersion(logVersion + 1); } },
  ]);
  const currentValue = (key: SettingKey) => {
    const value = settings[key];
    if (key === 'riskCardMode') return ({ always: '始终显示', 'risk-only': '仅风险时显示', hidden: '首页隐藏' } as Record<string, string>)[String(value)];
    if (key === 'reminderMode') return ({ balanced: '平衡提醒', light: '轻提醒', strict: '详细提醒' } as Record<string, string>)[String(value)];
    if (typeof value === 'boolean') return value ? '开启' : '关闭';
    if (key === 'workDaysPerMonth') return `${value} 天 / 月`;
    if (key === 'workHoursPerDay') return `${value} 小时 / 天`;
    if (key === 'monthlyIncome') return `¥${value} / 月`;
    if (key === 'essentialMonthlyExpenses') return `¥${value} / 月`;
    return `¥${value}`;
  };
  const renderRow = (key: SettingKey) => <Row key={key} label={definitions[key]?.title ?? key} value={currentValue(key)} onPress={() => openSetting(key)} />;

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>设置与数据</Text><Text style={styles.title}>我的</Text>
      <SectionTitle>提醒与显示</SectionTitle><View style={styles.group}>{renderRow('reminderMode')}{renderRow('riskCardMode')}{renderRow('repaymentReminders')}{renderRow('strictMode')}{renderRow('reducedMotion')}</View>
      <SectionTitle>预算与工作</SectionTitle><View style={styles.group}>{renderRow('monthlyIncome')}{renderRow('essentialMonthlyExpenses')}{renderRow('workDaysPerMonth')}{renderRow('workHoursPerDay')}</View>
      <SectionTitle>账户连接</SectionTitle><View style={styles.group}><Row label="银行与支付平台" value="未连接" onPress={() => setIntegration('bank')} /><Row label="Root 通知增强" value="未配置" onPress={() => setIntegration('root')} /><Row label="账号与云同步" value="本地模式" onPress={() => setIntegration('sync')} /></View>
      <SectionTitle>诊断日志 · {logVersion >= 0 ? entries.length : 0}</SectionTitle>
      <View style={styles.log}>{entries.length ? entries.slice(0, 8).map((entry, index) => <Text style={styles.logText} key={`${entry.at}-${index}`}>{entry.at.slice(11, 19)}  {entry.event}</Text>) : <Text style={styles.logText}>暂无日志记录</Text>}</View>
      <Row label="隐私说明" value="查看" onPress={() => setIntegration('privacy')} />
      <Pressable onPress={clearLogs} accessibilityRole="button" style={styles.clear}><Text style={styles.clearText}>清空诊断日志</Text></Pressable>
    </ScrollView>
    <Modal visible={!!activeKey} transparent animationType={settings.reducedMotion ? 'none' : 'fade'} onRequestClose={() => setActiveKey(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{activeKey ? definitions[activeKey]?.title : ''}</Text>
        <Text style={styles.description}>{activeKey ? definitions[activeKey]?.description : ''}</Text>
        {activeKey && definitions[activeKey]?.numeric ? <><TextInput value={numberValue} onChangeText={setNumberValue} keyboardType="decimal-pad" style={styles.input} /><View style={styles.actions}><Text onPress={() => setActiveKey(null)} style={styles.cancel}>取消</Text><Text onPress={saveNumber} style={styles.save}>保存</Text></View></> : activeKey && definitions[activeKey]?.choices?.map((choice) => <Pressable key={String(choice.value)} onPress={() => saveChoice(activeKey, choice.value)} style={styles.option}><Text style={styles.optionLabel}>{choice.label}</Text>{settings[activeKey] === choice.value && <Text style={styles.selected}>已选择</Text>}</Pressable>)}
      </View></View>
    </Modal>
    <Modal visible={!!integration} transparent animationType={settings.reducedMotion ? 'none' : 'fade'} onRequestClose={() => setIntegration(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>{integration ? integrations[integration].title : ''}</Text><Text style={styles.detail}>{integration ? integrations[integration].body : ''}</Text><Pressable onPress={() => setIntegration(null)} style={styles.done}><Text style={styles.doneText}>知道了</Text></Pressable></View></View>
    </Modal>
  </View>;
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}  ›</Text></Pressable>; }

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:colors.background},scroll:{padding:spacing.lg,paddingBottom:90},kicker:{fontSize:12,color:colors.muted},title:{fontSize:25,fontWeight:'800',color:colors.ink,marginTop:4},group:{paddingHorizontal:14,borderWidth:1,borderColor:colors.line,borderRadius:8,backgroundColor:colors.surface},row:{minHeight:48,borderBottomWidth:1,borderBottomColor:colors.line,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},rowLabel:{fontSize:12,color:colors.ink,flexShrink:1},rowValue:{fontSize:11,color:colors.muted,fontWeight:'700'},pressed:{opacity:.65},log:{backgroundColor:'#303331',borderRadius:8,padding:12,minHeight:64},logText:{fontFamily:'monospace',fontSize:10,color:'#E7E9E6',lineHeight:17},clear:{minHeight:46,justifyContent:'center',alignItems:'center'},clearText:{fontSize:12,color:colors.danger,fontWeight:'800'},backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.38)'},sheet:{backgroundColor:colors.surface,borderTopLeftRadius:14,borderTopRightRadius:14,padding:20,paddingBottom:30},sheetTitle:{fontSize:18,fontWeight:'900',color:colors.ink},description:{fontSize:12,lineHeight:18,color:colors.muted,marginTop:8,marginBottom:12},input:{height:46,borderWidth:1,borderColor:colors.line,borderRadius:8,paddingHorizontal:12,color:colors.ink,fontSize:16},actions:{flexDirection:'row',justifyContent:'flex-end',gap:24,marginTop:18},cancel:{fontSize:13,color:colors.muted},save:{fontSize:13,color:colors.success,fontWeight:'800'},option:{minHeight:48,borderBottomWidth:1,borderBottomColor:colors.line,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},optionLabel:{fontSize:13,color:colors.ink},selected:{fontSize:11,color:colors.success,fontWeight:'700'},detail:{fontSize:13,color:colors.ink,lineHeight:21,marginTop:14},done:{height:44,backgroundColor:colors.accent,borderRadius:8,alignItems:'center',justifyContent:'center',marginTop:20},doneText:{fontSize:12,color:colors.surface,fontWeight:'800'} });
