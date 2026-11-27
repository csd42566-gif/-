/**
 * 流水行 → 详情卡的同体形变（决策 34「共享元素」档的第二版实现）。
 *
 * 第一版实现在 `flyIcon.tsx`（已删除）：只把图标飞过去、卡片还是整页转场，视觉上是
 * 「两个物体」——用户要的是同一个物体变大，所以整段重做成现在这样。
 *
 * 为什么不用 reanimated 的 sharedTransitionTag：`react-native-screens` 的原生栈
 * push 时会把上一屏 detach，SET 拿不到起点快照（当时的实测：60fps 连拍五次，图标
 * 都是直接从概览页坐标跳到详情页坐标，中间没有位移帧）。所以这里也不跨路由——
 * 形变整个过程在概览页的根级覆盖层里完成，不 push；形变结束后点卡片头部才真正进详情页。
 *
 * 这一版把**被点击的那一行本身**撑开：外层容器的 left/top/width/height/borderRadius
 * 在一次进度值上同时插值，行内容淡出、详情内容淡入，所以看到的是同一块面在变大，
 * 而不是新面板从别处弹出。驱动用 RN 自带的 `Animated`（`useNativeDriver: false`，
 * 因为要动布局属性），与原来 flyIcon 的实现同一套做法，避开 worklet 在 release 包里
 * 的分发问题。
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { CategoryIcon } from './categoryIcon';
import { RADIUS, useTheme } from './theme';
import {
  DETAIL_HEAD_HEIGHT,
  DETAIL_MARGIN,
  DETAIL_META_EXTRA,
  DETAIL_META_LINE,
  DETAIL_TOP_GAP,
  DETAIL_PADDING_V,
  detailCardHeight,
} from '../core/ui/cardGeometry';

/** 窗口坐标系里的矩形（`measureInWindow` 的返回形状）。 */
export interface MorphRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DURATION = 300;

export interface MorphLine {
  key: string;
  value: string;
}

export interface MorphPayload {
  /** 被点击那一行在窗口里的矩形。 */
  from: MorphRect;
  icon: string;
  tint: string;
  ink: string;
  /** 行的主文字（备注或分类名），形变前半程可见。 */
  rowTitle: string;
  amountText: string;
  amountColor: string;
  kindLabel: string;
  lines: MorphLine[];
  /** 点详情卡头部进入完整明细页（形变结束后才可点）。 */
  onOpen: () => void;
}

/**
 * 详情卡的目标高度见 `src/core/ui/cardGeometry.ts`（纯函数 + 单测）。
 * 这里 re-export 一次，让调用方只 import 组件模块即可。
 */
export { detailCardHeight };

let pendingMorph: MorphPayload | null = null;
const listeners = new Set<(p: MorphPayload) => void>();

/** 概览页点行时调用。 */
export function openMorph(payload: MorphPayload): void {
  pendingMorph = payload;
  for (const cb of listeners) cb(payload);
}

