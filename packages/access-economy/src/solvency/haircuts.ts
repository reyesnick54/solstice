/**
 * ACCESS-16 — Risk haircut policy (simulation only).
 *
 * EffectiveAllocatableExternalCapacity = FundedCapacity * RiskHaircut
 *
 * No arbitrary production defaults. Policies must be explicitly configured.
 */

import type { EffectiveCapacityInput, EffectiveCapacityResult, RiskHaircutPolicy } from './types.ts';
import type { RiskHaircutKind } from './taxonomy.ts';

export function applyRiskHaircuts(input: EffectiveCapacityInput): EffectiveCapacityResult {
  const applied: { kind: RiskHaircutKind; haircutBps: bigint }[] = [];
  let remaining = input.fundedCapacityMinorUnits;

  for (const policy of input.haircuts) {
    if (!policy.simulationOnly) {
      continue;
    }
    const factor = 10_000n - policy.haircutBps;
    remaining = (remaining * factor) / 10_000n;
    applied.push(Object.freeze({ kind: policy.kind, haircutBps: policy.haircutBps }));
  }

  return Object.freeze({
    grossCapacityMinorUnits: input.fundedCapacityMinorUnits,
    effectiveAllocatableMinorUnits: remaining,
    appliedHaircuts: Object.freeze(applied),
  });
}

export function simulationHaircutPolicy(
  kind: RiskHaircutKind,
  haircutBps: bigint,
  policyVersion: string,
): RiskHaircutPolicy {
  return Object.freeze({
    policyVersion,
    kind,
    haircutBps,
    simulationOnly: true as const,
  });
}
