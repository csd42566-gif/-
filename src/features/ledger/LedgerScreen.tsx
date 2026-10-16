import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LedgerState, PendingTransaction, TransactionType } from '../../core/model/finance';
import { colors, spacing } from '../../ui/theme';
import { PressableCard } from '../../ui/components/PressableCard';
import { SectionTitle } from '../../ui/components/SectionTitle';

type ReviewAction = 'accept' | 'dismiss';
type FilterType = 'all' | TransactionType;

export function LedgerScreen({ state, onAdd, onReviewPending }: {
  state: LedgerState;
  onAdd: () => void;
  onReviewPending: (id: string, action: ReviewAction, edits?: Partial<Pick<PendingTransaction, 'amount' | 'accountId' | 'category'>>) => void;
}) {
  const [type, setType] = useState<FilterType>('all');
  const [accountId, setAccountId] = useState('all');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [editing, setEditing] = useState<PendingTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const now = new Date();
  const visible = useMemo(() => state.transactions.filter((transaction) => {
    const date = new Date(transaction.occurredAt);
    return (type === 'all' || transaction.type === type)
      && (accountId === 'all' || transaction.accountId === accountId || transaction.toAccountId === accountId)
      && (period === 'all' || (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()));
  }), [state.transactions, type, accountId, period]);
  const expenseTotal = visible.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0);
  const beginEdit = (item: PendingTransaction) => { setEditing(item); setEditAmount(String(item.amount)); setEditCategory(item.category ?? ''); };
  const commitEdit = () => {
    const amount = Number(editAmount);
    if (!editing || !Number.isFinite(amount) || amount <= 0) return;
    onReviewPending(editing.id, 'accept', { amount, category: editCategory.trim() || undefined });
    setEditing(null);
  };

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>本月账本</Text><Text style={styles.title}>交易明细</Text>
      <View style={styles.summary}><Text style={styles.label}>当前筛选支出</Text><Text style={styles.total}>¥{expenseTotal.toFixed(2)}</Text><Text style={styles.caption}>转账独立记录，不计入收入或消费</Text></View>
      <SectionTitle>待确认识别 · {state.pendingTransactions.length}</SectionTitle>
      {state.pendingTransactions.length ? state.pendingTransactions.map((item) => <PressableCard key={item.id} style={styles.pending}>
        <View style={styles.row}><Text style={styles.name}>{item.category ?? (item.type === 'income' ? '识别收入' : '识别支出')}</Text><Text style={styles.amount}>¥{item.amount.toFixed(2)}</Text></View>
        <Text style={styles.caption}>{item.note || '识别到一笔交易'} · 置信度 {Math.round(item.confidence * 100)}% · {item.source === 'notification' ? '通知' : item.source}</Text>
        <View style={styles.actions}><Text onPress={() => onReviewPending(item.id, 'dismiss')} style={styles.dismiss}>忽略</Text><Text onPress={() => beginEdit(item)} style={styles.edit}>编辑</Text><Text onPress={() => onReviewPending(item.id, 'accept')} style={styles.accept}>确认</Text></View>
      </PressableCard>) : <View style={styles.empty}><Text style={styles.emptyTitle}>没有待确认记录</Text><Text style={styles.caption}>短信、通知和账单接入后，识别结果会先在这里核对。</Text></View>}
      <SectionTitle>筛选</SectionTitle>
      <View style={styles.filters}>
        <Choice label={period === 'month' ? '本月' : '全部月份'} onPress={() => setPeriod(period === 'month' ? 'all' : 'month')} />
        {(['all', 'expense', 'income', 'transfer'] as FilterType[]).map((item) => <Choice key={item} label={{ all: '全部', expense: '支出', income: '收入', transfer: '转账' }[item]} selected={type === item} onPress={() => setType(item)} />)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountFilters}>
        <Choice label="全部账户" selected={accountId === 'all'} onPress={() => setAccountId('all')} />
        {state.accounts.map((account) => <Choice key={account.id} label={account.name} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />)}
      </ScrollView>
      <SectionTitle>交易 · {visible.length}</SectionTitle>
      {visible.map((transaction) => <PressableCard key={transaction.id} style={styles.transaction}>
        <View style={styles.row}><Text style={styles.name}>{transaction.category ?? (transaction.type === 'income' ? '收入' : transaction.type === 'transfer' ? '账户转账' : '未分类')}</Text><Text style={[styles.amount, transaction.type === 'income' ? styles.income : transaction.type === 'expense' ? styles.expense : styles.transfer]}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '↔'}¥{transaction.amount.toFixed(2)}</Text></View>
        <Text style={styles.caption}>{transaction.occurredAt.slice(0, 16).replace('T', ' ')} · {state.accounts.find((account) => account.id === transaction.accountId)?.name ?? '账户已移除'}{transaction.toAccountId ? ` → ${state.accounts.find((account) => account.id === transaction.toAccountId)?.name ?? '账户'}` : ''}{transaction.note ? ` · ${transaction.note}` : ''}</Text>
      </PressableCard>)}
      {!visible.length && <View style={styles.empty}><Text style={styles.caption}>这个筛选条件下还没有交易。</Text></View>}
      <Pressable onPress={onAdd} accessibilityRole="button" style={styles.add}><Text style={styles.addText}>＋ 记一笔</Text></Pressable>
    </ScrollView>
    <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>核对识别记录</Text><Text style={styles.label}>金额</Text><TextInput value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" style={styles.input} /><Text style={styles.label}>分类</Text><TextInput value={editCategory} onChangeText={setEditCategory} style={styles.input} /><View style={styles.sheetActions}><Text onPress={() => setEditing(null)} style={styles.dismiss}>取消</Text><Text onPress={commitEdit} style={styles.accept}>确认并记账</Text></View></View></View>
    </Modal>
  </View>;
}

