import { providerLabels } from '../../core/model/providers';

export type StatementProvider = 'alipay' | 'wechat' | 'cmb' | 'icbc' | 'ccb' | 'boc' | 'citic' | 'other';

export const statementProviderLabels: Record<StatementProvider, string> = {
  alipay: providerLabels.alipay,
  wechat: providerLabels.wechat,
  cmb: providerLabels.cmb,
  icbc: providerLabels.icbc,
  ccb: providerLabels.ccb,
  boc: providerLabels.boc,
  citic: providerLabels.citic,
  other: '其他 App',
};