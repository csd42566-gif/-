/**
 * 底部面板（拖拽把手 + 橡皮筋越界阻尼 + 按速度吸附档位）。
 *
 * 几何：面板高度取「最高档占比 × 窗口高度」（百分比），位置用 `translateY` 表达。
 * 偏移量 0 = 最高档（贴到接近屏幕顶），越大越矮。档位偏移由 core 的 `detentOffsets` 算。
 *
 * 三条行为的落点：
 * 1. **橡皮筋**：拖动越过最高档或最低档时，位移按 iOS 的阻尼曲线压缩（`onUpdate` 里内联，
 *    因为 worklet 不能跨模块调函数——这条坑在倾斜面板上崩过两次），松手后弹簧归位。
 * 2. **拉伸**：越界上拉时面板纵向最多拉长 3.5%，`scaleY` 绕中心放大再补一半位移把顶边钉住，
 *    拉长落在屏幕外，读作「面板被拉长」而不是「整块往下掉」。
 * 3. **吸附**：松手时把「当前位移 + 速度 × 0.14s」当落点，交给 core 的 `resolveSheetRelease`
 *    判档位或关闭。判定留在 JS 侧（可单测），worklet 只负责弹簧。
 *
 * 窗口高度用 `useWindowDimensions` 的实时值：安卓默认 adjustResize，键盘弹出会改窗口高度。
 * 面板跟着窗口一起缩，并重新吸附到同一档，光标所在输入框才不会被键盘顶出屏幕。
 *
 * 手势用 react-native-gesture-handler 的 Pan（跑在 UI 线程；面板拖动对延迟极敏感，
 * 走 JS 线程的 onTouchMove 会有一到两帧滞后）。需要外层 GestureHandlerRootView，根布局已有。
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SHEET_DISMISS_GAP, detentOffsets, resolveSheetRelease } from '../core/ui/sheet';
import { RADIUS, useTheme } from './theme';

/** 吸附：干脆、几乎不过冲。 */
const SNAP_SPRING = { damping: 26, stiffness: 320, mass: 0.9 };
/** 关闭：直线滑出，等它走完再通知路由，避免中途拆视图。 */
const CLOSE_DURATION = 190;

export type BottomSheetProps = {
  children: React.ReactNode;
  /**
   * 档位：每档是「可见高度占窗口高度的比例」，必须升序。
   * 最高的那一档决定面板高度；最低的那档继续下拉可关闭。
   */
  detentHeights: number[];
  /** 初始档位下标，默认最后一档（最高）。 */
  initialDetent?: number;
  /** 关闭（下拉甩出或点遮罩）。 */
  onClose: () => void;
  /** 顶部圆角，默认 RADIUS.sheet。 */
  radius?: number;
  /** 面板表面样式（背景色等）。 */
  style?: StyleProp<ViewStyle>;
};

export function BottomSheet({
  children,
  detentHeights,
  initialDetent,
  onClose,
  radius = RADIUS.sheet,
  style,
}: BottomSheetProps) {
  const theme = useTheme();
  const { height: windowH } = useWindowDimensions();

  const offsets = useMemo(() => detentOffsets(windowH, detentHeights), [windowH, detentHeights]);
  /* 偏移量 0 = 最高档；`detentOffsets` 返回从大到小，所以两端都用 min/max 取，不依赖顺序。 */
  const topOffset = offsets.length ? Math.min(...offsets) : 0;
  const bottomOffset = offsets.length ? Math.max(...offsets) : 0;
  const maxFraction = Math.max(...detentHeights);
  const startIndex = Math.min(
    Math.max(initialDetent ?? offsets.length - 1, 0),
    Math.max(offsets.length - 1, 0),
  );

  /** 当前所处档位，窗口高度变化（键盘）时按它重新吸附。 */
  const curIndex = useRef(startIndex);
  /** 起始停在屏幕外，挂载后弹到目标档——转场动画交给面板自己。 */
  const ty = useSharedValue(windowH);
  const dragStart = useSharedValue(0);
  /** 首帧就落位，之后窗口高度变化才走弹簧（否则键盘一弹面板会从屏幕外飞进来）。 */
  const mounted = useRef(false);

  useEffect(() => {
    const target = offsets[curIndex.current] ?? 0;
    if (!mounted.current) {
      mounted.current = true;
      ty.value = withSpring(target, SNAP_SPRING);
      return;
    }
    ty.value = withSpring(target, SNAP_SPRING);
  }, [offsets, ty]);

  const close = useCallback(() => {
    ty.value = withTiming(windowH, { duration: CLOSE_DURATION }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, ty, windowH]);

  /** 松手判定跑在 JS 侧：能单测，也不用把档位数组塞进 worklet。 */
  const settle = useCallback(
    (offset: number, velocity: number) => {
      const result = resolveSheetRelease(offset, velocity, offsets, SHEET_DISMISS_GAP);
      if (result.kind === 'dismiss') {
        close();
        return;
      }
      curIndex.current = result.index;
      ty.value = withSpring(result.offset, SNAP_SPRING);
    },
    [close, offsets, ty],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        /* 手指移出把手区域后继续跟手，否则轻微上滑就断。 */
        .shouldCancelWhenOutside(false)
        .minDistance(2)
        .onStart(() => {
          dragStart.value = ty.value;
        })
        .onUpdate((e) => {
          const raw = dragStart.value + e.translationY;
          /* 橡皮筋内联：跨模块调 core 的函数在 release 包里会变成 undefined。
             公式与 core 的 rubberBand 逐字一致，测试覆盖的是那一条。 */
          const dimension = windowH * 0.4;
          if (raw < topOffset) {
            const over = topOffset - raw;
            ty.value = topOffset - dimension * (1 - 1 / ((over * 0.55) / dimension + 1));
          } else if (raw > bottomOffset) {
            const over = raw - bottomOffset;
            ty.value = bottomOffset + dimension * (1 - 1 / ((over * 0.55) / dimension + 1));
          } else {
            ty.value = raw;
          }
        })
        .onEnd((e) => {
          runOnJS(settle)(ty.value, e.velocityY);
        }),
    [bottomOffset, dragStart, settle, topOffset, ty, windowH],
  );

  const sheetAnim = useAnimatedStyle(() => {
    const height = windowH * maxFraction;
    /* 越界上拉 → 纵向拉伸。scaleY 绕中心放大，补一半位移把顶边钉回原位。 */
    const over = topOffset - ty.value;
    const stretch = over > 0 ? 1 + Math.min(over / 160, 1) * 0.035 : 1;
    return {
      transform: [
        { translateY: ty.value + (height * (stretch - 1)) / 2 },
        { scaleY: stretch },
      ],
    };
  });

  const backdropAnim = useAnimatedStyle(() => {
    const span = Math.max(bottomOffset - topOffset, 1);
    const t = Math.min(Math.max((ty.value - topOffset) / span, 0), 1);
    /* 面板已经滑过最矮档（正在关闭）时，遮罩跟着淡出。 */
    const fade = Math.min(Math.max((ty.value - bottomOffset) / 200, 0), 1);
    return { opacity: (0.44 - 0.14 * t) * (1 - fade) };
  });

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropAnim]}>
        <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(close)())}>
          <View style={styles.fill} />
        </GestureDetector>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: `${maxFraction * 100}%`,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            backgroundColor: theme.bg,
          },
          style,
          sheetAnim,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grabArea}>
            <View style={[styles.grabHandle, { backgroundColor: theme.handle }]} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B1410',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  grabArea: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabHandle: {
    width: 39,
    height: 3,
    borderRadius: 1.5,
  },
});
