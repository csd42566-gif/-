import { LedgerState, defaultSettings } from '../core/model/finance';

export const seedState: LedgerState = {
  accounts: [
    { id: 'cash', name: '现金', kind: 'cash', balance: 500 },
    { id: 'bank', name: '储蓄卡', kind: 'bank', balance: 2500 },
    { id: 'credit', name: '信用卡', kind: 'credit', balance: -1200 },
  ],
  pendingTransactions: [],
  transactions: [
    { id: 'seed-1', type: 'expense', amount: 86, accountId: 'cash', category: '餐饮', budgetGroup: 'flexible', occurredAt: '2026-10-16T12:00:00.000Z', source: 'manual' },
    { id: 'seed-2', type: 'income', amount: 8000, accountId: 'bank', category: '工资', occurredAt: '2026-10-01T09:00:00.000Z', source: 'manual' },
  ],
  debts: [
    { id: 'd1', name: '花呗', amount: 860, dueDate: '2026-10-25', minimumPayment: 300, kind: 'credit' },
    { id: 'd2', name: '房租', amount: 3000, dueDate: '2026-10-30', kind: 'bill' },
    { id: 'd3', name: '信用卡', amount: 1150, dueDate: '2026-11-05', minimumPayment: 300, kind: 'credit' },
  ],
  goal: { id: 'goal', name: '一年存下 10 万', targetAmount: 100000, savedAmount: 20000, deadline: '2027-10-15' },
  settings: { ...defaultSettings },
};
