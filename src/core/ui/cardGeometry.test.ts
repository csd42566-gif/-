import {
  DETAIL_HEAD_HEIGHT,
  DETAIL_MARGIN,
  DETAIL_META_LINE,
  DETAIL_PADDING_V,
  DETAIL_TOP_GAP,
  detailCardHeight,
} from './cardGeometry';

describe('detailCardHeight', () => {
  it('几何随元信息行数线性增长', () => {
    const one = detailCardHeight(1);
    const three = detailCardHeight(3);
    expect(three - one).toBe(2 * DETAIL_META_LINE);
  });

  it('没有元信息行时只剩卡片内边距与头部', () => {
    expect(detailCardHeight(0)).toBe(DETAIL_PADDING_V * 2 + DETAIL_HEAD_HEIGHT);
  });

  it('行数变化不会让高度退化成负数或 0', () => {
    expect(detailCardHeight(1)).toBeGreaterThan(0);
    expect(detailCardHeight(5)).toBeGreaterThan(detailCardHeight(3));
  });
});

describe('DETAIL_TOP_GAP', () => {
  /**
   * 页头占位：paddingTop 14 + kicker 11 + 标题 marginTop 7.6 + 标题行高 33.8 = 66.4。
   * 卡片顶必须在它下方，否则会切在标题中间（实测过 56 时「概览」下半截被盖）。
   */
  const HEADER_BOTTOM = 14 + 11 + 7.6 + 33.8;

  it('卡片顶在页头下沿之下，不压标题', () => {
    expect(DETAIL_TOP_GAP).toBeGreaterThan(HEADER_BOTTOM);
  });

  it('也不能低太多，否则页面顶部的 280dp 卡片会掉出首屏', () => {
    expect(DETAIL_TOP_GAP).toBeLessThan(HEADER_BOTTOM + 20);
  });

  it('左右外边距与各页 paddingHorizontal 一致', () => {
    expect(DETAIL_MARGIN).toBe(17);
  });
});