function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.background},scroll:{padding:spacing.lg,paddingBottom:90},kicker:{fontSize:12,color:colors.muted},title:{fontSize:25,fontWeight:'800',color:colors.ink,marginTop:4},summary:{backgroundColor:colors.soft,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:spacing.lg,marginTop:spacing.lg},label:{fontSize:12,color:colors.muted},total:{fontSize:30,fontWeight:'900',color:colors.ink,marginTop:4},caption:{fontSize:11,color:colors.muted,marginTop:5},pending:{marginBottom:8,borderColor:colors.warning},transaction:{marginBottom:8},row:{flexDirection:'row',justifyContent:'space-between',gap:8},name:{fontSize:13,fontWeight:'700',color:colors.ink,flexShrink:1},amount:{fontSize:13,fontWeight:'800',color:colors.ink},income:{color:colors.success},expense:{color:colors.danger},transfer:{color:colors.accent},actions:{flexDirection:'row',justifyContent:'flex-end',gap:20,marginTop:12},dismiss:{fontSize:12,color:colors.muted,fontWeight:'700'},edit:{fontSize:12,color:colors.accent,fontWeight:'700'},accept:{fontSize:12,color:colors.success,fontWeight:'800'},empty:{padding:14,borderWidth:1,borderColor:colors.line,borderRadius:8,backgroundColor:colors.surface},emptyTitle:{fontSize:13,color:colors.ink,fontWeight:'700'},filters:{flexDirection:'row',flexWrap:'wrap',gap:6},accountFilters:{gap:6,paddingVertical:9},choice:{minHeight:32,paddingHorizontal:10,justifyContent:'center',borderRadius:8,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface},choiceSelected:{backgroundColor:colors.accentSoft,borderColor:colors.accent},choiceText:{fontSize:11,color:colors.muted},choiceTextSelected:{color:colors.ink,fontWeight:'800'},add:{alignItems:'center',padding:16},addText:{fontSize:13,fontWeight:'800',color:colors.accent},backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.38)'},sheet:{padding:20,paddingBottom:30,backgroundColor:colors.surface,borderTopLeftRadius:16,borderTopRightRadius:16},sheetTitle:{fontSize:18,fontWeight:'800',color:colors.ink,marginBottom:16},input:{height:44,borderWidth:1,borderColor:colors.line,borderRadius:8,paddingHorizontal:12,color:colors.ink,marginTop:6,marginBottom:12},sheetActions:{flexDirection:'row',justifyContent:'flex-end',gap:22,marginTop:8}
});
