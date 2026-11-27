/**
 * 近 30 天每日支出曲线（方案 B 首页余额卡右侧那条窄图）。
 * 定宽由外部给（120dp），内部按点数均分横轴。
 *
 * 两个视觉处理（都是为「刚开始记账、只有一两天有支出」的场景）：
 * 1. 纵轴用 sqrt 归一化，而不是线性——否则单日峰值会把其余 29 天全压成贴底直线。
 * 2. 每段用二次贝塞尔以原始点为控制点、相邻中点为端点，折线拐角被磨圆，不再是锯齿。
 *
 * 用 react-native-svg 画：曲线在高 DPI 安卓屏上比「旋转 View 拼线段」干净，
 * 且它已是本项目的传递依赖（gifted-charts 依赖它，node_modules 里 15.16.1）。
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from './theme';

export interface SparklineProps {
  /** 每日金额（分），按时间正序。 */
  series: number[];
  width: number;
  height: number;
  /** 曲线主色，默认主题琥珀。 */
  color?: string;
  /** 面积填充的不透明度，默认 0.42（首页窄图）。洞察页主卡用 0.3，压在琥珀底上不糊。 */
  fillOpacity?: number;
  /** 描边粗细，默认 1.8（首页窄图）。洞察页主卡用 1.5 更接近原型 2.8px×K=1.5dp。 */
  strokeWidth?: number;
}

/** 非零日的最小可见高度占比：避免「只有一两天有账」时曲线只剩一根刺。 */
const MIN_VISIBLE_RATIO = 0.12;

interface Pt {
  x: number;
  y: number;
}

/** 数值序列 → 屏幕坐标点。全 0 时整条贴底，不画成中位线。
 *  有支出但远低于峰值的日子给一个最小可见高度（12%），否则「只记过一笔」的用户看到的是
 *  一条贴底直线加一根刺，读不出「哪天花了钱」。 */
function buildPoints(series: number[], width: number, height: number): Pt[] {
  if (series.length === 0) return [];
  const peak = Math.max(...series);
  const usable = height - 4; // 上下各留 2dp，避免描边被裁
  const step = series.length > 1 ? width / (series.length - 1) : width;
  return series.map((value, i) => {
    let ratio = 0;
    if (peak > 0 && value > 0) {
      ratio = Math.max(MIN_VISIBLE_RATIO, Math.sqrt(value / peak));
    }
    return {
      x: series.length > 1 ? i * step : width / 2,
      y: height - 2 - ratio * usable,
    };
  });
}

/** 平滑路径：首点到第一中点用直线，中间各段用「原始点作控制点、中点作端点」的二次贝塞尔。 */
function smoothPath(points: Pt[], width: number, height: number): string {
  if (points.length === 0) return `M0,${height} L${width},${height}`;
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x.toFixed(2)},${p.y.toFixed(2)} L${width},${p.y.toFixed(2)}`;
  }
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const next = points[i + 1];
    const midX = (p.x + next.x) / 2;
    const midY = (p.y + next.y) / 2;
    d += ` Q${p.x.toFixed(2)},${p.y.toFixed(2)} ${midX.toFixed(2)},${midY.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x.toFixed(2)},${last.y.toFixed(2)}`;
  return d;
}

export function Sparkline({
  series,
  width,
  height,
  color,
  fillOpacity = 0.42,
  strokeWidth = 1.8,
}: SparklineProps) {
  const theme = useTheme();
  const stroke = color ?? theme.amber;
  const points = buildPoints(series, width, height);
  const line = smoothPath(points, width, height);
  const last = points.length > 0 ? points[points.length - 1] : null;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={fillOpacity} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.42} />
            <Stop offset="0.62" stopColor={stroke} stopOpacity={1} />
            <Stop offset="1" stopColor={stroke} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#sparkFill)" />
        <Path
          d={line}
          fill="none"
          stroke="url(#sparkStroke)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {last !== null && <Circle cx={last.x} cy={last.y} r={2.4} fill={stroke} />}
      </Svg>
    </View>
  );
}
