import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { GRID_DAMPING, GRID_SPRING } from '../core/ui/springProfile';
import { STRIDE, buildGrid, stepGrid } from '../core/ui/gridPhysics';
import type { RipplePoint } from '../core/ui/gridPhysics';

/**
 * 主卡底纹：弹性线网。
 *
 * 从原型 `mockups/home-ref-b-final.html` 的 `stepGrid()` 搬过来——每个格点受三个力：
 * 回到原位的弹簧、抵消速度的阻尼、指针附近的平方衰减斥力，外加点击时向外扩散的
 * 一圈涟漪；其余时间是整网上下 1.6px 的静息呼吸。物理积分在
 * `src/core/ui/gridPhysics.ts`（纯函数，可单测），这里只负责调度与绘制。
 *
 * 指针与点击状态由父组件持有（`pointer` / `ripples` 两个 shared value），因为主卡
 * 上还有月份选择器这类子按钮——本层 `pointerEvents="none"` 只画不拦，
 * 父组件通过冒泡的 onTouchStart/Move/End 把坐标写进来。
 */
const K = 411.43 / 760; // 原型 CSS px → 真机 dp

const GAP = 38 * K; // 格距（原型 38px）
/**
 * 弹簧参数（2026-11-28 调快）。数值与阻尼特性见 `src/core/ui/springProfile.ts`：
 * 原型 140/13 → ω≈11.8、ζ≈0.55、3τ≈0.46s 且来回摆；
 * 现在 260/29 → ω≈16.1、ζ≈0.90、3τ≈0.21s，仍留一点过冲但很快收住。
 */
const SPRING = GRID_SPRING;
const DAMPING = GRID_DAMPING;
const REPEL_R = 170 * K; // 指针影响半径（原型 170px）
/** 指针斥力：刚度提高后同位移需要更大力量，同步从 3400 提到 5200。 */
const REPEL_FORCE = 5200 * K;
const BREATH_AMP = 1.6 * K; // 呼吸幅度（原型 1.6px）
/** 呼吸周期：1400 → 1100，静息时整网更「活」一点。 */
const BREATH_PERIOD = 1100;

/**
 * 涟漪参数。
 *
 * 之前那一版涟漪**从来没生效**：父组件用 `Date.now()` 当出生时刻（约 1.7e12），
 * 本组件用 `frame.timestamp`（rAF 相对时间，量级几千到几万）当当前时刻，
 * `age = now - t0` 恒为巨大负数，`age <= 0` 直接跳过所有受力；同时过期清理
 * 判定 `now - t0 <= LIFE` 也恒为真，涟漪只增不减。
 *
 * 现在改成：父组件只传坐标，`t0` 由本组件在第一次收到时用**自己的时钟**打戳
 * （见下面 frame callback 里的 `stampRipples`），两端共用一个时钟。
 *
 * 速度 520dp/s + 环带宽 34dp：从中心扫到卡片边缘约 0.35s，一圈有厚度、看得见
 * 波前在推。寿命 620ms 让波前走完全卡、并留一点余震收尾。
 */
const RIPPLE_SPEED = 520 * K * 1.9;
const RIPPLE_BAND = 34 * K * 1.9;
const RIPPLE_FORCE = 2600 * K * 3.2;
const RIPPLE_LIFE = 620;

const MAX_DT = 0.032; // 掉帧时钳住步长，否则弹簧积分会发散

/**
 * 判定「整网已经静止」的阈值（位移 dp / 速度 dp·s⁻¹）。
 * 低于它就是静息呼吸，不必每帧重建路径——省下的正是流畅度的余量。
 */
const STILL_POS = 0.01;
const STILL_VEL = 0.4;

export type GridPointer = { x: number; y: number; in: number };
/** `t0 === -1` 表示还没打时间戳，由本组件消费时用当前帧时间补上。 */
export type GridRipple = { x: number; y: number; t0: number };

export type ElasticGridProps = {
  /** 指针位置（localX/localY），`in === 0` 表示手指不在卡上。 */
  pointer: SharedValue<GridPointer>;
  /** 点击产生的涟漪，`t0` 传 -1，时间戳由本组件打。 */
  ripples: SharedValue<GridRipple[]>;
  /** 1 = 跑，0 = 停（离屏或页面不可见时停掉，别白烧一帧）。 */
  active: SharedValue<number>;
  /** 线条颜色，默认原型里的 rgba(30,20,4,.46)。 */
  color?: string;
  /**
   * 线宽（dp）。原型 1.6 CSS px × K ≈ 0.87dp，但真机在这个宽度下线是「实」的，
   * 会把琥珀渐变切成一格格表格。收到 0.7 才是「看得见但不抢戏」的档位。
   */
  strokeWidth?: number;
};