export function onMorph(cb: (p: MorphPayload) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 根级形变层：铺满屏幕、默认不渲染，收到 payload 才开始演。 */
export function MorphDetailHost({ topInset }: { topInset: number }): React.ReactElement | null {
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [payload, setPayload] = useState<MorphPayload | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  /** 形变结束后才允许点卡片进入详情页，避免动画途中被点走。 */
  const [settled, setSettled] = useState(false);

  /** 反向收回：同一进度值倒着跑，位置 / 尺寸 / 圆角同时回到那一行。 */
  const close = () => {
    setSettled(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: DURATION - 60,
      easing: Easing.bezier(0.4, 0, 0.6, 1),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setPayload(null);
    });
  };

  useEffect(() => onMorph((p) => {
    setPayload(p);
    setSettled(false);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.bezier(0.22, 0.9, 0.24, 1),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setSettled(true);
    });
  }), [anim]);

  /**
   * 安卓返回键：卡片展开时应当先收回卡片，而不是直接退出 App。
   * 返回 true 表示这次返回已被消费。
   */
  useEffect(() => {
    if (payload === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settled) {
        close();
      }
      return true;
    });
    return () => sub.remove();
    // close 是纯闭包（只读 anim），不需要进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, settled]);

  if (payload === null) return null;

  const targetLeft = DETAIL_MARGIN;
  const targetWidth = screenW - DETAIL_MARGIN * 2;
  const targetTop = topInset + DETAIL_TOP_GAP;
  const targetHeight = detailCardHeight(payload.lines.length);
  /** 位置 / 尺寸 / 圆角都在同一个 pin 上插值——这是「同一个物体」的关键。 */
  const cardStyle = {
    left: anim.interpolate({ inputRange: [0, 1], outputRange: [payload.from.x, targetLeft] }),
    top: anim.interpolate({ inputRange: [0, 1], outputRange: [payload.from.y, targetTop] }),
    width: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [payload.from.width, targetWidth],
    }),
    height: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [payload.from.height, targetHeight],
    }),
    borderRadius: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [RADIUS.row, RADIUS.card],
    }),
    paddingHorizontal: anim.interpolate({ inputRange: [0, 1], outputRange: [0, DETAIL_PADDING_V] }),
    paddingVertical: anim.interpolate({ inputRange: [0, 1], outputRange: [0, DETAIL_PADDING_V] }),
  };

  /** 行内容先退、详情内容后进，两者交叉不超过半程，避免同时叠字。 */
  const rowOpacity = anim.interpolate({ inputRange: [0, 0.35], outputRange: [1, 0], extrapolate: 'clamp' });
  const detailOpacity = anim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 背景压暗 + 点它收回。容器本身 pointerEvents="box-none"，卡片区域才拦触摸。 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(26,20,8,0.22)',
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="收回" />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme.card.backgroundColor },
          cardStyle,
        ]}
      >
        {/* 形变前半程：还是那一行的样子（小图标 + 备注 + 金额） */}
        <Animated.View style={[styles.rowFace, { opacity: rowOpacity }]} pointerEvents="none">
          <View style={[styles.rowIcon, { backgroundColor: payload.tint }]}>
            <CategoryIcon icon={payload.icon} size={14} color={payload.ink} />
          </View>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {payload.rowTitle}
          </Text>
          <Text style={[styles.rowAmount, { color: payload.amountColor }]}>
            {payload.amountText}
          </Text>
        </Animated.View>

        {/* 形变后半程：详情卡的内容 */}
        <Animated.View style={[styles.detailFace, { opacity: detailOpacity }]}>
          <Pressable
            style={styles.detailHead}
            disabled={!settled}
            onPress={() => {
              /* 进详情页前先撤掉形变层：详情页会盖住它，若不撤，返回时会看到卡片还张着。 */
              setPayload(null);
              payload.onOpen();
            }}
            accessibilityLabel="打开完整明细"
          >
            <View style={[styles.bigIcon, { backgroundColor: payload.tint }]}>
              <CategoryIcon icon={payload.icon} size={24} color={payload.ink} />
            </View>
            <View style={styles.headText}>
              <Text style={[styles.kind, { color: theme.ghost }]}>{payload.kindLabel}</Text>
              <Text style={[styles.amount, { color: payload.amountColor }]}>
                {payload.amountText}
              </Text>
            </View>
          </Pressable>

          {payload.lines.length > 0 && (
            <View style={[styles.metaBlock, { borderTopColor: theme.line }]}>
              {payload.lines.map((line) => (
                <View key={line.key} style={styles.metaLine}>
                  <Text style={[styles.metaKey, { color: theme.ghost }]}>{line.key}</Text>
                  <Text style={[styles.metaVal, { color: theme.text }]} numberOfLines={1}>
                    {line.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    overflow: 'hidden',
    boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
  },

  /* 行面貌：与 app/index.tsx 的 row 内层同构 */
  rowFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9.7,
    paddingHorizontal: 12,
  },
  rowIcon: { width: 30.3, height: 30.3, borderRadius: 10.8, alignItems: 'center', justifyContent: 'center' },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.8,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 14,
  },
  rowAmount: {
    fontSize: 10.8,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },

  /* 详情面貌：与 app/transaction/[id].tsx 的详情卡同构 */
  detailFace: { flex: 1 },
  detailHead: { flexDirection: 'row', alignItems: 'center', height: DETAIL_HEAD_HEIGHT },
  bigIcon: {
    width: DETAIL_HEAD_HEIGHT,
    height: DETAIL_HEAD_HEIGHT,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  headText: { flex: 1, minWidth: 0 },
  kind: {
    fontSize: 8.1,
    includeFontPadding: false,
    lineHeight: 9.9,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  amount: {
    fontSize: 28.2,
    includeFontPadding: false,
    lineHeight: 31.0,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: 3,
  },
  metaBlock: { borderTopWidth: 1, marginTop: 14, paddingTop: 4 },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DETAIL_META_LINE,
    gap: 12,
  },
  metaKey: {
    width: 30,
    fontSize: 7.6,
    includeFontPadding: false,
    lineHeight: 9.3,
    letterSpacing: 1,
    fontWeight: '700',
  },
  metaVal: { flex: 1, fontSize: 9.2, fontWeight: '700', includeFontPadding: false, lineHeight: 11.2 },
});
