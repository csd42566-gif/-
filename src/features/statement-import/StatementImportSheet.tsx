import { ThemedModal } from '../../ui/components/ThemedModal';
import React, { useEffect, useState , useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LedgerState } from '../../core/model/finance';
import { spacing, radius, ThemeColors } from '../../ui/theme';
import { useTheme } from '../../ui/ThemeContext';
import { PickedStatementFile, pickStatementFile, readStatementAsset } from './readStatementFile';
import { ModuleInboxFile, nativeFinance } from '../../integrations/notifications/nativeFinance';
import { previewStatement, StatementImportSummary } from './statementImport';
import { xlsxToStatementText } from './xlsx';
import { StatementProvider, statementProviderLabels } from './statementTypes';

interface Props {
  visible: boolean;
  state: LedgerState;
  onClose: () => void;
  onImport: (provider: StatementProvider, text: string) => Promise<StatementImportSummary>;
  onCreateQuickAccount: (sourceLabel: string) => Promise<unknown>;
}

const providerChoices: StatementProvider[] = ['alipay', 'wechat', 'cmb', 'icbc', 'ccb', 'boc', 'citic', 'other'];
const errorMessages: Record<string, string> = {
  'alipay-statement-header-invalid': '没有找到支付宝账单表头，请选择支付宝导出的 CSV 文件。',
  'statement-header-invalid': '没有找到可识别的账单表头，请确认文件包含时间、金额等列。',
  'statement-file-encoding-unsupported': '无法识别文件编码，请在电脑上另存为 UTF-8 或 GBK 后重试。',
  'statement-file-read-failed': '文件读取失败，请确认文件仍在本机并重新选择。',
  'statement-file-read-unavailable': '当前运行方式无法读取文件，请使用安装版 App。',
};

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return errorMessages[message] ?? '导入失败，请检查账单文件后重试。';
}

