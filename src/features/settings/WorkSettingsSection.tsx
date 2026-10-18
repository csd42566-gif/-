import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WorkProfile } from '../../core/model/finance';
import { colors, spacing, radius } from '../../ui/theme';
import { isValidDateKey, mealAllowanceAmount, withMealAllowance } from './workSettings';

type WorkFieldKey =
  | 'monthlyIncome'
  | 'probationIncome'
  | 'regularStartDate'
  | 'restDaysPerMonth'
  | 'workHoursPerDay'
  | 'payday'
  | 'cycleStartDay'
  | 'fullAttendanceBonus'
  | 'mealAllowance';

type WorkField = {
  key: WorkFieldKey;
  section: 'salary' | 'attendance';
  title: string;
  description: string;
  keyboardType?: 'decimal-pad' | 'number-pad';
};

const fields: WorkField[] = [
  { key: 'monthlyIncome', section: 'salary', title: '转正底薪', description: '只作为日薪基数，不包含餐补和全勤奖。', keyboardType: 'decimal-pad' },
  { key: 'probationIncome', section: 'salary', title: '试用期底薪', description: '试用期工资周期的日薪基数。', keyboardType: 'decimal-pad' },
  { key: 'regularStartDate', section: 'salary', title: '转正日', description: '格式 YYYY-MM-DD；周期起点早于该日期时按试用期计算。' },
  { key: 'payday', section: 'salary', title: '发薪日', description: '填写每月发薪日，如 15。', keyboardType: 'number-pad' },
  { key: 'cycleStartDay', section: 'salary', title: '周期起始日', description: '如 10，表示每月 10 日到次月 9 日。', keyboardType: 'number-pad' },
  { key: 'mealAllowance', section: 'salary', title: '餐补', description: '转正后固定发放，不计入日薪基数。', keyboardType: 'decimal-pad' },
  { key: 'fullAttendanceBonus', section: 'salary', title: '全勤奖', description: '转正且全勤达成时单独发放。', keyboardType: 'decimal-pad' },
  { key: 'restDaysPerMonth', section: 'attendance', title: '月休天数', description: '用于计算周期应出勤天数。', keyboardType: 'number-pad' },
  { key: 'workHoursPerDay', section: 'attendance', title: '每天工时', description: '用于计算时薪。', keyboardType: 'decimal-pad' },
];

export function WorkSettingsSection({ profile, section, reducedMotion, onChange }: {
  profile: WorkProfile;
  section: 'salary' | 'attendance';
  reducedMotion: boolean;
  onChange: (patch: Partial<WorkProfile>) => Promise<void>;
}) {
  const [activeField, setActiveField] = useState<WorkField | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const open = (field: WorkField) => {
    setActiveField(field);
    setInput(inputValue(profile, field.key));
    setError('');
  };

  const save = async () => {
    if (!activeField) return;
    let patch: Partial<WorkProfile>;
    if (activeField.key === 'mealAllowance') {
      const value = Number(input.trim());
      if (!Number.isFinite(value) || value < 0) {
        setError(fieldError(activeField.key));
        return;
      }
      patch = { allowances: withMealAllowance(profile, value).allowances };
    } else {
      const parsed = parseField(activeField.key, input);
      if (!parsed) {
        setError(fieldError(activeField.key));
        return;
      }
      patch = parsed;
    }
    setError('');
    try {
      await onChange(patch);
      setActiveField(null);
    } catch {
      setError('保存失败，请重试。');
    }
  };

  return <>
    {fields.filter((field) => field.section === section).map((field) => <Pressable key={field.key} onPress={() => open(field)} accessibilityRole="button" accessibilityLabel={`修改${field.title}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.label}>{field.title}</Text>
      <Text style={styles.value}>{displayValue(profile, field.key)}</Text>
    </Pressable>)}
    <Modal visible={!!activeField} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setActiveField(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.title}>{activeField?.title ?? ''}</Text>
        <Text style={styles.description}>{activeField?.description ?? ''}</Text>
        <TextInput
          autoFocus
          value={input}
          onChangeText={setInput}
          keyboardType={activeField?.keyboardType}
          placeholder={activeField?.key === 'regularStartDate' ? '2026-11-10' : '请输入数值'}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable onPress={() => setActiveField(null)}><Text style={styles.cancel}>取消</Text></Pressable>
          <Pressable onPress={() => { void save(); }}><Text style={styles.save}>保存</Text></Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}

function inputValue(profile: WorkProfile, key: WorkFieldKey): string {
  if (key === 'regularStartDate') return profile.regularStartDate ?? '';
  if (key === 'probationIncome') return String(profile.probationIncome ?? profile.monthlyIncome);
  if (key === 'fullAttendanceBonus') return String(profile.fullAttendanceBonus ?? 0);
  if (key === 'mealAllowance') return String(mealAllowanceAmount(profile));
  return String(profile[key]);
}

function displayValue(profile: WorkProfile, key: WorkFieldKey): string {
  if (key === 'regularStartDate') return profile.regularStartDate ?? '未设置';
  if (key === 'mealAllowance') return `¥${mealAllowanceAmount(profile).toFixed(2)}`;
  if (key === 'fullAttendanceBonus') return `¥${(profile.fullAttendanceBonus ?? 0).toFixed(2)}`;
  if (key === 'monthlyIncome' || key === 'probationIncome') return `¥${Number(profile[key] ?? profile.monthlyIncome).toFixed(2)}`;
  if (key === 'restDaysPerMonth') return `${profile.restDaysPerMonth} 天`;
  if (key === 'workHoursPerDay') return `${profile.workHoursPerDay} 小时`;
  return `${profile[key]} 号`;
}

function parseField(key: WorkFieldKey, raw: string): Partial<WorkProfile> | null {
  const text = raw.trim();
  if (key === 'regularStartDate') return isValidDateKey(text) ? { regularStartDate: text } : null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  if (key === 'restDaysPerMonth') return Number.isInteger(value) && value >= 0 && value <= 31 ? { restDaysPerMonth: value } : null;
  if (key === 'workHoursPerDay') return value > 0 && value <= 24 ? { workHoursPerDay: value } : null;
  if (key === 'payday' || key === 'cycleStartDay') return Number.isInteger(value) && value >= 1 && value <= 31 ? { [key]: value } : null;
  if (key === 'monthlyIncome' || key === 'probationIncome') return value > 0 ? { [key]: value } : null;
  if (key === 'fullAttendanceBonus') return value >= 0 ? { fullAttendanceBonus: value } : null;
  return null;
}


function fieldError(key: WorkFieldKey): string {
  if (key === 'regularStartDate') return '请输入真实日期，格式 YYYY-MM-DD。';
  if (key === 'payday' || key === 'cycleStartDay') return '请输入 1 到 31 之间的整数。';
  if (key === 'restDaysPerMonth') return '请输入 0 到 31 之间的整数。';
  if (key === 'workHoursPerDay') return '请输入大于 0 且不超过 24 的小时数。';
  return '请输入有效且不小于 0 的金额。';
}

const styles = StyleSheet.create({
  row: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 12, color: colors.ink, flexShrink: 1 },
  value: { fontSize: 11, color: colors.muted, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.65 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: spacing.lg, paddingBottom: 30 },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  description: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8, marginBottom: 12 },
  input: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 18 },
  cancel: { fontSize: 13, color: colors.muted },
  save: { fontSize: 13, color: colors.success, fontWeight: '800' },
  error: { fontSize: 11, color: colors.danger, marginTop: 8 },
});