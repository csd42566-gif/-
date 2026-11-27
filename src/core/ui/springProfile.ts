/**
 * 弹性线网的物理参数与阻尼特性（纯函数，零 React / Skia 依赖）。
 *
 * 抽出来的原因：调「快不快」不该靠肉眼反复试。阻尼比 ζ、固有频率 ω、包络衰减
 * 时间常数 τ 都是能算的——ζ<1 欠阻尼会来回摆，ζ≥1 过阻尼不会过冲，
 * 3τ 之后振幅衰减到 5% 以下，主观上「停了」。
 *
 * 原型（`mockups/home-ref-b-final.html` 的 stepGrid）用 140 / 13：ω≈11.8、ζ≈0.55，
 * 3τ≈0.46s 且中间有多次可见摆动——这是「被拉着走、反应慢」的数学来源。
 */

/** 当前参数：SPRING=260 / DAMPING=29。 */
export const GRID_SPRING = 260;
export const GRID_DAMPING = 29;

export interface SpringProfile {
  /** 固有频率 ω（rad/s），越大起步越快。 */
  omega: number;
  /** 阻尼比 ζ：<1 欠阻尼会摆，=1 临界，>1 过阻尼不摆。 */
  zeta: number;
  /** 振幅包络时间常数 τ（秒），3τ 是「基本停住」的经验点。 */
  tau: number;
  /** 3τ（毫秒）：主观上静止所需时间。 */
  settleMs: number;
  /** 是否会有可见的来回摆动。 */
  oscillates: boolean;
}

/** 由刚度与阻尼算弹簧特性。质量固定为 1（网格点等效单位质量）。 */
export function springProfile(spring: number, damping: number): SpringProfile {
  const omega = Math.sqrt(spring);
  const zeta = damping / (2 * omega);
  const tau = zeta < 1 ? 1 / (zeta * omega) : 1 / (omega * (zeta - Math.sqrt(zeta * zeta - 1)));
  return {
    omega,
    zeta,
    tau,
    settleMs: Math.round(tau * 3 * 1000),
    oscillates: zeta < 1,
  };
}
