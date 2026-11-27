import {
  SHEET_DISMISS_GAP,
  SHEET_PROJECTION,
  SHEET_RUBBER_COEFFICIENT,
  SHEET_STRETCH_MAX,
  clampWithRubber,
  detentOffsets,
  nearestDetentIndex,
  projectOffset,
  resolveSheetRelease,
  rubberBand,
  sheetStretch,
} from './sheet';

describe('detentOffsets', () => {
  it('最高档偏移为 0；中间档按「容器高度 − 该档可见高度」算', () => {
    /* 容器高 = 0.96×800 = 768；0.75 档可见 600 → 768−600 = 168；0.5 档可见 400 → 368。 */
    expect(detentOffsets(800, [0.5, 0.75, 0.96])).toEqual([368, 168, 0]);
  });

  it('单档时恒为 0（整屏高度就是最高档）', () => {
    expect(detentOffsets(800, [0.8])).toEqual([0]);
  });

  it('空数组不炸', () => {
    expect(detentOffsets(800, [])).toEqual([]);
  });
});

describe('rubberBand', () => {
  it('位移恒小于原始距离（越拉越硬）', () => {
    for (const d of [10, 60, 200, 600]) {
      expect(rubberBand(d, 800)).toBeLessThan(d);
    }
  });

  it('起点斜率就是系数本身（0.55），越拉越硬', () => {
    /* iOS 的阻力从第一像素就生效：小位移时位移≈距离×0.55，不是 1:1。 */
    const near = rubberBand(4, 800) / 4;
    const mid = rubberBand(240, 800) / 240;
    const far = rubberBand(480, 800) / 480;
    expect(near).toBeCloseTo(0.55, 2);
    expect(mid).toBeLessThan(near);
    expect(far).toBeLessThan(mid);
  });

  it('位移永远小于原始距离，且封顶在尺寸以内', () => {
    expect(rubberBand(480, 800)).toBeLessThan(480);
    expect(rubberBand(100000, 800)).toBeLessThan(800);
  });

  it('越界为 0 或负数时返回 0', () => {
    expect(rubberBand(0, 800)).toBe(0);
    expect(rubberBand(-40, 800)).toBe(0);
  });

  it('尺寸为 0 不除零', () => {
    expect(rubberBand(120, 0)).toBe(0);
  });

  it('系数越小越硬', () => {
    expect(rubberBand(200, 800, 0.3)).toBeLessThan(rubberBand(200, 800, 0.8));
  });
});

describe('clampWithRubber', () => {
  const min = 0;
  const max = 368;

  it('范围内原样返回', () => {
    expect(clampWithRubber(100, min, max, 800)).toBe(100);
  });

  it('越上界后被压住，但仍比上界高一点', () => {
    const v = clampWithRubber(-200, min, max, 800);
    expect(v).toBeLessThan(min);
    expect(v).toBeGreaterThan(min - 200);
  });

  it('越下界后被压住，但仍比下界低一点', () => {
    const v = clampWithRubber(600, min, max, 800);
    expect(v).toBeGreaterThan(max);
    expect(v).toBeLessThan(600);
  });
});

describe('projectOffset / nearestDetentIndex', () => {
  it('速度外推按 0.14s 的时间窗', () => {
    expect(projectOffset(100, 1000)).toBeCloseTo(100 + 1000 * SHEET_PROJECTION, 5);
    expect(projectOffset(100, -100)).toBeCloseTo(100 - 100 * SHEET_PROJECTION, 5);
  });

  it('落在两档之间取更近的一档', () => {
    /* offsets 是偏移量不是可见高度：0 = 最高，越大越矮。 */
    expect(nearestDetentIndex(90, [0, 200, 368])).toBe(0);
    expect(nearestDetentIndex(180, [0, 200, 368])).toBe(1);
    expect(nearestDetentIndex(300, [0, 200, 368])).toBe(2);
  });

  it('平局取更矮的那一档（偏移量更大的那个，往下更符合预期）', () => {
    expect(nearestDetentIndex(100, [0, 200])).toBe(1);
    expect(nearestDetentIndex(200, [0, 200, 400])).toBeCloseTo(1, 6);
  });

  it('不依赖数组顺序：detentOffsets 的真实形状是从大到小', () => {
    const real = detentOffsets(731, [0.52, 0.78, 0.93]); // [300, 110, 0]
    expect(nearestDetentIndex(0, real)).toBe(2);
    expect(nearestDetentIndex(110, real)).toBe(1);
    expect(nearestDetentIndex(300, real)).toBe(0);
  });
});

