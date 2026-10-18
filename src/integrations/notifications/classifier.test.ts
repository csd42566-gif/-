import { classifyNotification } from './classifier';

describe('notification financial event classifier', () => {
  test('classifies a successful platform repayment', () => {
    expect(classifyNotification({ provider: '\u82b1\u5457', title: '\u82b1\u5457\u8fd8\u6b3e\u6210\u529f', summary: '\u5df2\u8fd8\u6b3e \u00a5500' })).toMatchObject({
      kind: 'repayment', status: 'success', type: 'expense', category: '\u8fd8\u6b3e', provider: '\u82b1\u5457',
    });
  });

  test('classifies a proxy repayment and keeps a bounded counterparty hint', () => {
    expect(classifyNotification({ provider: '\u5fae\u4fe1\u652f\u4ed8', title: '\u4ee3\u5f20\u4e09\u8fd8\u6b3e\u6210\u529f', summary: '\u4ed8\u6b3e \u00a588.00' })).toMatchObject({
      kind: 'proxy-repayment', status: 'success', type: 'expense', counterparty: '\u5f20\u4e09',
    });
  });

  test('classifies reminders and failures without making them successful expenses', () => {
    expect(classifyNotification({ provider: '\u767d\u6761', title: '\u767d\u6761\u5f85\u8fd8\u63d0\u9192', summary: '\u672c\u671f\u5e94\u8fd8 \u00a5300' })).toMatchObject({ kind: 'repayment-reminder', status: 'reminder', type: 'expense' });
    expect(classifyNotification({ provider: '\u4fe1\u7528\u5361', title: '\u8fd8\u6b3e\u5931\u8d25', summary: '\u8bf7\u91cd\u65b0\u8fd8\u6b3e \u00a5300' })).toMatchObject({ kind: 'repayment-failed', status: 'failed', type: 'expense' });
  });

  test('keeps ordinary payment separate from repayment', () => {
    expect(classifyNotification({ provider: '\u652f\u4ed8\u5b9d', title: '\u652f\u4ed8\u6210\u529f', summary: '\u4ed8\u6b3e \u00a538.50' })).toMatchObject({ kind: 'payment', status: 'success', type: 'expense' });
  });

  test('rejects raw notification bodies at the classifier boundary', () => {
    expect(classifyNotification({ provider: '\u652f\u4ed8\u5b9d', title: '\u652f\u4ed8\u6210\u529f', summary: '\u4ed8\u6b3e \u00a538.50', rawText: '\u5b8c\u6574\u901a\u77e5\u6b63\u6587' })).toBeNull();
  });
});
