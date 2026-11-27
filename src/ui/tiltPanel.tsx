/**
 * 3D 倾斜面板（第四版：方向修正 + 按压渐入 + 材质三笔）。
 *
 * 上一版读数看着都对（倾角 9°、梯形 2.5%、地影位移都量到了），但手感仍被判「不行」。
 * 三个真问题都在这一版修掉：
 *
 * 1. **俯仰方向反了**。CSS / RN 的 `rotateX(正)` 把下边拉向观察者（顶边后仰），所以
 *    「按住顶边、顶边沉下去」必须写 `rotateX = -ny * maxDeg`。上一版是正号：按顶边时
 *    顶边朝观察者抬起来，而同一时刻地影却在往上跑（按下边时影子往上）——两个方向互相
 *    打架，观感就是「卡片被手指顶起来」，不是「按下去」。Kinetik 原文也是 `-y`。
 * 2. **按下即满倾**。上一版 touch down 那一帧倾角就直接是 9°，读作「卡片突然歪了」。
 *    这一版把倾角乘上 `press`（0→1 的快弹簧，约 100ms 到位），按下是「压进去」的过程，
 *    按住拖动时 press≈1，仍然与手指 1:1。
 * 3. **视差与浮起不同步**。内容层原来只听 nx/ny，按下瞬间就跳开；现在也乘 press，
 *    跟卡片一起浮起来，层次才是一个整体。
 *
 * 材质两笔（都不跟随手指，属于「表面」而不是「光效」）：
 * - `SHEEN`：168° 微渐变，顶部受光到底部背光，跟着卡片一起转；
 * - `BEVEL`：一圈 inset 描边（上亮下暗）当倒角，纯色卡缺的就是这条厚度。
 *
 * 曾经加过一层「左上角径向受光」的柔光斑，会连同卡片一起转，但静止时就是一块四边
 * 不靠的白，读作「卡上糊了一块」——那正是上一轮被否掉的观感，所以删掉了。
 *
 * 触摸挂在**不参与变换的外层 View** 上：挂在内层卡片会导致 `locationX/Y` 是变换后的
 * 局部坐标，形成「倾角变 → 坐标变 → 倾角再变」的反馈环。
 *
 * 不引入新依赖：项目没有 react-native-gesture-handler，用 View 的
 * onTouchStart/Move/End 就够（不抢手势，ScrollView 照常滚 —— 纵向拖动时 ScrollView
 * 接管，会走 onTouchCancel 把卡片弹回，这与 Kinetik 的行为一致）。
 *
 * 约束：**不能包住已经有形变的容器**。形变层自己在插值 left/top/width/height，
 * 再叠一个 rotate 会让子元素坐标系跑偏。
 */

import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import {
  TILT_LIFT,
  TILT_MAX_DEG,
  TILT_PARALLAX,
  TILT_PERSPECTIVE,
  TILT_REST,
  TILT_SHADOW_SCALE,
  TILT_SHADOW_SHIFT,
  tiltFromTouch,
} from '../core/ui/tilt';
import { fireHaptic } from './pressScale';
import { RADIUS } from './theme';

/**
 * 按下：ω = √(900/0.6) ≈ 38.7、ζ = 30 / (2√540) ≈ 0.65，3τ ≈ 120ms。
 * 这一档只负责「压进去」这一下，不能慢——慢了就是上一版被判「不跟手」的原因。
 */
const PRESS_SPRING = { damping: 30, stiffness: 900, mass: 0.6 };
/**
 * 复位：ζ = 13 / (2√190) ≈ 0.47，回弹明显。
 * 用户要的「Spring 阻尼弹性复位」就靠这一档——一档到底的 0.86 只是慢慢停住，没有弹性。
 */
const RESET_SPRING = { damping: 13, stiffness: 190, mass: 1 };

/** 卡面微渐变：168° 方向，顶部微亮、底部微暗，模拟单一主光源从上方照下来。 */
const SHEEN =
  'linear-gradient(168deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.04) 26%, ' +
  'rgba(255,255,255,0) 54%, rgba(0,0,0,0.05) 82%, rgba(0,0,0,0.12) 100%)';

/**
 * 内描边倒角：上/左受光、下/右背光。
 *
 * 纯色卡缺的就是这圈厚度——没有它，卡片看起来像贴纸；有它，边缘才有「切出来的边」。
 * 用 inset boxShadow 而不是 borderWidth，是因为 border 会影响内容布局盒，
 * 而这圈线必须绝对贴边、不占位。
 */
