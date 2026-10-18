import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PendingTransaction } from '../../core/model/finance';
import { colors, spacing, radius } from '../../ui/theme';
import { RepaymentProvider } from './parsers';
import { previewRepaymentText } from './repaymentImport';
import { createInstallmentDraft, InstallmentDraft, InstallmentType, parseAlipayInstallmentText } from './installments';

export interface RepaymentImportOutcome {
  duplicate: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onImport: (provider: RepaymentProvider, text: string) => Promise<RepaymentImportOutcome>;
  onImportInstallment: (provider: RepaymentProvider, draft: InstallmentDraft) => Promise<RepaymentImportOutcome>;
}

const providerChoices: Array<{ value: RepaymentProvider; label: string }> = [
  { value: 'douyin', label: '抖音' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'dew', label: '得物' },
  { value: 'jd', label: '京东' },
  { value: 'other', label: '其他' },
];

const typeChoices: Array<{ value: InstallmentType; label: string }> = [
  { value: 'fixed-payment', label: '固定每期' },
  { value: 'annuity', label: '等额本息' },
  { value: 'equal-principal', label: '等额本金' },
];

const errorMessages: Record<string, string> = {
  'repayment-import-not-repayment': '没有识别到代还或还款内容，请确认粘贴的是还款记录。',
  'repayment-import-amount-invalid': '没有识别到有效金额，请检查文本里是否包含金额。',
  'installment-data-invalid': '没有识别到分期本金或期数，请手动填写。',
  'installment-principal-invalid': '请输入大于 0 的剩余本金。',
  'installment-periods-invalid': '请输入大于 0 的分期期数。',
};

function describeError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return errorMessages[code] ?? '导入失败，请重试。';
}

function previewOf(provider: RepaymentProvider, text: string): { candidate?: PendingTransaction; error?: string } {
  if (!text.trim()) return {};
  try {
    return { candidate: previewRepaymentText(provider, text) };
  } catch (error) {
    return { error: describeError(error) };
  }
}

