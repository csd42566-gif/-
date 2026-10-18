export type StatementProvider = 'alipay' | 'wechat' | 'cmb' | 'icbc' | 'ccb' | 'boc' | 'citic' | 'other';

export const statementProviderLabels: Record<StatementProvider, string> = {
  alipay: '支付宝',
  wechat: '微信',
  cmb: '招商银行',
  icbc: '工商银行',
  ccb: '建设银行',
  boc: '中国银行',
  citic: '中信银行',
  other: '其他 App',
};