const BEVEL =
  'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.22), ' +
  'inset 1px 0 0 rgba(255,255,255,0.06), inset -1px 0 0 rgba(0,0,0,0.13)';

/** 视差上下文：只有归一化触点 + 压入量，depth 由每一层自己给。 */
type TiltContextValue = {
  nx: SharedValue<number>;
  ny: SharedValue<number>;
  press: SharedValue<number>;
  parallax: number;
};

const TiltContext = createContext<TiltContextValue | null>(null);

/**
 * 视差层。`depth` 正数浮起（朝触点反方向偏）、负数下沉、0 贴平。
 *
 * 用法：把「总余额 / 大数字 / 进度条」这类该浮起来的内容包一层，卡面线网不要包。
 * 只加一层 View 不改布局：默认 `alignSelf: stretch`，纵向排列下与直接摆放等价。
 */
export function TiltLayer({
  children,
  depth = 1,
  style,
}: {
  children: React.ReactNode;
  depth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ctx = useContext(TiltContext);
  const anim = useAnimatedStyle(() => {
    if (!ctx) return { transform: [{ translateX: 0 }, { translateY: 0 }] };
    /* 算式必须内联在 worklet 里：跨模块调用 helper 在 release 包中会被解析成 undefined
       （实测崩溃 TypeError: undefined is not a function @tiltScale）。
       乘 press 让内容层跟卡片一起浮起，而不是按下瞬间就跳开。 */
    const p = clampUnit(ctx.press.value);
    return {
      transform: [
        { translateX: -clampUnit(ctx.nx.value) * ctx.parallax * depth * p },
        { translateY: -clampUnit(ctx.ny.value) * ctx.parallax * depth * p },
      ],
    };
  });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export type TiltPanelProps = {
  children: React.ReactNode;
  /** 外层布局样式（margin 等）。不参与变换，触摸坐标从这里量。 */
  style?: StyleProp<ViewStyle>;
  /** 卡片表面样式（背景色、圆角、内边距、boxShadow）。 */
  cardStyle?: StyleProp<ViewStyle>;
  /** 是否启用。默认 true；编辑态（有 TextInput）建议关掉，否则打字时整张卡在晃。 */
  enabled?: boolean;
  /** 倾角上限（度），默认 9。 */
  maxDeg?: number;
  /** 按压浮起倍数，默认 1.03。 */
  lift?: number;
  /** 视差基准位移（dp），默认 10。 */
  parallax?: number;
  /** 地影颜色（极低 alpha 的面，配合自身模糊阴影）。 */
  shadowColor?: string;
  /** 圆角，用于裁材质层。默认 RADIUS.hero。 */
  radius?: number;
  /**
   * 透传的触摸与布局回调。
   *
   * 首页主卡本身就在用这些事件驱动弹性线网，如果 TiltPanel 独占，线网会直接失效。
   * 所以做成「先跑倾斜、再调外部」，两边共享同一批事件。
   */
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchMove?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  onTouchCancel?: (e: GestureResponderEvent) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

export function TiltPanel({
  children,
  style,
  cardStyle,
  enabled = true,
  maxDeg = TILT_MAX_DEG,
  lift = TILT_LIFT,
  parallax = TILT_PARALLAX,
  shadowColor = 'rgba(32,60,52,0.12)',
  radius = RADIUS.hero,
  onTouchStart: outerStart,
  onTouchMove: outerMove,
  onTouchEnd: outerEnd,
  onTouchCancel: outerCancel,
  onLayout: outerLayout,
}: TiltPanelProps) {
  const nx = useSharedValue(TILT_REST.normX);
  const ny = useSharedValue(TILT_REST.normY);
  const press = useSharedValue(0);
  /** 面板尺寸只在 layout 时更新，触摸回调里读它算归一化坐标。 */
  const size = useRef({ w: 0, h: 0 });

  const apply = useCallback(
    (x: number, y: number) => {
      const { w, h } = size.current;
      if (w <= 0 || h <= 0) return;
      const a = tiltFromTouch(x, y, w, h, maxDeg);
      /* 直接赋值，零插值：手指移动多少就倾多少。
         曾经加过一档快弹簧（stiffness 420），实测读起来是「面板滞后于手指」，
         而「跟手」正是这个效果唯一不能丢的东西。按下那一下的渐入由 press 承担。 */
      nx.value = a.normX;
      ny.value = a.normY;
    },
    [maxDeg, nx, ny],
  );

  const release = useCallback(() => {
    /* 倾角回正走弹性档（会有一点过冲），压入量同档一起落回去，两者不能分家，
       否则会出现「已经平了但还在半空」的断层。 */
    nx.value = withSpring(TILT_REST.normX, RESET_SPRING);
    ny.value = withSpring(TILT_REST.normY, RESET_SPRING);
    press.value = withSpring(0, RESET_SPRING);
  }, [nx, ny, press]);

  const ctx = useMemo<TiltContextValue>(
    () => ({ nx, ny, press, parallax }),
    [nx, ny, press, parallax],
  );

  const cardAnim = useAnimatedStyle(() => {
    const p = clampUnit(press.value);
    return {
      transform: [
        { perspective: TILT_PERSPECTIVE },
        { scale: 1 + (lift - 1) * p },
        /* rotateX 取负：按上半边时顶边后仰（沉下去）。写正号会让顶边朝观察者抬起，
           与地影方向相反，整张卡读作「被手指顶起来」。 */
        { rotateX: `${-clampUnit(ny.value) * maxDeg * p}deg` },
        { rotateY: `${clampUnit(nx.value) * maxDeg * p}deg` },
      ],
    };
  });

  const shadowAnim = useAnimatedStyle(() => {
    const p = clampUnit(press.value);
    return {
      opacity: 0.55 + p * 0.45,
      transform: [
        { translateX: -clampUnit(nx.value) * TILT_SHADOW_SHIFT * p },
        { translateY: -clampUnit(ny.value) * TILT_SHADOW_SHIFT * 0.75 * p + p * 5 },
        { scale: TILT_SHADOW_SCALE + p * 0.03 },
      ],
    };
  });

  const handleStart = (e: GestureResponderEvent) => {
    if (enabled) {
      const { locationX, locationY } = e.nativeEvent;
      /* 先把坐标定好再拉 press：倾角乘了 press，所以第一帧是从 0 压进来，
         不会出现「按下瞬间卡片整块歪掉」。 */
      apply(locationX, locationY);
      press.value = withSpring(1, PRESS_SPRING);
      /* 轻震一次：视觉之外唯一能把「按到了实体」讲清的信道。 */
      fireHaptic('light');
    }
    outerStart?.(e);
  };

  const handleMove = (e: GestureResponderEvent) => {
    if (enabled) {
      const { locationX, locationY } = e.nativeEvent;
      apply(locationX, locationY);
    }
    outerMove?.(e);
  };

  const handleEnd = (e: GestureResponderEvent) => {
    if (enabled) release();
    outerEnd?.(e);
  };

  const handleCancel = (e: GestureResponderEvent) => {
    if (enabled) release();
    outerCancel?.(e);
  };

  return (
    <View
      style={style}
      /* 安卓会把只有布局作用的 View 合并掉，合掉后 measure/location 就不可靠。 */
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        size.current = { w: width, h: height };
        outerLayout?.(e);
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleCancel}
    >
      {/*
        地影层：与卡片等大，静息时完全被卡片盖住，只有漂移出去的那一侧露出来。
        外扩会在静止状态沿卡片留一圈深色描边（实测 8 万像素）。
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          {
            borderRadius: radius,
            backgroundColor: shadowColor,
            boxShadow: '0 16px 32px rgba(32,60,52,0.26)',
          },
          shadowAnim,
        ]}
      />

      <Animated.View style={[styles.card, { borderRadius: radius }, cardStyle, cardAnim]}>
        <TiltContext.Provider value={ctx}>{children}</TiltContext.Provider>

        {/* 材质一：顶部受光到底部背光的微渐变，跟着卡片一起转，所以看起来像长在表面上。 */}
        <View pointerEvents="none" style={[styles.layer, { borderRadius: radius }]}>
          <View style={[styles.fill, { backgroundImage: SHEEN }]} />
        </View>

        {/* 材质三：一圈内描边倒角（上亮下暗），给纯色卡一条「切出来的边」。 */}
        <View pointerEvents="none" style={[styles.bevel, { borderRadius: radius, boxShadow: BEVEL }]} />
      </Animated.View>
    </View>
  );
}

/** worklet 内的夹逼。定义在同一文件里，跨模块调用会被 release 包的模块收口弄丢。 */
function clampUnit(v: number): number {
  'worklet';
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  card: {
    /* 卡片本体：背景/内边距由调用方的 cardStyle 给，这里只保证内容不会被挤出圆角。 */
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  bevel: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
});