export function RepaymentImportSheet({ visible, onClose, onImport, onImportInstallment }: Props) {
  const [mode, setMode] = useState<'normal' | 'installment'>('normal');
  const [provider, setProvider] = useState<RepaymentProvider>('alipay');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [installmentDraft, setInstallmentDraft] = useState<InstallmentDraft | null>(null);
  const [debtName, setDebtName] = useState('借呗分期');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [periods, setPeriods] = useState('');
  const [paidPeriods, setPaidPeriods] = useState('0');
  const [annualRate, setAnnualRate] = useState('');
  const [repaymentType, setRepaymentType] = useState<InstallmentType>('fixed-payment');
  const [fixedPayment, setFixedPayment] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const preview = useMemo(() => previewOf(provider, text), [provider, text]);

  const close = () => { setText(''); setMessage(''); setInstallmentDraft(null); onClose(); };

  const applyParsedDraft = (draft: InstallmentDraft) => {
    setInstallmentDraft(draft);
    setDebtName(draft.debtName);
    setPrincipal(String(draft.remainingPrincipal));
    setInterest(String(draft.totalInterest));
    setPeriods(String(draft.periods.length));
    setPaidPeriods(String(draft.paidPeriods));
    setAnnualRate(draft.annualRate != null ? String(draft.annualRate) : '');
    setRepaymentType(draft.repaymentType);
    setFixedPayment(draft.fixedPayment != null ? String(draft.fixedPayment) : '');
    setFirstDueDate(draft.firstDueDate);
  };

  const changeText = (value: string) => {
    setText(value);
    setMessage('');
    if (mode !== 'installment') return;
    try {
      applyParsedDraft(parseAlipayInstallmentText(value));
    } catch {
      setInstallmentDraft(null);
    }
  };

  const generateSchedule = () => {
    try {
      const draft = createInstallmentDraft({
        debtName,
        remainingPrincipal: Number(principal),
        totalInterest: Number(interest || 0),
        totalPeriods: Number(periods),
        paidPeriods: Number(paidPeriods || 0),
        annualRate: annualRate ? Number(annualRate) : undefined,
        repaymentType,
        fixedPayment: fixedPayment ? Number(fixedPayment) : undefined,
        firstDueDate,
      });
      setInstallmentDraft(draft);
      setMessage(`已生成 ${draft.periods.length} 期还款计划`);
    } catch (error) {
      setInstallmentDraft(null);
      setMessage(describeError(error));
    }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'installment') {
        if (!installmentDraft) return;
        const outcome = await onImportInstallment(provider, installmentDraft);
        if (outcome.duplicate) setMessage('这笔分期已经导入过了，没有重复添加。');
        else close();
      } else {
        if (!preview.candidate) return;
        const outcome = await onImport(provider, text);
        if (outcome.duplicate) setMessage('这笔代还已经导入过了，没有重复添加。');
        else close();
      }
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const firstPeriod = installmentDraft?.periods[0];
  const canSubmit = mode === 'installment' ? !!installmentDraft : !!preview.candidate;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.dismiss} onPress={close} accessibilityLabel="关闭导入" />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.title}>导入代还</Text>
        <View style={styles.modeChoices}>
          <Choice label="普通代还" selected={mode === 'normal'} onPress={() => { setMode('normal'); setMessage(''); }} />
          <Choice label="分期还款" selected={mode === 'installment'} onPress={() => { setMode('installment'); setMessage(''); }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>{mode === 'installment' ? '粘贴借呗还款计划，或手动填写本金、年利率和期数。生成后只导入本期，未来期数保存在欠款计划里。' : '复制各平台的还款记录或通知文本粘贴到下方。导入后进入待确认，不会直接扣款。'}</Text>
          <View style={styles.choices}>
            {providerChoices.map((choice) => <Choice key={choice.value} label={choice.label} selected={provider === choice.value} onPress={() => setProvider(choice.value)} />)}
          </View>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={changeText}
            placeholder={mode === 'installment' ? '粘贴借呗还款计划文本，例如：剩余本金 1157.47，总利息 115.47，剩余9期，每月14日应还 141.43' : '例如：支付宝 2026-10-15 12:10 代还花呗 88.00元，付款成功'}
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            accessibilityLabel="代还文本"
          />
          {mode === 'installment' && <>
            <View style={styles.fieldGrid}>
              <Field label="欠款名称" value={debtName} onChangeText={setDebtName} />
              <Field label="剩余本金（元）" value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
              <Field label="总利息（元）" value={interest} onChangeText={setInterest} keyboardType="decimal-pad" />
              <Field label="剩余期数" value={periods} onChangeText={setPeriods} keyboardType="number-pad" />
              <Field label="已还期数" value={paidPeriods} onChangeText={setPaidPeriods} keyboardType="number-pad" />
              <Field label="年利率（%）" value={annualRate} onChangeText={setAnnualRate} keyboardType="decimal-pad" />
              <Field label="每期还款（元）" value={fixedPayment} onChangeText={setFixedPayment} keyboardType="decimal-pad" />
              <Field label="首期还款日" value={firstDueDate} onChangeText={setFirstDueDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.typeChoices}>
              {typeChoices.map((choice) => <Choice key={choice.value} label={choice.label} selected={repaymentType === choice.value} onPress={() => setRepaymentType(choice.value)} />)}
            </View>
            <Pressable onPress={generateSchedule} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>重新生成分期表</Text></Pressable>
            {installmentDraft && firstPeriod && <>
              <View style={styles.preview}>
                <PreviewRow label="本期" value={`第 ${installmentDraft.paidPeriods + 1} / ${installmentDraft.paidPeriods + installmentDraft.periods.length} 期`} />
                <PreviewRow label="本期本金" value={`¥${firstPeriod.principalAmount.toFixed(2)}`} />
                <PreviewRow label="本期利息" value={`¥${firstPeriod.interestAmount.toFixed(2)}`} />
                <PreviewRow label="本期总还款" value={`¥${firstPeriod.totalAmount.toFixed(2)}`} />
                <PreviewRow label="首期还款日" value={firstPeriod.dueDate} />
                <PreviewRow label="剩余计划" value={`${installmentDraft.periods.length} 期`} />
              </View>
              <Text style={styles.note}>确认后账户扣款为本期总额，欠款只减少本金，利息记入还款支出。</Text>
            </>}
          </>}
          {mode === 'normal' && preview.candidate && <View style={styles.preview}>
            <PreviewRow label="金额" value={`¥${preview.candidate.amount.toFixed(2)}`} />
            <PreviewRow label="时间" value={preview.candidate.occurredAt.slice(0, 16).replace('T', ' ')} />
            <PreviewRow label="代还对象" value={preview.candidate.counterparty ?? '未识别，确认时选择欠款'} />
            <PreviewRow label="识别置信度" value={`${Math.round(preview.candidate.confidence * 100)}%`} />
          </View>}
          {mode === 'normal' && !!preview.error && <Text style={styles.error}>{preview.error}</Text>}
          {!!message && <Text style={styles.error}>{message}</Text>}
        </ScrollView>
        <Pressable disabled={!canSubmit || busy} onPress={submit} style={({ pressed }) => [styles.primary, (!canSubmit || busy) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{mode === 'installment' ? '创建欠款并导入本期' : '导入到待确认'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

function Field({ label, value, onChangeText, keyboardType, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'decimal-pad' | 'number-pad'; placeholder?: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType ?? 'default'} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.fieldInput} /></View>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 28 },
  grab: { width: 40, height: 4, borderRadius: radius.sm, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink },
  hint: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 6 },
  modeChoices: { flexDirection: 'row', gap: 8, marginTop: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  typeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.muted },
  chipTextSelected: { color: colors.ink, fontWeight: '800' },
  input: { minHeight: 100, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginTop: 12, color: colors.ink, fontSize: 13 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  field: { width: '47%' },
  fieldLabel: { fontSize: 10, color: colors.muted, marginBottom: 4 },
  fieldInput: { minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, color: colors.ink, fontSize: 12 },
  secondary: { minHeight: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, marginTop: 12 },
  secondaryText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  preview: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  row: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 11, color: colors.muted },
  rowValue: { fontSize: 12, fontWeight: '800', color: colors.ink, flexShrink: 1, textAlign: 'right' },
  note: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 10 },
  error: { fontSize: 11, color: colors.danger, marginTop: 10 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.sm, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  primaryText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
});