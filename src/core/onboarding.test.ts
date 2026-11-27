import { validateOnboardingBalances } from './onboarding';

describe('validateOnboardingBalances', () => {
  it('全空 → 全部按 0 通过', () => {
    const result = validateOnboardingBalances([
      { name: '微信', amountText: '' },
      { name: '支付宝', amountText: '' },
      { name: '银行卡', amountText: '' },
    ]);
    expect(result.error).toBe('');
    expect(result.balances).toEqual([
      { name: '微信', initialBalanceCents: 0 },
      { name: '支付宝', initialBalanceCents: 0 },
      { name: '银行卡', initialBalanceCents: 0 },
    ]);
  });

  it('整数与小数转分正确', () => {
    const result = validateOnboardingBalances([
      { name: '微信', amountText: '8500' },
      { name: '支付宝', amountText: '12.5' },
      { name: '银行卡', amountText: '0.01' },
    ]);
    expect(result.error).toBe('');
    expect(result.balances).toEqual([
      { name: '微信', initialBalanceCents: 850000 },
      { name: '支付宝', initialBalanceCents: 1250 },
      { name: '银行卡', initialBalanceCents: 1 },
    ]);
  });

  it('非法文本报首个错误并中止', () => {
    const result = validateOnboardingBalances([
      { name: '微信', amountText: 'abc' },
      { name: '支付宝', amountText: '-5' },
    ]);
    expect(result.error).toContain('微信');
  });

  it('三位小数拒绝', () => {
    const result = validateOnboardingBalances([{ name: '微信', amountText: '1.234' }]);
    expect(result.error).toContain('微信');
  });
});
