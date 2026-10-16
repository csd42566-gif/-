export type TransactionType='income'|'expense'|'transfer';
export type TransactionSource='manual'|'notification'|'bank'|'root'|'import';
export type AccountKind='cash'|'bank'|'credit'|'wallet';
export type RiskCardMode='always'|'risk-only'|'hidden';
export type ReminderMode='balanced'|'strict'|'light';
export type BudgetGroup='essential'|'flexible';
export interface Account{id:string;name:string;kind:AccountKind;balance:number}
export interface Transaction{id:string;type:TransactionType;amount:number;accountId:string;toAccountId?:string;category?:string;budgetGroup?:BudgetGroup;note?:string;occurredAt:string;source:TransactionSource}
export interface PendingTransaction{ id:string;type:'income'|'expense';amount:number;accountId:string;category?:string;note?:string;occurredAt:string;source:Exclude<TransactionSource,'manual'>;confidence:number }
export interface Debt{id:string;name:string;amount:number;dueDate:string;minimumPayment?:number;kind:'credit'|'bill'|'loan'|'personal'}
export interface Goal{id:string;name:string;targetAmount:number;savedAmount:number;deadline:string}
export interface Settings{riskCardMode:RiskCardMode;reminderMode:ReminderMode;monthlyIncome:number;essentialMonthlyExpenses:number;workDaysPerMonth:number;workHoursPerDay:number;strictMode:boolean;repaymentReminders:boolean;reducedMotion:boolean}
export interface LedgerState{accounts:Account[];transactions:Transaction[];pendingTransactions:PendingTransaction[];debts:Debt[];goal:Goal|null;settings:Settings}

export const defaultSettings: Settings = {
  riskCardMode: 'risk-only',
  reminderMode: 'balanced',
  monthlyIncome: 15000,
  essentialMonthlyExpenses: 1500,
  workDaysPerMonth: 22,
  workHoursPerDay: 8,
  strictMode: false,
  repaymentReminders: true,
  reducedMotion: false,
};