export function StatementImportSheet({ visible, state, onClose, onImport, onCreateQuickAccount }: Props) {
  const styles = useStyles();
  const [provider, setProvider] = useState<StatementProvider>('alipay');
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<StatementImportSummary | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [inboxFiles, setInboxFiles] = useState<ModuleInboxFile[]>([]);
  const [inboxMessage, setInboxMessage] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    if (visible) return;
    setFileName(''); setText(''); setSummary(null); setError(''); setMessage(''); setBusy(false); setProvider('alipay');
  }, [visible]);

  useEffect(() => {
    if (!text) return;
    try {
      setSummary(previewStatement(state, provider, text));
      setError('');
    } catch (caught) {
      setSummary(null);
      setError(describeError(caught));
    }
  }, [provider, state, text]);

  useEffect(() => {
    if (!visible) return;
    setInboxMessage('');
    nativeFinance.listModuleInbox().then(setInboxFiles).catch(() => setInboxFiles([]));
  }, [visible]);

  const applyPicked = (picked: PickedStatementFile) => {
    const statementText = picked.kind === 'xlsx' ? xlsxToStatementText(picked.bytes) : picked.text;
    setFileName(picked.name);
    setText(statementText);
    setSummary(previewStatement(state, provider, statementText));
  };

  const openInboxFile = async (file: ModuleInboxFile) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const picked = await readStatementAsset(file.displayName, file.uri);
      applyPicked(picked);
      setInboxMessage(`已加载 ${file.displayName}`);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };
  const chooseFile = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const picked = await pickStatementFile();
      if (!picked) return;
      applyPicked(picked);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const importableInbox = inboxFiles.filter((file) => /\.(csv|tsv|xls|xlsx)$/i.test(file.displayName));
  const createAccountForProvider = async () => {
    if (creatingAccount) return;
    setCreatingAccount(true);
    setError('');
    try {
      await onCreateQuickAccount(statementProviderLabels[provider]);
    } catch {
      setError('创建账户失败，请重试。');
    } finally {
      setCreatingAccount(false);
    }
  };

  const submit = async () => {
    if (!text || !summary || summary.importableCount === 0 || busy) return;
    setBusy(true); setError('');
    try {
      const imported = await onImport(provider, text);
      setSummary(imported);
      setMessage(imported.importableCount > 0
        ? `已导入 ${imported.importableCount} 笔有效记录，${imported.repaymentCount} 笔还款进入待确认。`
        : '没有需要新增的记录。');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return <ThemedModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="关闭账单导入" />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>导入账单</Text>
          {!!message && !state.accounts.length && <View style={styles.accountNotice}><Text style={styles.accountNoticeText}>你的账还没有账户 · 先创建一个账户才能入账</Text><Pressable disabled={creatingAccount} onPress={() => { void createAccountForProvider(); }} accessibilityRole="button" style={[styles.accountNoticeAction, creatingAccount && styles.disabled]}><Text style={styles.accountNoticeActionText}>创建账户</Text></Pressable></View>}
          <Text style={styles.hint}>支持支付宝、微信、招商/工商/建设/中国/中信银行及常见 App 的 CSV/TSV/XLS/XLSX 账单。选择文件后先预览，确认后才写入账本。</Text>
          <View style={styles.choices}>
            {providerChoices.map((choice) => <Pressable key={choice} onPress={() => setProvider(choice)} accessibilityRole="button" accessibilityState={{ selected: provider === choice }} style={({ pressed }) => [styles.chip, provider === choice && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.chipText, provider === choice && styles.chipTextSelected]}>{statementProviderLabels[choice]}</Text></Pressable>)}
          </View>
          <Pressable disabled={busy} onPress={chooseFile} accessibilityRole="button" style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}><Text style={styles.fileButtonText}>{fileName ? '重新选择文件' : '选择账单 CSV / TSV'}</Text></Pressable>
          {importableInbox.length > 0 && <View style={styles.inbox}>
            <Text style={styles.inboxTitle}>模块收件箱</Text>
            {importableInbox.slice(0, 5).map((file) => <Pressable key={file.inboxName} onPress={() => openInboxFile(file)} accessibilityRole="button" style={({ pressed }) => [styles.inboxRow, pressed && styles.pressed]}><View style={styles.inboxCopy}><Text style={styles.inboxName}>{file.displayName}</Text><Text style={styles.inboxMeta}>{file.size} 字节 · 点击加载</Text></View><Text style={styles.inboxAction}>导入</Text></Pressable>)}
          </View>}
          {!!inboxMessage && <Text style={styles.success}>{inboxMessage}</Text>}
          {inboxFiles.length > importableInbox.length && <Text style={styles.note}>PDF 文件暂不支持，请先导出为 CSV/XLSX。</Text>}
          {!!fileName && <Text style={styles.fileName}>{fileName}</Text>}
          {summary && <View style={styles.summary}>
            <SummaryRow label="将导入" value={`${summary.importableCount} 笔`} />
            <SummaryRow label="支出" value={`${summary.expenseCount} 笔 · ¥${summary.expenseTotal.toFixed(2)}`} />
            <SummaryRow label="收入" value={`${summary.incomeCount} 笔 · ¥${summary.incomeTotal.toFixed(2)}`} />
            <SummaryRow label="退款" value={`${summary.refundCount} 笔 · ¥${summary.refundTotal.toFixed(2)}`} />
            <SummaryRow label="还款 / 代还" value={`${summary.repaymentCount} 笔 · 进入待确认`} />
            <SummaryRow label="不计收支" value={`${summary.transferCount} 笔 · 跳过`} />
            <SummaryRow label="交易关闭" value={`${summary.skippedClosed} 笔 · 跳过`} />
            {summary.skippedZero > 0 && <SummaryRow label="0 元订单" value={`${summary.skippedZero} 笔 · 跳过`} />}
            {summary.existingCount > 0 && <SummaryRow label="已存在" value={`${summary.existingCount} 笔 · 不重复导入`} />}
          </View>}
          {summary && <Text style={styles.note}>历史账单只写入记录，不改变账户当前余额；退款会在预算中冲减当月支出。</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
          {message
            ? <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={styles.primaryText}>完成</Text></Pressable>
            : <Pressable disabled={!summary || summary.importableCount === 0 || busy} onPress={submit} accessibilityRole="button" style={({ pressed }) => [styles.primary, (!summary || summary.importableCount === 0 || busy) && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>确认导入</Text></Pressable>}
        </ScrollView>
      </View>
    </View>
  </ThemedModal>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 28 },
  grab: { width: 40, height: 4, borderRadius: radius.sm, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: colors.ink },
  accountNotice: { marginTop: 12, padding: spacing.sm, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, backgroundColor: colors.warningSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountNoticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: colors.warning, fontWeight: '700' },
  accountNoticeAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  accountNoticeActionText: { fontSize: 11, color: colors.accent, fontWeight: '800' },
  hint: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.muted },
  chipTextSelected: { color: colors.ink, fontWeight: '800' },
  fileButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm, marginTop: 14, backgroundColor: colors.accentSoft },
  fileButtonText: { fontSize: 12, fontWeight: '800', color: colors.ink },
  fileName: { fontSize: 11, color: colors.muted, marginTop: 8, fontVariant: ['tabular-nums'] },
  inbox: { marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, overflow: 'hidden' },
  inboxTitle: { fontSize: 11, fontWeight: '800', color: colors.muted, paddingHorizontal: 12, paddingTop: 10 },
  inboxRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
  inboxCopy: { flex: 1 },
  inboxName: { fontSize: 12, fontWeight: '700', color: colors.ink },
  inboxMeta: { fontSize: 10, color: colors.muted, marginTop: 3, fontVariant: ['tabular-nums'] },
  inboxAction: { fontSize: 11, fontWeight: '800', color: colors.accent },
  summary: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  row: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 11, color: colors.muted },
  rowValue: { fontSize: 12, fontWeight: '800', color: colors.ink, flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 10 },
  error: { fontSize: 11, color: colors.danger, marginTop: 10 },
  success: { fontSize: 12, color: colors.success, fontWeight: '800', marginTop: 10 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.sm, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  primaryText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors.accent, colors.accentSoft, colors.danger, colors.ink, colors.line, colors.muted, colors.overlay, colors.success, colors.surface, colors.warning, colors.warningSoft]);
}
