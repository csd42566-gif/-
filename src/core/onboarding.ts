/**
 * 首开引导输入校验（v2）：纯函数，供引导页复用。
 * 三个默认账户（微信/支付宝/银行卡）的初始余额输入。
 */

export interface OnboardingBalanceInput {
  /** 账户名（微信/支付宝/银行卡）。 */
  name: string;
  /** 金额文本（用户输入，如 "8500"、"12.5"）。 */
  amountText: string;
}

export interface OnboardingValidationResult {
  /** 校验通过后的整数分余额（与账户名顺序一致）。 */
  balances: Array<{ name: string; initialBalanceCents: number }>;
  /** 首个错误（中文）；空串 = 通过。 */
  error: string;
}

/** 允许空 = 按 0 处理；非法文本（非数字/负数）报错。 */
export function validateOnboardingBalances(inputs: OnboardingBalanceInput[]): OnboardingValidationResult {
  const balances: Array<{ name: string; initialBalanceCents: number }> = [];
  for (const input of inputs) {
    const text = input.amountText.trim();
    if (text === '') {
      balances.push({ name: input.name, initialBalanceCents: 0 });
      continue;
    }
    const match = /^\d+(\.\d{1,2})?$/.test(text);
    if (!match) {
      return {
        balances,
        error: `「${input.name}」的余额「${text}」不对，只填数字（如 8500 或 12.5）。`,
      };
    }
    const [intPart, fracPart = ''] = text.split('.');
    const cents = Number(intPart) * 100 + Number(fracPart.padEnd(2, '0') || '0');
    balances.push({ name: input.name, initialBalanceCents: cents });
  }
  return { balances, error: '' };
}
