import { Account } from '../../core/model/finance';

export function orderAccounts(accounts: Account[], savedOrder: string[]): Account[] {
  const positions = new Map(savedOrder.map((id, index) => [id, index]));
  return accounts
    .map((account, index) => ({ account, index }))
    .sort((left, right) => {
      const leftPosition = positions.get(left.account.id);
      const rightPosition = positions.get(right.account.id);
      if (leftPosition !== undefined && rightPosition !== undefined) return leftPosition - rightPosition;
      if (leftPosition !== undefined) return -1;
      if (rightPosition !== undefined) return 1;
      return defaultAccountRank(left.account) - defaultAccountRank(right.account) || left.index - right.index;
    })
    .map(({ account }) => account);
}

export function moveAccountId(orderedIds: string[], draggedId: string, targetId: string): string[] {
  const fromIndex = orderedIds.indexOf(draggedId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return orderedIds;
  const next = [...orderedIds];
  next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, draggedId);
  return next;
}

export function appendAccountId(accounts: Account[], savedOrder: string[], newAccountId: string): string[] {
  const existingIds = orderAccounts(accounts, savedOrder).map((account) => account.id);
  return existingIds.includes(newAccountId) ? existingIds : [...existingIds, newAccountId];
}

function defaultAccountRank(account: Account): number {
  if (account.name.includes('支付宝')) return 0;
  if (account.name.includes('微信')) return 1;
  if (account.kind === 'bank' || account.name.includes('银行卡')) return 2;
  if (account.kind === 'cash' || account.name.includes('现金')) return 3;
  return 4;
}
