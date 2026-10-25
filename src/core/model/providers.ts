export type ProviderId = 'alipay' | 'wechat' | 'douyin' | 'dewu' | 'jd' | 'meituan' | 'cmb' | 'icbc' | 'ccb' | 'boc' | 'citic';

export const providerLabels: Record<ProviderId, string> = {
  alipay: '支付宝',
  wechat: '微信',
  douyin: '抖音',
  dewu: '得物',
  jd: '京东',
  meituan: '美团',
  cmb: '招商银行',
  icbc: '工商银行',
  ccb: '建设银行',
  boc: '中国银行',
  citic: '中信银行',
};

export const manualProviderLabel = '手动记账';
