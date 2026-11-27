/**
 * 底部面板的高度换算（纯函数，零 React / Reanimated 依赖）。
 *
 * 面板用一个 `translateY` 表达位置：0 = 最高档（贴住屏幕顶部的最大高度），
 * 越大越矮（越靠近屏幕底部）。所有档位都是这个坐标系里的偏移量。
 *
 * 三条机制各自独立、可单测：
 * - `rubberBand`：越过边界后的阻尼位移（iOS 同一条公式），越拉越硬；
 * - `resolveSheetRelease`：松手时用「速度外推」判断吸附到哪一档，或者直接关闭；
 * - `sheetStretch`：越界上拉时面板纵向拉长的比例，让「拉到头还在拉」有形态反馈。
 *
 * 随手指连续变化的 `translateY` 用 SharedValue 驱动，但**断言与判定全部在 JS 侧**
 * （gesture 的 onEnd 里调本文件的纯函数），worklet 只负责把结果 spring 过去——
 * 这样这根逻辑链可以被测试覆盖，而不是漂在 UI 线程上没法验。
 */

/** 松手后按速度外推的时间窗（秒）。iOS 手感约 0.12～0.2，取中间。 */
export const SHEET_PROJECTION = 0.14;
/** 橡皮筋硬度：越小越硬。iOS 默认 0.55。 */
export const SHEET_RUBBER_COEFFICIENT = 0.55;
/** 外推到最低档以下这么多，就判为「关闭」。 */
export const SHEET_DISMISS_GAP = 56;
/** 越界上拉时的最大纵向拉伸比例（3.5% 已经能看出「被拉长」）。 */
export const SHEET_STRETCH_MAX = 0.035;
/** 拉伸从 0 到满的越界距离（dp）。 */
export const SHEET_STRETCH_SPAN = 160;

/**
 * 把「可见高度占窗口高度的比例」换算成 translateY 偏移量。
 *
 * `heights` 必须升序（矮 → 高），返回与之对应的偏移量，因此**结果是从大到小**：
 * 最矮的档偏移最大，最高的档恒为 0。
 * 例：窗口 800、heights [0.5, 0.75, 0.96] → [368, 168, 0]。
 *
 * 下游一律用 `Math.min/max` 取「最高 / 最矮」，不依赖数组顺序——
 * 早前 `resolveSheetRelease` 假设数组升序，把「关闭阈值」挂到了最高档上，
 * 结果任何一次下拉都被判成关闭。
 */
export function detentOffsets(windowHeight: number, heights: number[]): number[] {
  if (heights.length === 0) return [];
  const tallest = Math.max(...heights);
  return heights.map((h) => Math.round((tallest - h) * windowHeight));
}

/**
 * 橡皮筋阻尼：超出 `distance` 时返回实际位移（恒小于 `distance`）。
 *
 * 公式与 iOS `UIScrollView` 一致：`d * (1 - 1 / (x * c / d + 1))`，
 * 在 x 接近 d 时约衰减到一半，x 越大越接近「几乎拉不动」。
 */
export function rubberBand(
  distance: number,
  dimension: number,
  coefficient: number = SHEET_RUBBER_COEFFICIENT,
): number {
  if (distance <= 0 || dimension <= 0) return 0;
  return dimension * (1 - 1 / ((distance * coefficient) / dimension + 1));
}

/** 把「越界距离」换算成实际 translateY（在 [min, max] 之外时按橡皮筋走）。 */
export function clampWithRubber(
  offset: number,
  minOffset: number,
  maxOffset: number,
  dimension: number,
  coefficient: number = SHEET_RUBBER_COEFFICIENT,
): number {
  if (offset < minOffset) {
    return minOffset - rubberBand(minOffset - offset, dimension, coefficient);
  }
  if (offset > maxOffset) {
    return maxOffset + rubberBand(offset - maxOffset, dimension, coefficient);
  }
  return offset;
}

/** 按速度外推松手后的落点。 */
export function projectOffset(
  offset: number,
  velocity: number,
  projection: number = SHEET_PROJECTION,
): number {
  return offset + velocity * projection;
}

/** 找最近的档位下标。平局时取偏移量更大的那一档（更矮，往下更符合直觉）。 */
export function nearestDetentIndex(projected: number, offsets: number[]): number {
  if (offsets.length === 0) return 0;
  let best = 0;
  let bestDistance = Math.abs(projected - offsets[0]);
  for (let i = 1; i < offsets.length; i += 1) {
    const distance = Math.abs(projected - offsets[i]);
    if (distance < bestDistance || (distance === bestDistance && offsets[i] > offsets[best])) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export type SheetRelease =
  | { kind: 'detent'; index: number; offset: number }
  | { kind: 'dismiss' };

/**
 * 松手判定。
 *
 * 顺序很重要：先判关闭（速度外推越过最矮档 + 间隙），再判吸附。
 * 只按「离哪档近」判会让一次轻甩到底部变成「吸回最矮档」，用户得连甩两次才关得掉。
 *
 * 「最矮档」取 `Math.max(offsets)`，不能用 `offsets[last]`：`detentOffsets` 返回的是
 * 从大到小（最高档恒为 0 且排在最后），用 `offsets[last]` 会把阈值挂到 0 上。
 */
export function resolveSheetRelease(
  offset: number,
  velocity: number,
  offsets: number[],
  dismissGap: number = SHEET_DISMISS_GAP,
): SheetRelease {
  if (offsets.length === 0) return { kind: 'dismiss' };
  const shortest = Math.max(...offsets);
  const projected = projectOffset(offset, velocity);
  if (projected > shortest + dismissGap) return { kind: 'dismiss' };
  const index = nearestDetentIndex(projected, offsets);
  return { kind: 'detent', index, offset: offsets[index] };
}

/** 越界上拉时的纵向拉伸比例：1 = 不变形。 */
export function sheetStretch(
  offset: number,
  minOffset: number,
  max: number = SHEET_STRETCH_MAX,
  span: number = SHEET_STRETCH_SPAN,
): number {
  const over = minOffset - offset;
  if (over <= 0 || span <= 0) return 1;
  return 1 + Math.min(over / span, 1) * max;
}
