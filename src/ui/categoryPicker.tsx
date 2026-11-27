/**
 * 两级分类选择器（v2 · 方案 B）：支出=大类宫格→展开小类面板；收入=一级。
 * 布局参照原型：4 列宫格，每格「圆形图标 + 名称」，大类带展开箭头。
 * 纯展示组件，数据来自 categoriesStore，选择回调向上抛。
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { categoryTree } from '../core/categories';
import type { CategoryRow } from '../features/categories/categoriesStore';
import { CategoryIcon } from './categoryIcon';
import { PressScale } from './pressScale';
import { RADIUS, useTheme } from './theme';

export interface CategoryPickerProps {
  kind: 'expense' | 'income';
  categories: CategoryRow[];
  /** 当前选中分类 id（null = 未选）。 */
  selected: number | null;
  onSelect: (categoryId: number | null) => void;
}

export function CategoryPicker({ kind, categories, selected, onSelect }: CategoryPickerProps) {
  const theme = useTheme();
  const tree = useMemo(
    () => categoryTree(categories).filter((node) => node.kind === kind),
    [categories, kind],
  );

  // 记录展开的大类 id（可多个展开，符合手速场景）
  const [openParents, setOpenParents] = useState<Set<number>>(new Set());

  const toggleParent = (parentId: number) => {
    setOpenParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <Text style={[styles.empty, { color: theme.muted }]}>还没有分类，先去「分类管理」建一个。</Text>
    );
  }

  /** 单个宫格：圆角图标块 + 名称。 */
  const cell = (
    key: string,
    label: string,
    icon: string,
    active: boolean,
    onPress: () => void,
    trailing?: string,
    small = false,
  ) => (
    <PressScale key={key} style={styles.cellOuter} pressedScale={0.94} onPress={onPress}>
      <View
        style={[
          small ? styles.cellSmall : styles.cell,
          theme.card,
          active
            ? { borderColor: theme.amber, backgroundColor: theme.accentSoft, boxShadow: 'none' }
            : null,
        ]}
      >
        <View
          style={[
            small ? styles.iconCircleSmall : styles.iconCircle,
            active
              ? { backgroundImage: theme.amberGradient, backgroundColor: theme.amber }
              : { backgroundColor: theme.cardAlt.backgroundColor },
          ]}
        >
          <CategoryIcon icon={icon} size={small ? 9 : 12.5} color={active ? theme.onAmber : theme.muted} />
        </View>
        <Text
          style={[
            small ? styles.cellTextSmall : styles.cellText,
            { color: active ? theme.accent : theme.muted },
            active && styles.cellTextOn,
          ]}
          numberOfLines={1}
        >
          {trailing !== undefined ? `${label} ${trailing}` : label}
        </Text>
      </View>
    </PressScale>
  );

  return (
    <View style={styles.root}>
      {/* 大类宫格：所有大类排在同一条 4 列流里 */}
      <View style={styles.grid}>
        {tree.map((node) => {
          const hasChildren = node.children.length > 0;
          const isOpen = openParents.has(node.id);
          return cell(
            `p-${node.id}`,
            node.name,
            node.icon ?? '',
            selected === node.id,
            () => {
              onSelect(node.id); // 大类可直选（兜底），有子类的点一下同时选中并展开小类
              if (hasChildren) toggleParent(node.id);
            },
            hasChildren ? (isOpen ? '▾' : '▸') : undefined,
          );
        })}
      </View>

      {/* 展开的小类面板：跟在宫格下方，一次可开多个 */}
      {tree
        .filter((node) => node.children.length > 0 && openParents.has(node.id))
        .map((node) => (
          <View key={`panel-${node.id}`} style={[styles.childPanel, theme.card]}>
            <Text style={[styles.childPanelTitle, { color: theme.faint }]}>{node.name}</Text>
            <View style={styles.childGrid}>
              {node.children.map((child) =>
                cell(
                  `c-${child.id}`,
                  child.name,
                  child.icon ?? '',
                  selected === child.id,
                  () => onSelect(child.id),
                  undefined,
                  true,
                ),
              )}
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  /* 原型 .cellOuter { width:25%; padding:4px } → 4 × K = 2.2dp */
  cellOuter: { width: '25%', padding: 2.2 },
  cell: {
    alignItems: 'center',
    gap: 4.3,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 13,
  },
  cellSmall: {
    alignItems: 'center',
    gap: 3.5,
    paddingVertical: 5,
    borderRadius: RADIUS.row,
  },
  iconCircle: {
    width: 23.8,
    height: 23.8,
    borderRadius: 8.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSmall: {
    width: 19,
    height: 19,
    borderRadius: 6.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 原型 .cellName { font-size:14px; font-weight:600; color:#5a5a5a } → 7.6dp / 600 */
  cellText: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, fontWeight: '600' },
  /* 原型 .cell.on .cellName { color:#B4783A; font-weight:800 } */
  cellTextOn: { fontWeight: '800' },
  cellTextSmall: { fontSize: 6.5,
    includeFontPadding: false,
    lineHeight: 7.9, fontWeight: '600' },
  childPanel: { borderRadius: RADIUS.chip, padding: 12 },
  childPanelTitle: { fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3, letterSpacing: 0.8, fontWeight: '700', marginBottom: 8 },
  childGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { fontSize: 13,
    includeFontPadding: false,
    lineHeight: 15.9, marginTop: 8 },
});


