/**
 * 分类管理页（方案 B 定稿）：两级分类增删改（支出两级 / 收入一级）。
 *
 * 视觉对应 mockups/pages-categories-accounts.html 第 1 屏：
 * 顶部返回钮 + 「设置 · 管理」面包屑 + 大标题「分类」+ 副标题「支出 N 个大类 · M 个小类」；
 * 「支出/收入」分段；每个大类一张白卡（图标块 + 名称 + 小类计数），
 * 展开后小类缩进 26dp（圆点 + 名字 + 改名/删除），末尾虚线「+ 加小类」。
 *
 * 决策 17/18：分类完全自由改；删分类时旧流水落「未分类」（categoriesStore 已处理）。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { categoryTree } from '../src/core/categories';
import { useCategoriesStore } from '../src/features/categories/categoriesStore';
import type { CategoryKind } from '../src/features/categories/categoriesStore';
import { Aurora } from '../src/ui/aurora';
import { CategoryIcon } from '../src/ui/categoryIcon';
import { ConfirmDialog } from '../src/ui/dialog';
import { RADIUS, useTheme } from '../src/ui/theme';
import { TopFade } from '../src/ui/topFade';
import { PressScale } from '../src/ui/pressScale';

export default function Categories() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, loaded, load, addCategory, renameCategory, removeCategory } =
    useCategoriesStore();

  const [tab, setTab] = useState<CategoryKind>('expense');
  const [addingParent, setAddingParent] = useState(false);
  const [addingChildOf, setAddingChildOf] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  /** 删除确认走页内弹窗（src/ui/dialog.tsx），不用系统 Alert。 */
  const [pendingDelete, setPendingDelete] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const tree = useMemo(
    () => categoryTree(categories).filter((n) => n.kind === tab),
    [categories, tab],
  );

  const parentCount = tree.length;
  const childCount = tree.reduce((n, node) => n + node.children.length, 0);

  const doAdd = async () => {
    const name = newName.trim();
    if (name === '') {
      setError('分类名不能为空。');
      return;
    }
    setError('');
    await addCategory({
      kind: tab,
      parentId: addingChildOf,
      name,
      icon: '',
      color: '',
      sortOrder: 0,
    });
    setAddingParent(false);
    setAddingChildOf(null);
    setNewName('');
  };

  const doRename = async (id: number) => {
    const name = editName.trim();
    if (name === '') {
      setError('分类名不能为空。');
      return;
    }
    setError('');
    await renameCategory(id, { name });
    setEditing(null);
  };

  const doRemove = (id: number, name: string, isParent: boolean) => {
    setPendingDelete({
      message: isParent
        ? `删除大类「${name}」会连带删除它的小类，旧流水将落进「未分类」。确定？`
        : `删除「${name}」后，旧流水将落进「未分类」。确定？`,
      onConfirm: () => {
        setPendingDelete(null);
        void removeCategory(id);
      },
    });
  };

  /** 操作胶囊：primary 琥珀渐变 / plain 浅灰面 / danger 描边红。 */
  const pill = (label: string, onPress: () => void, tone: 'primary' | 'plain' | 'danger') => (
    <PressScale
      key={label}
      style={[
        styles.pill,
        tone === 'primary'
          ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
          : tone === 'danger'
            ? { borderWidth: 1, borderColor: 'rgba(217,89,94,0.4)' }
            : { backgroundColor: theme.cardAlt.backgroundColor },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.pillText,
          {
            color:
              tone === 'primary' ? theme.onAmber : tone === 'danger' ? theme.expense : theme.muted,
          },
        ]}
      >
        {label}
      </Text>
    </PressScale>
  );

  const editBox = (onSave: () => void, onDelete?: () => void) => (
    <View>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
        ]}
        value={editName}
        onChangeText={setEditName}
        placeholder="分类名"
        placeholderTextColor={theme.ghost}
      />
      <View style={styles.row}>
        {pill('保存', onSave, 'primary')}
        {pill('取消', () => setEditing(null), 'plain')}
        {onDelete ? pill('删除', onDelete, 'danger') : null}
      </View>
    </View>
  );

  return (
    <Aurora>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.navRow}>
          <PressScale pressedScale={0.94}
            style={[styles.back, theme.card]}
            hitSlop={8}
            accessibilityLabel="返回"
            onPress={() => router.back()}
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.5 5.5 8 12l6.5 6.5"
                stroke={theme.accent}
                strokeWidth={2.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </PressScale>
          <Text style={[styles.navKicker, { color: theme.ghost }]}>设置 · 管理</Text>
        </View>

        <View style={styles.headRow}>
          <Text style={[styles.headTitle, { color: theme.text }]}>分类</Text>
        </View>
        <Text style={[styles.headSub, { color: theme.faint }]}>
          {tab === 'expense' ? '支出' : '收入'} {parentCount} 个
          {tab === 'expense' && childCount > 0 ? `大类 · ${childCount} 个小类` : '分类'}
        </Text>

        <View style={[styles.segment, { backgroundColor: theme.cardAlt.backgroundColor }]}>
          {(['expense', 'income'] as const).map((k) => (
            <PressScale pressedScale={0.94}
              key={k}
              style={[
                styles.segItem,
                tab === k && {
                  backgroundImage: theme.amberGradient,
                  backgroundColor: theme.amber,
                },
              ]}
              onPress={() => {
                setTab(k);
                setEditing(null);
                setAddingChildOf(null);
                setAddingParent(false);
              }}
            >
              <Text
                style={[styles.segText, { color: tab === k ? theme.onAmber : theme.faint }]}
              >
                {{ expense: '支出', income: '收入' }[k]}
              </Text>
            </PressScale>
          ))}
        </View>

        {tree.map((node, nodeIndex) => (
          <View key={node.id} style={[styles.catCard, theme.card]}>
            {editing === node.id ? (
              editBox(
                () => void doRename(node.id),
                () => doRemove(node.id, node.name, true),
              )
            ) : (
              <>
                {/* 大类行不再挂「改名/删除」胶囊（原型没有）：长按整行改大类名，
                    删除入口在下方小类行之外——大类有账目时由 doRemove 拦成停用提示。 */}
                <Pressable
                  style={styles.catTop}
                  delayLongPress={400}
                  onLongPress={() => {
                    setEditing(node.id);
                    setEditName(node.name);
                  }}
                >
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: theme.tint[nodeIndex % theme.tint.length] },
                    ]}
                  >
                    <CategoryIcon
                      icon={(node as { icon?: string }).icon || 'more'}
                      size={23}
                      color={theme.tintInk[nodeIndex % theme.tintInk.length]}
                    />
                  </View>
                  <Text style={[styles.catName, { color: theme.text }]} numberOfLines={1}>
                    {node.name}
                  </Text>
                  <Text style={[styles.catCount, { color: theme.ghost }]}>
                    {node.children.length > 0 ? `${node.children.length} 个小类` : '无小类'}
                  </Text>
                </Pressable>

                {node.children.length > 0 && (
                  <View style={styles.children}>
                    {node.children.map((child, childIndex) => (
                      <View
                        key={child.id}
                        style={[
                          styles.child,
                          // 原型是 `.child + .child` 才画分隔线，首行不画——否则第一条线会顶在
                          // 「N 个小类」下方，看起来像卡里多出一条横杠。
                          childIndex > 0 && { borderTopWidth: 1, borderTopColor: theme.line },
                        ]}
                      >
                        {editing === child.id ? (
                          <View style={styles.childEdit}>{editBox(() => void doRename(child.id))}</View>
                        ) : (
                          <>
                            <View style={[styles.childDot, { backgroundColor: theme.amber }]} />
                            <Text style={[styles.childName, { color: theme.muted }]} numberOfLines={1}>
                              {child.name}
                            </Text>
                            {pill(
                              '改名',
                              () => {
                                setEditing(child.id);
                                setEditName(child.name);
                              },
                              'plain',
                            )}
                            {pill('删除', () => doRemove(child.id, child.name, false), 'danger')}
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {addingChildOf === node.id && (
                  <View style={[styles.child, { borderTopColor: theme.line }]}>
                    <View style={styles.childEdit}>
                      <TextInput
                        style={[
                          styles.input,
                          { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
                        ]}
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="新小类名"
                        placeholderTextColor={theme.ghost}
                      />
                      <View style={styles.row}>
                        {pill('添加', () => void doAdd(), 'primary')}
                        {pill('取消', () => setAddingChildOf(null), 'plain')}
                      </View>
                    </View>
                  </View>
                )}

                <PressScale pressedScale={0.94}
                  style={[styles.addChild, { borderColor: 'rgba(32,60,52,0.24)' }]}
                  onPress={() => {
                    setAddingChildOf(node.id);
                    setNewName('');
                  }}
                >
                  <Text style={[styles.addChildText, { color: theme.accent }]}>+ 加小类</Text>
                </PressScale>
              </>
            )}
          </View>
        ))}

        {addingParent ? (
          <View style={[styles.catCard, theme.card]}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.cardAlt.backgroundColor, color: theme.text },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder={tab === 'expense' ? '新大类名（如 宠物）' : '新分类名'}
              placeholderTextColor={theme.ghost}
            />
            <View style={styles.row}>
              {pill('添加', () => void doAdd(), 'primary')}
              {pill('取消', () => setAddingParent(false), 'plain')}
            </View>
          </View>
        ) : (
          <PressScale pressedScale={0.94}
            style={[styles.addMain, { backgroundImage: theme.amberGradient }]}
            onPress={() => {
              setAddingParent(true);
              setNewName('');
            }}
          >
            <Text style={[styles.addMainText, { color: theme.onAmber }]}>
              {tab === 'expense' ? '+ 新增大类' : '+ 新增分类'}
            </Text>
          </PressScale>
        )}

        {error !== '' && <Text style={[styles.error, { color: theme.expense }]}>{error}</Text>}

        <View style={{ height: 40 }} />
      </ScrollView>
      <TopFade top={insets.top} />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="删除分类"
        message={pendingDelete?.message ?? ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => pendingDelete?.onConfirm()}
        onCancel={() => setPendingDelete(null)}
      />
    </Aurora>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 17, paddingBottom: 20 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navKicker: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, letterSpacing: 2.6, fontWeight: '700' },

  headRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  headTitle: { fontSize: 26.0,
    includeFontPadding: false,
    lineHeight: 28.6, fontWeight: '800', letterSpacing: -1.1 },
  headSub: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, marginTop: 4, letterSpacing: 0.2 },

  segment: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: RADIUS.pill,
    marginTop: 16,
  },
  segItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  segText: { fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2, fontWeight: '800', letterSpacing: 0.4 },

  catCard: {
    marginTop: 6.5,
    borderRadius: 16.2,
    paddingTop: 9.7,
    paddingBottom: 8.7,
    paddingHorizontal: 10.8,
  },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 7.6 },
  catIcon: {
    width: 24.9,
    height: 24.9,
    borderRadius: 8.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: { flex: 1, fontSize: 10.8,
    includeFontPadding: false,
    lineHeight: 13.2, fontWeight: '800', letterSpacing: -0.2 },
  catCount: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontVariant: ['tabular-nums'] },

  /* 设计稿 .children { padding-left:60px } → 60 × 0.5414 ≈ 32.5dp，与小类圆点对齐。 */
  children: { marginTop: 7.6, paddingLeft: 32.5 },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.5,
    paddingVertical: 6.5,
  },
  childDot: { width: 3.2, height: 3.2, borderRadius: 1.6 },
  childName: { flex: 1, fontSize: 8.9,
    includeFontPadding: false,
    lineHeight: 10.9, fontWeight: '600' },
  childEdit: { flex: 1 },

  pill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  pillText: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 4 },

  input: {
    fontSize: 9.2,
    includeFontPadding: false,
    lineHeight: 11.2,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 6,
    fontWeight: '600',
  },

  addChild: {
    marginTop: 6.5,
    paddingVertical: 6.5,
    borderRadius: RADIUS.chip,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addChildText: { fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9, fontWeight: '800', letterSpacing: 0.3 },

  addMain: {
    marginTop: 8.7,
    height: 37.9,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 26px rgba(32,60,52,0.22)',
  },
  addMainText: { fontSize: 9.7,
    includeFontPadding: false,
    lineHeight: 11.8, fontWeight: '800', letterSpacing: 0.5 },

  error: { fontSize: 7.0,
    includeFontPadding: false,
    lineHeight: 8.5, marginTop: 10 },
});
