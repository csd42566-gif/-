import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EssentialItem } from '../../core/model/finance';
import { colors, radius, spacing } from '../../ui/theme';

type EditingItem = EssentialItem & { isNew: boolean };

export function EssentialItemsSection({ items, reducedMotion, onChange }: {
  items: EssentialItem[];
  reducedMotion: boolean;
  onChange: (items: EssentialItem[]) => void;
}) {
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const startNew = () => {
    setEditing({ id: 'essential-' + Date.now().toString(36), name: '', amount: 0, isNew: true });
    setName('');
    setAmount('0');
    setError('');
  };
  const startEdit = (item: EssentialItem) => {
    setEditing({ ...item, isNew: false });
    setName(item.name);
    setAmount(String(item.amount));
    setError('');
  };
  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));
  const save = () => {
    if (!editing) return;
    const normalizedName = name.trim();
    const parsedAmount = Number(amount);
    if (!normalizedName) { setError('请输入名称。'); return; }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) { setError('请输入不小于 0 的金额。'); return; }
    const nextItem: EssentialItem = { id: editing.id, name: normalizedName.slice(0, 40), amount: Math.round(parsedAmount * 100) / 100 };
    onChange(editing.isNew ? [...items, nextItem] : items.map((item) => item.id === editing.id ? nextItem : item));
    setEditing(null);
  };

  return <>
    {items.map((item) => <View key={item.id} style={styles.row}>
      <Pressable onPress={() => startEdit(item)} accessibilityRole="button" accessibilityLabel={`编辑${item.name}`} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.amount}>¥{item.amount.toFixed(2)}</Text>
      </Pressable>
      <Pressable onPress={() => remove(item.id)} accessibilityRole="button" accessibilityLabel={`删除${item.name}`} style={styles.delete}><Text style={styles.deleteText}>删除</Text></Pressable>
    </View>)}
    {!items.length && <Text style={styles.empty}>还没有固定花费明细。</Text>}
    <Pressable onPress={startNew} accessibilityRole="button" style={({ pressed }) => [styles.add, pressed && styles.pressed]}><Text style={styles.addText}>＋ 添加固定花费</Text></Pressable>
    <Modal visible={!!editing} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setEditing(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <Text style={styles.title}>{editing?.isNew ? '添加固定花费' : '编辑固定花费'}</Text>
        <Text style={styles.fieldLabel}>名称</Text>
        <TextInput autoFocus value={name} onChangeText={(value) => { setName(value); setError(''); }} placeholder="例如：视频会员" placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.fieldLabel}>每月金额</Text>
        <TextInput value={amount} onChangeText={(value) => { setAmount(value); setError(''); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}><Pressable onPress={() => setEditing(null)} style={styles.action}><Text style={styles.cancel}>取消</Text></Pressable><Pressable onPress={save} style={styles.action}><Text style={styles.save}>保存</Text></Pressable></View>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  row: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: 12, color: colors.ink, flex: 1 },
  amount: { fontSize: 12, color: colors.ink, fontWeight: '800', fontVariant: ['tabular-nums'] },
  delete: { minHeight: 40, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  deleteText: { fontSize: 11, color: colors.danger, fontWeight: '700' },
  empty: { fontSize: 11, color: colors.muted, paddingVertical: spacing.sm },
  add: { minHeight: 44, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  addText: { fontSize: 12, color: colors.accent, fontWeight: '800' },
  pressed: { opacity: 0.65 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 30 },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  fieldLabel: { fontSize: 11, color: colors.muted, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 16 },
  error: { fontSize: 11, color: colors.danger, marginTop: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.lg },
  action: { minHeight: 40, justifyContent: 'center' },
  cancel: { fontSize: 13, color: colors.muted },
  save: { fontSize: 13, color: colors.accent, fontWeight: '800' },
});