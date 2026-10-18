import { defaultSettings } from '../../core/model/finance';
import { essentialItemsTotal } from './essentialItems';

test('固定花费合计支持多个会员和金额', () => {
  expect(essentialItemsTotal([
    ...defaultSettings.essentialItems,
    { id: 'video', name: '视频会员', amount: 25 },
    { id: 'music', name: '音乐会员', amount: 15.5 },
  ])).toBe(40.5);
});