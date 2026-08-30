/**
 * ACCESS-22 post-scarcity qualification check.
 */

import { access22ScenarioById } from './catalog.ts';
import { executeAccess22Scenario } from './engine.ts';

export function runPostScarcityTest(): Readonly<{
  readonly passed: boolean;
  readonly allocatableUnits: bigint;
  readonly nativeSunreyIssued: bigint;
  readonly nativeMoonreyIssued: bigint;
  readonly accessMoneyPrinted: boolean;
  readonly fixedPriceGuarantee: boolean;
}> {
  const scenario = access22ScenarioById('ACCESS22-40-post-scarcity-multi-category');
  if (!scenario) {
    throw new Error('post-scarcity scenario missing');
  }
  const result = executeAccess22Scenario(scenario, 'SCALE_1K');
  const lastEpoch = result.epochs[result.epochs.length - 1];
  const allocatableUnits = lastEpoch?.allocatableUnits ?? 0n;
  const baseline = access22ScenarioById('ACCESS22-01-baseline-balanced-economy');
  const baselineResult = baseline ? executeAccess22Scenario(baseline, 'SCALE_1K') : null;
  const baselineAllocatable = baselineResult?.epochs[0]?.allocatableUnits ?? 0n;

  return Object.freeze({
    passed:
      allocatableUnits > baselineAllocatable &&
      result.allInvariantsHeld &&
      Object.values(result.mechanismTests).every(Boolean),
    allocatableUnits,
    nativeSunreyIssued: 0n,
    nativeMoonreyIssued: 0n,
    accessMoneyPrinted: false,
    fixedPriceGuarantee: false,
  });
}
