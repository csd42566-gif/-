export type TransactionType='income'|'expense'|'transfer';
export type TransactionSource='manual'|'notification'|'bank'|'root'|'import';
export type DetectedEventKind='payment'|'repayment'|'proxy-repayment'|'repayment-reminder'|'repayment-failed'|'refund';
export type DetectedEventStatus='success'|'reminder'|'failed';
export type AccountKind='cash'|'bank'|'credit'|'wallet';
export type RiskCardMode='always'|'risk-only'|'hidden';
export type ProviderIconStyle='badge'|'logo';
export type ReminderMode='punish'|'strict'|'normal';
export type BudgetGroup='essential'|'flexible';
export type RepaymentMode='minimum'|'full';
export type MotionLevel='super'|'enhanced'|'standard';
export interface Account{id:string;name:string;kind:AccountKind;balance:number}
export interface Transaction{id:string;type:TransactionType;amount:number;accountId:string;toAccountId?:string;category?:string;budgetGroup?:BudgetGroup;note?:string;occurredAt:string;source:TransactionSource;eventKind?:DetectedEventKind;eventStatus?:DetectedEventStatus;provider?:string;debtId?:string;counterparty?:string;principalAmount?:number;interestAmount?:number;installmentNumber?:number;installmentCount?:number;externalKey?:string}
export interface PendingTransaction{ id:string;type:'income'|'expense';amount:number;accountId?:string;accountLabel?:string;category?:string;note?:string;occurredAt:string;source:Exclude<TransactionSource,'manual'>;confidence:number;eventKind?:DetectedEventKind;eventStatus?:DetectedEventStatus;provider?:string;debtId?:string;counterparty?:string;principalAmount?:number;interestAmount?:number;installmentNumber?:number;installmentCount?:number }
export interface InstallmentPeriod{number:number;dueDate:string;principalAmount:number;interestAmount:number;totalAmount:number}
export interface InstallmentPlan{remainingPrincipal:number;totalPeriods:number;paidPeriods:number;annualRate?:number;repaymentType:'annuity'|'equal-principal'|'fixed-payment'|'manual';periods:InstallmentPeriod[]}
export interface Debt{id:string;name:string;amount:number;dueDate:string;minimumPayment?:number;kind:'credit'|'bill'|'loan'|'personal';repaymentMode:RepaymentMode;installment?:InstallmentPlan}
export interface Goal{id:string;name:string;targetAmount:number;startBalance:number;startBalanceAt:string;deadline:string}
export interface EssentialItem{id:string;name:string;amount:number}

export type AllowanceMode='per-day'|'fixed';
export type AllowancePhase='probation'|'regular'|'both';
export type AttendanceStatus='worked'|'rest'|'leave';
export interface Allowance{name:string;amount:number;mode:AllowanceMode;phase:AllowancePhase}
export interface WorkProfile{
  monthlyIncome:number;
  probationIncome?:number;
  probationStartDate?:string;
  regularStartDate?:string;
  restDaysPerMonth:number;
  workHoursPerDay:number;
  payday:number;
  cycleStartDay:number;
  fullAttendanceBonus?:number;
  allowances:Allowance[];
}
export interface AttendanceRecord{date:string;clockIn?:string;clockOut?:string;status:AttendanceStatus;note?:string}

export interface Settings{
  riskCardMode:RiskCardMode;
  reminderMode:ReminderMode;
  providerIconStyle:ProviderIconStyle;
  /** @deprecated Use settings.work.monthlyIncome. */
  monthlyIncome:number;
  essentialMonthlyExpenses:number;
  essentialItems:EssentialItem[];
  /** @deprecated Budget work days are derived from settings.work and attendance. */
  workDaysPerMonth:number;
  /** @deprecated Use settings.work.workHoursPerDay. */
  workHoursPerDay:number;
  strictMode:boolean;
  repaymentReminders:boolean;
  statusServiceEnabled:boolean;
  hapticsEnabled:boolean;
  motionLevel:MotionLevel;
  /** @deprecated Use motionLevel. */
  reducedMotion:boolean;
  accountDisplayOrder:string[];
  accountMapping:Record<string,string>;
  work:WorkProfile;
}
export interface LedgerState{accounts:Account[];transactions:Transaction[];pendingTransactions:PendingTransaction[];debts:Debt[];goal:Goal|null;settings:Settings;attendance?:AttendanceRecord[]}

export const defaultWorkProfile: WorkProfile = {
  monthlyIncome: 5000,
  probationIncome: 5000,
  probationStartDate: '2026-10-10',
  regularStartDate: '2026-11-10',
  restDaysPerMonth: 4,
  workHoursPerDay: 8,
  payday: 15,
  cycleStartDay: 10,
  fullAttendanceBonus: 200,
  allowances: [
    { name: '餐补', amount: 500, mode: 'fixed', phase: 'regular' },
  ],
};

export const defaultSettings: Settings = {
  riskCardMode: 'risk-only',
  reminderMode: 'punish',
  providerIconStyle: 'logo',
  monthlyIncome: 15000,
  essentialMonthlyExpenses: 0,
  essentialItems: [
    { id: 'food', name: '吃', amount: 0 },
    { id: 'housing', name: '住', amount: 0 },
  ],
  workDaysPerMonth: 22,
  workHoursPerDay: 8,
  strictMode: false,
  repaymentReminders: true,
  statusServiceEnabled: false,
  hapticsEnabled: true,
  motionLevel: 'enhanced',
  reducedMotion: false,
  accountDisplayOrder: [],
  accountMapping: {},
  work: defaultWorkProfile,
};