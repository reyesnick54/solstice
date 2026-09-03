// @ts-nocheck
import type { AllocationMechanism, AccessRegimeHint, ScarcityBand } from '../taxonomy.ts';
import type { MechanismSelectionPolicy } from '../scarcity/types.ts';

export const DEFAULT_MECHANISM_POLICY: MechanismSelectionPolicy = Object.freeze({
  policyVersion: 'sunrey.access.allocation.v1',
  regimeHint: 'ABUNDANT_DISCRETIONARY',
  abundantMechanism: 'FIXED_ACCESS_RATE',
  essentialMechanism: 'ENTITLEMENT',
  scarceMechanisms: Object.freeze(['QUEUE', 'LOTTERY', 'AUCTION', 'MARKET', 'RFQ', 'PRIORITY_POLICY']),
  denyWhenUnavailable: true,
  quoteTtlMs: 300_000,
  capacityMaxAgeMs: 600_000,
  lotterySeedNamespace: 'sunrey.access.lottery.v1',
  fixedAccessRatePerHour: 1_000n,
  queueFairOrdering: true,
  allowFinancialPurchase: false,
});

export function selectMechanism(
  policy: MechanismSelectionPolicy,
  scarcityBand: ScarcityBand,
  regimeHint: AccessRegimeHint,
  configuredMechanism?: AllocationMechanism,
): AllocationMechanism {
  if (configuredMechanism) {
    return configuredMechanism;
  }
  if (regimeHint === 'ESSENTIAL') {
    return policy.essentialMechanism;
  }
  if (regimeHint === 'SCARCE_PREMIUM') {
    return policy.scarceMechanisms[0] ?? 'QUEUE';
  }
  if (scarcityBand === 'UNAVAILABLE') {
    return policy.essentialMechanism;
  }
  if (regimeHint === 'ABUNDANT_DISCRETIONARY' || scarcityBand === 'ABUNDANT') {
    return policy.abundantMechanism;
  }
  switch (scarcityBand) {
    case 'BALANCED':
      return policy.abundantMechanism;
    case 'CONSTRAINED':
      return policy.scarceMechanisms.find((m) => m === 'QUEUE') ?? policy.scarceMechanisms[0] ?? 'QUEUE';
    case 'CRITICAL':
      return policy.scarceMechanisms.find((m) => m === 'LOTTERY') ?? policy.scarceMechanisms[0] ?? 'LOTTERY';
    default:
      return policy.abundantMechanism;
  }
}

export function regimeHintFromPolicy(policy: MechanismSelectionPolicy): AccessRegimeHint {
  switch (policy.regimeHint) {
    case 'ESSENTIAL':
    case 'SCARCE_PREMIUM':
      return policy.regimeHint;
    default:
      return 'ABUNDANT_DISCRETIONARY';
  }
}