export const ElasticGrid = React.memo(function ElasticGrid({
  pointer,
  ripples,
  active,
  color = 'rgba(30,20,4,0.46)',
  strokeWidth = 0.7,
}: ElasticGridProps) {
  const nodes = useSharedValue<number[]>([]);
  const cols = useSharedValue(0);
  const rows = useSharedValue(0);
  const path = useSharedValue(Skia.Path.Make());
  /**
   * 是否还在动。静止时跳过路径重建：整网的静息呼吸只是整体上下平移，
   * 交给渲染层的 transform 去做，不必每帧把 c×r×2 条线段重新写一遍 Path。
   */
  const moving = useSharedValue(1);
  /** 呼吸相位，由下面的 useAnimatedStyle 每帧读，交给图层 transform 平移。 */
  const breathY = useSharedValue(0);
  /** 已打戳的涟漪。独立存一份，避免每帧把父组件的数组改来改去。 */
  const live = useSharedValue<RipplePoint[]>([]);

  /** 按当前尺寸重新铺格点，所有点先落在原位（对应原型 buildGrid）。 */
  const build = (w: number, h: number) => {
    const c = Math.floor(w / GAP) + 1;
    const r = Math.floor(h / GAP) + 1;
    cols.value = c;
    rows.value = r;
    nodes.value = buildGrid(w, h, GAP);
    live.value = [];
    ripples.value = [];
    /* 重铺后所有点都在原位，但 moving 可能还停在 0（上次静止），必须重置，否则永远不重建。 */
    moving.value = 1;
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) build(width, height);
  };

  useFrameCallback((frame) => {
    'worklet';
    if (active.value !== 1) return;
    const c = cols.value;
    const r = rows.value;
    const n = nodes.value;
    if (c === 0 || r === 0 || n.length === 0) return;

    const since = frame.timeSincePreviousFrame;
    if (since === null) return;
    const dt = Math.min(since / 1000, MAX_DT);
    if (dt <= 0) return;

    /** 与 frame.timestamp 同一个时钟，气泡出生时刻必须用它，否则 age 算不出来。 */
    const now = frame.timestamp;

    /*
     * 消费父组件推进来的新涟漪：用当前帧时间打戳。
     * 父组件传的 t0 一律是 -1，这里补成 now —— 两端共用一个时钟，
     * 才能算出正确的 age（旧版用 Date.now() 导致 age 恒为负、涟漪从未生效）。
     */
    const incoming = ripples.value;
    if (incoming.length > 0) {
      const stamped: RipplePoint[] = live.value === null ? [] : [...live.value];
      for (let i = 0; i < incoming.length; i += 1) {
        stamped.push({ x: incoming[i].x, y: incoming[i].y, t0: incoming[i].t0 < 0 ? now : incoming[i].t0 });
      }
      live.value = stamped;
      ripples.value = [];
    }

    // 清掉过期的
    const cur = live.value;
    if (cur.length > 0) {
      const kept: RipplePoint[] = [];
      for (let i = 0; i < cur.length; i += 1) {
        if (now - cur[i].t0 <= RIPPLE_LIFE) kept.push(cur[i]);
      }
      if (kept.length !== cur.length) live.value = kept;
    }

    /**
     * 静息呼吸的相位每帧都写：整网的呼吸只是整体上下平移，
     * 交给 RN 图层的 transform 消化，不必重建路径。
     */
    breathY.value = Math.sin(now / BREATH_PERIOD) * BREATH_AMP;

    const ptr = pointer.value;
    const hasRipple = live.value.length > 0;

    /**
     * 上一帧末尾记下的「整网最大偏离」低于阈值、且没有手指/涟漪 → 整网是静的，
     * 直接跳过重建。阈值判定放在这里而不是每帧预扫全表：预扫本身也要遍历 rt² 次，
     * 省不下多少，还容易在索引换算上写错。
     */
    if (ptr.in !== 1 && !hasRipple && moving.value === 0) return;

    const res = stepGrid(
      n,
      c,
      r,
      GAP,
      dt,
      ptr,
      live.value,
      now,
      { spring: SPRING, damping: DAMPING },
      { radius: REPEL_R, force: REPEL_FORCE },
      { speed: RIPPLE_SPEED, band: RIPPLE_BAND, force: RIPPLE_FORCE, life: RIPPLE_LIFE },
    );

    nodes.value = n;
    moving.value = res.maxDev > STILL_POS || res.maxSpd > STILL_VEL ? 1 : 0;

    /* 呼吸不再写进每个点：整网靠外层图层的 translateY 平移，路径里只存实际位移。 */
    const builder = Skia.PathBuilder.Make();
    for (let y = 0; y < r; y += 1) {
      for (let x = 0; x < c; x += 1) {
        const i = (y * c + x) * STRIDE;
        if (x === 0) builder.moveTo(n[i], n[i + 1]);
        else builder.lineTo(n[i], n[i + 1]);
      }
    }
    for (let x = 0; x < c; x += 1) {
      for (let y = 0; y < r; y += 1) {
        const i = (y * c + x) * STRIDE;
        if (y === 0) builder.moveTo(n[i], n[i + 1]);
        else builder.lineTo(n[i], n[i + 1]);
      }
    }
    path.value = builder.detach();
  });

  /**
   * 静息呼吸走 RN 图层的 transform（不重绘、只平移）。
   *
   * 试过 Skia 的 <Group transform>：路径没变时 Skia 会跳过重绘，transform 变化
   * 不一定触发新帧，实测呼吸看不出在动。RN 的 translateY 由图层合成器处理，
   * 每帧都生效且几乎零成本。
   */
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: breathY.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path} style="stroke" strokeWidth={strokeWidth} color={color} />
        </Canvas>
      </Animated.View>
    </View>
  );
});

/** 主卡里放这层时用的样式：铺满 + 跟着卡片圆角裁掉溢出。 */
export const elasticGridStyle = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
}).layer;
