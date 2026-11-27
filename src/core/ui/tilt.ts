/**
 * 3D 倾斜的几何换算（纯函数，零 React / Reanimated 依赖）。
 *
 * 手指按住面板时，面板绕 X/Y 轴微倾，倾角由触点相对面板中心的位置决定：
 * 触点越靠边，倾角越大；越靠中心，越接近水平。
 *
 * 参数是对齐两个成熟实现后的取值：
 * - Kinetik UI Tilt Deck（Expo / Reanimated 4 同栈）：maxTilt 12、perspective 800、
 *   lift 1.03、parallax 10、地影位移 8，并且明确说「按压处的那个角沉下去」。
 * - vanilla-tilt：max 15、perspective 1000、示例里 scale 1.03。
 *
 * 卡片宽 379dp、卡内最小字号 8.7dp，12° 会让小字梯形失真，9° 是「看得出面在转」与
 * 「字还不糊」的分界。透视 800 配 9° 与 950 配 12° 的边缘放大率接近，但 800 的纵深更明显。
 *
 * 随 `press` 连续变化的三条算式（浮起、视差、地影位移）**故意不放在这里**——它们要在
 * worklet 里跑，而 release 包对跨模块调用的收口会把这些 helper 弄成 undefined
 * （实测崩溃：TypeError: undefined is not a function @tiltScale）。常量仍从这里导出，
 * 算式内联在 src/ui/tiltPanel.tsx 的 useAnimatedStyle 里。
 */

/** 倾角上限（度）。 */
export const TILT_MAX_DEG = 9;
/** 透视距离（dp）。越低越夸张。 */
export const TILT_PERSPECTIVE = 800;
/** 按压时的放大倍数（浮起量）。 */
export const TILT_LIFT = 1.03;
/** 内容视差：每 1 单位 depth 相对卡面的最大位移（dp）。 */
export const TILT_PARALLAX = 10;
/** 地影相对卡片的反向位移（dp）。 */
export const TILT_SHADOW_SHIFT = 9;
/** 地影静息缩放（比卡片略小，按下时放大追上来）。 */
export const TILT_SHADOW_SCALE = 0.98;

export interface TiltAngles {
  /** 绕 X 轴（左右为轴线，上下倾斜）。 */
  rotateX: number;
  /** 绕 Y 轴（上下为轴线，左右倾斜）。 */
  rotateY: number;
  /** 归一化触点，-1…1，供视差层消费。 */
  normX: number;
  normY: number;
}

/** 静止态（水平、无压）。 */
export const TILT_REST: TiltAngles = {
  rotateX: 0,
  rotateY: 0,
  normX: 0,
  normY: 0,
};

/**
 * 由触点算倾角。
 *
 * `x / y` 是触点在面板内的局部坐标，`w / h` 是面板尺寸。
 *
 * **方向（这条最容易搞反，直接决定手感）**：CSS / RN 的 `rotateX(正)` 把下边拉向观察者
 * （顶边后仰），`rotateY(正)` 把右边推远。用户要的是「按哪沉哪」，所以：
 * - 按住右半边（normX > 0）→ 右边沉 → rotateY 取正；
 * - 按住上半边（normY < 0）→ 顶边沉 → 需要顶边后仰 → rotateX 取 **负**。
 *
 * 上一版把 rotateX 写成了 `normY * maxDeg`（正号），按顶边会让它抬起来，与地影
 * （按下边时影子往上跑）方向相反，读作「卡片被手指顶起来」而不是「按下去」。
 * Kinetik 原文同样是 `rotateX: -y * maxTilt`。
 */
export function tiltFromTouch(
  x: number,
  y: number,
  w: number,
  h: number,
  maxDeg: number = TILT_MAX_DEG,
): TiltAngles {
  /* 不加 'worklet'：这个函数只在 JS 侧（触摸回调）调用。加了之后 babel 会把它编成
     worklet 工厂并捕获模块级 TILT_REST / clamp，release 包收口时捕获失效，
     实测崩溃：TypeError: undefined is not a function @tiltFromTouch。 */
  if (w <= 0 || h <= 0) return TILT_REST;
  const normX = clamp((x / w) * 2 - 1, -1, 1);
  const normY = clamp((y / h) * 2 - 1, -1, 1);
  return {
    rotateX: -normY * maxDeg,
    rotateY: normX * maxDeg,
    normX,
    normY,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
