/**
 * 目标页（方案 B 定稿）：想攒的钱清单。
 *
 * 结构（对应 mockups/pages-add-goals-settings.html 的第 2 屏）：
 * 1. 页头：kicker「攒钱 · N 个进行中」+ 标题「目标」+ 右上靶心圆钮（= 新增）。
 * 2. 首卡：进度最高的那个目标用琥珀实色大卡（名称 + 完成度徽章 + 已存大字 + of 目标 + 进度条 + 还差多少）。
 * 3. 其余目标：白卡（名称 + 百分比 + 细进度条 + 已存/目标 + 改动按钮）。
 * 4. 虚线「新建目标」按钮 + 展开后的新建表单。
 *
 * 已存金额由用户手填（存入就改这个数），目标不挂账户、不进流水。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { DEFAULT_CURRENCY, formatCurrencyAmount } from '../src/core/currency';
import { goalDueLabel, goalPercent } from '../src/core/goals';
import { parseAmountToCents } from '../src/core/money';
import { useGoalsStore } from '../src/features/goals/goalsStore';
import type { GoalRow } from '../src/features/goals/goalsStore';
import { Aurora } from '../src/ui/aurora';
import { BottomDock } from '../src/ui/dock';
import { BottomFade } from '../src/ui/bottomFade';
import { TopFade } from '../src/ui/topFade';
import { ConfirmDialog } from '../src/ui/dialog';
import { PageHead } from '../src/ui/pageHead';
import { PressScale } from '../src/ui/pressScale';
import { RADIUS, useTheme, type ThemeColors } from '../src/ui/theme';

export default function Goals() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { goals, loaded, load, add, update, remove } = useGoalsStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editSaved, setEditSaved] = useState('');
  const [error, setError] = useState('');
  /** 删除确认走页内弹窗（src/ui/dialog.tsx），不用系统 Alert。 */
  const [pendingDelete, setPendingDelete] = useState<{
    name: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  /** 进度最高的排最前，用于首卡；其余保持插入顺序。 */
  const ordered = useMemo(() => {
    const list = [...goals];
    list.sort((a, b) => goalPercent(b.targetCents, b.savedCents) - goalPercent(a.targetCents, a.savedCents));
    return list;
  }, [goals]);
  const featured = ordered.length > 0 ? ordered[0] : null;
  const rest = ordered.slice(1);

  const doAdd = async () => {
    const name = newName.trim();
    if (name === '') {
      setError('目标名不能为空。');
      return;
    }
    const targetCents = parseAmountToCents(newTarget);
    if (targetCents === null || targetCents <= 0) {
      setError('目标金额要填大于 0 的数字。');
      return;
    }
    setError('');
    await add({
      name,
      targetCents,
      savedCents: 0,
      currency: DEFAULT_CURRENCY,
      dueAt: 0,
      note: newNote.trim(),
    });
    setShowAdd(false);
    setNewName('');
    setNewTarget('');
    setNewNote('');
  };

  const doSaveSaved = async (id: number) => {
    const savedCents = parseAmountToCents(editSaved);
    if (savedCents === null || savedCents < 0) {
      setError('已存金额只填数字。');
      return;
    }
    setError('');
    await update(id, { savedCents });
    setEditing(null);
  };

  const doRemove = (id: number, name: string) => {
    setPendingDelete({
      name,
      onConfirm: () => {
        setPendingDelete(null);
        void remove(id);
      },
    });
  };

  const startEdit = (goal: GoalRow) => {
    setEditing(goal.id);
    setEditSaved(String(goal.savedCents / 100));
  };

  return (    <Aurora>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHead
          kicker={goals.length > 0 ? `攒钱 · ${goals.length} 个进行中` : '攒钱'}
          title="目标"
          action={
            <PressScale pressedScale={0.9}
              style={[styles.roundBtn, theme.card]}
              accessibilityLabel="新建目标"
              hitSlop={8}
              onPress={() => setShowAdd(true)}
            >
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={7.4} stroke={theme.accent} strokeWidth={2} />
                <Circle cx={12} cy={12} r={2.8} stroke={theme.accent} strokeWidth={2} />
              </Svg>
            </PressScale>
          }
        />

        {loaded && goals.length === 0 && !showAdd && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>还没有目标</Text>
            <Text style={[styles.emptyHint, { color: theme.faint }]}>
              想攒一台相机、一趟旅行，就在这里立个目标。
            </Text>
          </View>
        )}

        {/* 首卡：进度最高的目标 */}
        {featured !== null && (
          <View style={[styles.hero, theme.heroCard]}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroName, { color: theme.heroText }]} numberOfLines={1}>
                {featured.name}
              </Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  已完成 {goalPercent(featured.targetCents, featured.savedCents)}%
                </Text>
              </View>
            </View>

            <Text style={[styles.heroNum, { color: theme.heroText }]} numberOfLines={1}>
              {formatCurrencyAmount(featured.savedCents, featured.currency)}
            </Text>
            <Text style={[styles.heroOf, { color: theme.heroMuted }]} numberOfLines={1}>
              of {formatCurrencyAmount(featured.targetCents, featured.currency)}
            </Text>

            <View style={[styles.heroTrack, { backgroundColor: theme.heroTrack }]}>
              <View
                style={[
                  styles.heroFill,
                  {
                    width: `${Math.max(2, goalPercent(featured.targetCents, featured.savedCents))}%`,
                    backgroundImage: theme.heroFill,
                  },
                ]}
              />
            </View>

            <View style={styles.heroFoot}>
              <Text style={[styles.heroLeft, { color: theme.heroText }]} numberOfLines={1}>
                {featured.savedCents >= featured.targetCents
                  ? '已经攒够了'
                  : `还差 ${formatCurrencyAmount(featured.targetCents - featured.savedCents, featured.currency)}`}
              </Text>
              <Pressable
                style={styles.heroAction}
                onPress={() => (editing === featured.id ? setEditing(null) : startEdit(featured))}
              >
                <Text style={[styles.heroActionText, { color: theme.heroMuted }]}>
                  {editing === featured.id ? '收起' : '改已存 ›'}
                </Text>
              </Pressable>
            </View>

            {editing === featured.id && (
              <EditSavedRow
                theme={theme}
                value={editSaved}
                onChange={setEditSaved}
                onSave={() => void doSaveSaved(featured.id)}
                onCancel={() => setEditing(null)}
              />
            )}
          </View>
        )}

        {/* Pocket 参考：首卡下面有一行「Your goals」+ 右侧「+ New goal」胶囊。 */}
        <View style={styles.listRow}>
          <Text style={[styles.listTitle, { color: theme.text }]}>你的目标</Text>
          <PressScale pressedScale={0.94}
            style={[styles.listAdd, { backgroundColor: theme.cardAlt.backgroundColor }]}
            onPress={() => setShowAdd(true)}
          >
            <Text style={[styles.listAddText, { color: theme.accent }]}>+ 新目标</Text>
          </PressScale>
        </View>

        {/* 其余目标 */}
        {rest.map((g) => {
          const percent = goalPercent(g.targetCents, g.savedCents);
          const remain = g.targetCents - g.savedCents;
          return (
            <View key={g.id} style={[styles.goalCard, theme.card]}>
              <View style={styles.gTop}>
                <Text style={[styles.gName, { color: theme.text }]} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={[styles.gPct, { color: theme.accent }]}>{percent}%</Text>
              </View>

              <View style={[styles.gBar, { backgroundColor: theme.cardAlt.backgroundColor }]}>
                <View
                  style={[
                    styles.gFill,
                    {
                      width: `${Math.max(percent > 0 ? 2 : 0, percent)}%`,
                      backgroundColor: theme.chart[g.id % theme.chart.length],
                    },
                  ]}
                />
              </View>

              <View style={styles.gMeta}>
                <Text style={[styles.gSaved, { color: theme.muted }]} numberOfLines={1}>
                  已存 {formatCurrencyAmount(g.savedCents, g.currency)} /{' '}
                  {formatCurrencyAmount(g.targetCents, g.currency)}
                </Text>
                <Text style={[styles.gHint, { color: theme.faint }]} numberOfLines={1}>
                  {remain > 0
                    ? `还差 ${formatCurrencyAmount(remain, g.currency)}`
                    : remain === 0
                      ? '刚好攒够'
                      : `超出 ${formatCurrencyAmount(-remain, g.currency)}`}
                </Text>
              </View>

              {/* Pocket 参考：卡片底部是「一句说明」+ 右对齐日期，没有按钮行。 */}
              {(g.note !== '' || g.dueAt > 0) && (
                <View style={styles.gFoot}>
                  <Text style={[styles.gNote, { color: theme.faint }]} numberOfLines={1}>
                    {g.note}
                  </Text>
                  {g.dueAt > 0 && (
                    <Text style={[styles.gDue, { color: theme.ghost }]} numberOfLines={1}>
                      {goalDueLabel(g.dueAt)}
                    </Text>
                  )}
                </View>
              )}

              {editing === g.id ? (
                <EditSavedRow
                  theme={theme}
                  value={editSaved}
                  onChange={setEditSaved}
                  onSave={() => void doSaveSaved(g.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <View style={styles.gActs}>
                  <PressScale pressedScale={0.94}
                    style={[styles.gBtn, { backgroundColor: theme.accentSoft }]}
                    onPress={() => startEdit(g)}
                  >
                    <Text style={[styles.gBtnText, { color: theme.accent }]}>改已存</Text>
                  </PressScale>
                  <PressScale pressedScale={0.94}
                    style={[styles.gBtn, { backgroundColor: theme.cardAlt.backgroundColor }]}
                    onPress={() => doRemove(g.id, g.name)}
                  >
                    <Text style={[styles.gBtnText, { color: theme.muted }]}>删除</Text>
                  </PressScale>
                </View>
              )}
            </View>
          );
        })}

        {/* 新建表单 / 虚线按钮 */}
        {showAdd ? (
          <View style={[styles.newCard, theme.card]}>
            <TextInput
              style={[styles.input, theme.cardAlt, { color: theme.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="目标名（如 一台相机）"
              placeholderTextColor={theme.ghost}
            />
            <TextInput
              style={[styles.input, theme.cardAlt, { color: theme.text }]}
              value={newTarget}
              onChangeText={setNewTarget}
              placeholder="目标金额（如 8000）"
              placeholderTextColor={theme.ghost}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, theme.cardAlt, { color: theme.text }]}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="一句话说明（选填，如 攒一台相机）"
              placeholderTextColor={theme.ghost}
            />
            <View style={styles.formRow}>
              <PressScale pressedScale={0.94}
                style={[styles.primaryBtn, { backgroundImage: theme.amberGradient }]}
                onPress={() => void doAdd()}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onAmber }]}>添加</Text>
              </PressScale>
              <PressScale pressedScale={0.94}
                style={[styles.plainBtn, { backgroundColor: theme.cardAlt.backgroundColor }]}
                onPress={() => {
                  setShowAdd(false);
                  setNewName('');
                  setNewTarget('');
                  setNewNote('');
                  setError('');
                }}
              >
                <Text style={[styles.plainBtnText, { color: theme.muted }]}>取消</Text>
              </PressScale>
            </View>
          </View>
        ) : rest.length > 0 ? (
          /* 有其它目标时才出虚线按钮；只有首卡时上方「+ 新目标」已是入口，两个入口会打架。 */
          <PressScale pressedScale={0.94}
            style={[styles.newGoal, { borderColor: 'rgba(32,60,52,0.24)' }]}
            onPress={() => setShowAdd(true)}
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={theme.accent} strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
            <Text style={[styles.newGoalText, { color: theme.accent }]}>新建目标</Text>
          </PressScale>
        ) : null}

        {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}
      </ScrollView>

      <TopFade top={insets.top} />

      <BottomFade bottom={insets.bottom + 68} />
      <BottomDock active="goals" bottomInset={insets.bottom} />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="删除目标"
        message={`确定删除「${pendingDelete?.name ?? ''}」？`}
        confirmText="删除"
        tone="danger"
        onConfirm={() => pendingDelete?.onConfirm()}
        onCancel={() => setPendingDelete(null)}
      />
    </Aurora>
  );
}

