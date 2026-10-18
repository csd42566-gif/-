import { EssentialItem } from '../../core/model/finance';

export function essentialItemsTotal(items: EssentialItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}