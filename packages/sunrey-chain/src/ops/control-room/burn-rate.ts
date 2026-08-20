import { SLO_LABEL } from '../types.ts';
import type { BurnRateCategory, ErrorBudget } from './types.ts';

const BPS_DENOMINATOR = 10_000n;
const FAST_BURN_BPS = 100_000n;
const SLOW_BURN_BPS = 20_000n;

export function evaluateErrorBudget(input: {
  readonly sloId: string;
  readonly windowMs: bigint;
  readonly elapsedMs: bigint;
  readonly allowedFailures: bigint;
  readonly observedFailures: bigint;
}): ErrorBudget {
  if (input.windowMs <= 0n || input.elapsedMs <= 0n) {
    throw new Error('error budget windows must be positive integers');
  }
  if (input.allowedFailures < 0n || input.observedFailures < 0n) {
    throw new Error('error budget counts must be non-negative integers');
  }

  const remainingFailures = input.allowedFailures - input.observedFailures;
  const remainingBudgetBps =
    input.allowedFailures === 0n
      ? 0n
      : (remainingFailures * BPS_DENOMINATOR) / input.allowedFailures;
  const consumedBudgetBps =
    input.allowedFailures === 0n
      ? BPS_DENOMINATOR
      : (input.observedFailures * BPS_DENOMINATOR) / input.allowedFailures;
  const burnRateBps =
    input.allowedFailures === 0n
      ? 0n
      : (input.observedFailures * input.windowMs * BPS_DENOMINATOR) / (input.allowedFailures * input.elapsedMs);

  return Object.freeze({
    sloId: input.sloId,
    label: SLO_LABEL,
    windowMs: input.windowMs,
    elapsedMs: input.elapsedMs,
    allowedFailures: input.allowedFailures,
    observedFailures: input.observedFailures,
    remainingFailures,
    remainingBudgetBps,
    consumedBudgetBps,
    burnRateBps,
    burnCategory: classifyBurn(remainingFailures, burnRateBps),
  });
}

export function classifyBurn(remainingFailures: bigint, burnRateBps: bigint): BurnRateCategory {
  if (remainingFailures <= 0n) {
    return 'EXHAUSTED';
  }
  if (burnRateBps >= FAST_BURN_BPS) {
    return 'FAST';
  }
  if (burnRateBps >= SLOW_BURN_BPS) {
    return 'SLOW';
  }
  return 'NORMAL';
}