/** 改已存金额的行（首卡与普通卡共用）。 */
function EditSavedRow({
  theme,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  theme: ThemeColors;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.editRow}>
      <TextInput
        style={[styles.input, styles.inputFlex, theme.cardAlt, { color: theme.text }]}
        value={value}
        onChangeText={onChange}
        placeholder="已存金额"
        placeholderTextColor={theme.ghost}
        keyboardType="decimal-pad"
      />
      <PressScale pressedScale={0.94}
        style={[styles.primaryBtn, styles.editBtn, { backgroundImage: theme.amberGradient }]}
        onPress={onSave}
      >
        <Text style={[styles.primaryBtnText, { color: theme.onAmber }]}>保存</Text>
      </PressScale>
      <PressScale pressedScale={0.94}
        style={[styles.plainBtn, styles.editBtn, { backgroundColor: theme.cardAlt.backgroundColor }]}
        onPress={onCancel}
      >
        <Text style={[styles.plainBtnText, { color: theme.muted }]}>取消</Text>
      </PressScale>
    </View>
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

  // 首卡
  hero: {
    marginTop: 14.1,
    borderRadius: RADIUS.hero,
    paddingTop: 14.1,
    paddingHorizontal: 15.2,
    paddingBottom: 13,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroName: { fontSize: 11.9, fontWeight: '800', letterSpacing: -0.3, flex: 1, minWidth: 0,
    includeFontPadding: false,
    lineHeight: 14.2,
  },
  heroBadge: {
    paddingHorizontal: 9.7,
    paddingVertical: 3.2,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroBadgeText: { fontSize: 8.1, fontWeight: '800', letterSpacing: 0.3, color: '#FFFFFF',
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  heroNum: {
    fontSize: 27.1,
    fontWeight: '800',
    letterSpacing: -0.87,
    marginTop: 7.6,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 32.5,
  },
  heroOf: { fontSize: 10.3, fontWeight: '700', marginTop: 1.1, fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 12.4,
  },
  heroTrack: { height: 6.5, borderRadius: 3.2, marginTop: 10.8, overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 3.2 },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5.4,
    gap: 8,
  },
  heroLeft: { fontSize: 9.7, fontWeight: '800', flex: 1, minWidth: 0, fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 11.8,
  },
  /* 页脚右侧是弱化入口，不给胶囊底——带 padding 的按钮会把行高从 11.8 撑到 21.8，
     首卡整体比设计稿高出 10dp。 */
  heroAction: {
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  heroActionText: { fontSize: 8.1, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 9.8,
  },

  // 普通目标卡
  goalCard: {
    marginTop: 7.0,
    borderRadius: 17.3,
    paddingVertical: 11.9,
    paddingHorizontal: 13,
  },
  gTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  gName: { fontSize: 11.4, fontWeight: '800', flex: 1, minWidth: 0, letterSpacing: -0.2,
    includeFontPadding: false,
    lineHeight: 13.7,
  },
  gPct: { fontSize: 11.4, fontWeight: '800', fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 13.7,
  },
  gBar: { height: 5.4, borderRadius: 2.7, marginTop: 7.6, overflow: 'hidden' },
  gFill: { height: '100%', borderRadius: 2.7 },
  gMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6.0,
    gap: 8,
  },
  gSaved: { fontSize: 8.1, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1,
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  gHint: { fontSize: 8.1, fontVariant: ['tabular-nums'], flexShrink: 0,
    includeFontPadding: false,
    lineHeight: 9.8,
  },
  gActs: { flexDirection: 'row', alignItems: 'center', gap: 4.9, marginTop: 8.7 },
  /* Pocket 参考：白卡底部一行「说明（左）+ 到期日（右）」，说明为空时整行不渲染。 */
  gFoot: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 5.4,
  },
  gNote: { flex: 1, minWidth: 0, fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.8 },
  gDue: { fontSize: 8.1, fontWeight: '700', flexShrink: 0, fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    lineHeight: 9.8 },
  gBtn: { paddingHorizontal: 10.8, paddingVertical: 5.4, borderRadius: RADIUS.pill },
  gBtnText: { fontSize: 8.1, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 9.8,
  },

  // 列表标题行（Pocket 参考：Your goals + New goal）
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14.1,
    marginBottom: 2.2,
  },
  listTitle: { fontSize: 11.4, fontWeight: '800', letterSpacing: -0.2,
    includeFontPadding: false,
    lineHeight: 13.7,
  },
  listAdd: {
    paddingHorizontal: 10.8,
    paddingVertical: 4.9,
    borderRadius: RADIUS.pill,
  },
  listAddText: { fontSize: 8.1, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 9.8,
  },

  // 新建
  newGoal: {
    marginTop: 7.0,
    borderRadius: 17.3,
    borderWidth: 1.1,
    borderStyle: 'dashed',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  newGoalText: { fontSize: 9.7, fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 11.8,
  },
  newCard: { marginTop: 11, borderRadius: RADIUS.card, padding: 15 },
  input: {
    fontSize: 9.7,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 9,
  },
  inputFlex: { flex: 1, marginBottom: 0 },
  formRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  primaryBtn: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: { paddingHorizontal: 14 },
  primaryBtnText: { fontSize: 12, fontWeight: '800' },
  plainBtn: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainBtnText: { fontSize: 12, fontWeight: '800' },

  empty: { marginTop: 40, alignItems: 'center', gap: 6, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 11.5, textAlign: 'center', paddingHorizontal: 24, lineHeight: 17 },
  error: { fontSize: 11.5, marginTop: 10 },
});