describe('resolveSheetRelease', () => {
  const offsets = [0, 200, 368];

  it('几乎不动时留在当前档', () => {
    expect(resolveSheetRelease(10, 0, offsets)).toEqual({ kind: 'detent', index: 0, offset: 0 });
  });

  it('轻甩也会跳到相邻档（速度参与判定）', () => {
    // 位置只差 40，但速度 900 往下 → 外推 126 → 落点 166 → 吸附到第二档
    expect(resolveSheetRelease(40, 900, offsets)).toEqual({ kind: 'detent', index: 1, offset: 200 });
  });

  it('从最高档快速往下甩会直接关闭，而不是弹回最矮档', () => {
    expect(resolveSheetRelease(360, 1400, offsets)).toEqual({ kind: 'dismiss' });
  });

  it('往下拖得够远（越过最低档 + 间隙）即使速度小也关闭', () => {
    expect(resolveSheetRelease(368 + SHEET_DISMISS_GAP + 1, 0, offsets)).toEqual({ kind: 'dismiss' });
  });

  it('向上甩会回到更高的一档', () => {
    expect(resolveSheetRelease(200, -1200, offsets)).toEqual({ kind: 'detent', index: 0, offset: 0 });
  });

  it('没有档位时视为关闭', () => {
    expect(resolveSheetRelease(0, 0, [])).toEqual({ kind: 'dismiss' });
  });

  it('用 detentOffsets 的真实形状（从大到小）也不会误判关闭', () => {
    /* 真机回归：offsets=[300,110,0]，从最高档往下拖 229dp、松手速度 149dp/s，
       旧实现把「最矮档」取成 offsets[last]=0，于是 229 > 56 直接判关闭。 */
    expect(resolveSheetRelease(229, 149, [300, 110, 0])).toEqual({
      kind: 'detent',
      index: 0,
      offset: 300,
    });
  });

  it('真实形状下越过最矮档仍能关闭', () => {
    expect(resolveSheetRelease(330, 600, [300, 110, 0])).toEqual({ kind: 'dismiss' });
  });
});

describe('sheetStretch', () => {
  it('没有越界时不变形', () => {
    expect(sheetStretch(0, 0)).toBe(1);
    expect(sheetStretch(80, 0)).toBe(1);
  });

  it('越界越深拉得越长，但封顶', () => {
    const half = sheetStretch(-80, 0);
    const full = sheetStretch(-400, 0);
    expect(half).toBeGreaterThan(1);
    expect(full).toBeGreaterThan(half);
    expect(full).toBeCloseTo(1 + SHEET_STRETCH_MAX, 6);
  });
});

describe('参数口径', () => {
  it('橡皮筋系数用 iOS 默认 0.55', () => {
    expect(SHEET_RUBBER_COEFFICIENT).toBe(0.55);
  });

  it('速度外推窗口 0.14s——太短读不出甩动，太长会飞过头', () => {
    expect(SHEET_PROJECTION).toBe(0.14);
  });

  it('关闭间隙 56dp，拉伸上限 3.5%', () => {
    expect(SHEET_DISMISS_GAP).toBe(56);
    expect(SHEET_STRETCH_MAX).toBeCloseTo(0.035, 6);
  });
});
