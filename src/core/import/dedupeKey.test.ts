import { buildDedupeKey, normalizeProvider, sha256Hex } from './dedupeKey';

test('implements standard SHA-256 for UTF-8 input', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('normalizes amount to cents, time to minutes, and payment providers', () => {
  const first = buildDedupeKey({ provider: '微信支付', type: 'expense', amount: 12.3, occurredAt: '2026-10-16T08:30:02.000Z' });
  const second = buildDedupeKey({ provider: '微信', type: 'expense', amount: 12.30, occurredAt: '2026-10-16T08:30:59.000Z' });

  expect(first).toBe(second);
  expect(first).toBe('274b483c82add421b9e8ce6d8380fe33a6280c4a15127c456993e04276d45682');
  expect(normalizeProvider('Alipay')).toBe('支付宝');
});

test('keeps different calendar minutes and provider names distinct', () => {
  const beforeMidnight = buildDedupeKey({ provider: '支付宝', type: 'expense', amount: 1, occurredAt: '2026-10-19T23:59:00+08:00' });
  const afterMidnight = buildDedupeKey({ provider: '支付宝', type: 'expense', amount: 1, occurredAt: '2026-10-20T00:00:00+08:00' });
  const otherProvider = buildDedupeKey({ provider: '微信', type: 'expense', amount: 1, occurredAt: '2026-10-19T23:59:00+08:00' });

  expect(beforeMidnight).not.toBe(afterMidnight);
  expect(beforeMidnight).not.toBe(otherProvider);
});