/**
 * 共享元素形变用的几何常量与换算（纯函数，零 React Native 依赖）。
 *
 * 单独放在 core 而不是跟组件放一起的原因：`src/ui/morphDetail.tsx` 为了画卡片必然
 * import react-native，而 jest 环境没有 RN 的 transform，从组件里 import 纯函数
 * 会让整个测试套件报 `Cannot use import statement outside a module`。
 * 几何这部分是要单测锁住的（卡片高度算错会让形变终点错位），所以抽出来。
 */

/** 详情卡左右外边距（与各页 `paddingHorizontal: 17` 一致）。 */
export const DETAIL_MARGIN = 17;
/**
 * 卡片顶距（相对状态栏下沿）。
 *
 * 不能随便取。各页页头结构是：`paddingTop = insets.top + 14` → kicker（行高 11）
 * → 标题（marginTop 7.6 + 行高 33.8）。也就是标题块占 `insets.top + 14` 到
 * `insets.top + 66.4`。原来写 56 会让卡片顶正好切在标题中间——实测概览页
 * 「概览」两字的下半截被卡片盖住、上半截露在外面。
 *
 * 72 = 66.4（标题下沿）+ 约 6dp 呼吸，保证卡片从页头下方开始。
 */
export const DETAIL_TOP_GAP = 72;
/** 卡片内边距（与 transaction/[id].tsx 的 card 一致）。 */
export const DETAIL_PADDING_V = 17;
/** 头部高度（彩色图标块 46）。 */
export const DETAIL_HEAD_HEIGHT = 46;
/** 单条元信息行高度。 */
export const DETAIL_META_LINE = 26;
/** 元信息块除行以外的固定开销：borderTop(1) + paddingTop(4) + marginTop(14)。 */
export const DETAIL_META_EXTRA = 19;

/**
 * 详情卡的目标高度（dp）。
 * 与 `transaction/[id].tsx` 的白卡布局一一对应：上下 padding + 头部 + 元信息块。
 * 行数为 0 时不算元信息块（那时那一块整体不渲染）。
 */
export function detailCardHeight(lineCount: number): number {
  const meta = lineCount > 0 ? DETAIL_META_EXTRA + lineCount * DETAIL_META_LINE : 0;
  return DETAIL_PADDING_V * 2 + DETAIL_HEAD_HEIGHT + meta;
}
