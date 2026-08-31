/**
 * ACCESS-14 — Access Coverage Policy.
 *
 * Versioned, deterministic, explainable economic coverage rules.
 * Coverage is internal settlement economics — not withdrawable cash.
 */

import type { CanonicalCapacityUnit } from './types.ts';

export type CoveragePolicyVersion = `v${number}`;

export type CoveragePolicyContext = {
  readonly entitlementClass: string;
  readonly category: string;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly quantity: bigint;
  readonly geographicZone: string | null;
  readonly serviceLevel: string;
  readonly providerPriceMinorUnits: bigint;
  readonly jurisdiction: string;
  readonly benefitSource: string;
};

export type CoverageDecisionLine = {
  readonly code: string;
  readonly message: string;
  readonly amountMinorUnits: bigint;
};

export type CoverageDecision = {
  readonly policyVersion: CoveragePolicyVersion;
  readonly maxCoverageMinorUnits: bigint;
  readonly appliedCoverageMinorUnits: bigint;
  readonly entitlementUnitsConsumed: bigint;
  readonly explanation: readonly CoverageDecisionLine[];
};

export type AccessCoveragePolicy = {
  readonly policyId: string;
  readonly version: CoveragePolicyVersion;
  readonly evaluate: (context: CoveragePolicyContext) => CoverageDecision;
};

const MOBILITY_STANDARD_POLICY: AccessCoveragePolicy = Object.freeze({
  policyId: 'MOBILITY_STANDARD',
  version: 'v1',
  evaluate(context: CoveragePolicyContext): CoverageDecision {
    const perUnitCap = 11_000n;
    const maxCoverage = perUnitCap * context.quantity;
    const applied = context.providerPriceMinorUnits < maxCoverage ? context.providerPriceMinorUnits : maxCoverage;
    return Object.freeze({
      policyVersion: 'v1',
      maxCoverageMinorUnits: maxCoverage,
      appliedCoverageMinorUnits: applied,
      entitlementUnitsConsumed: context.quantity,
      explanation: Object.freeze([
        Object.freeze({
          code: 'MOBILITY_STANDARD_PER_UNIT_CAP',
          message: 'MOBILITY_STANDARD allows up to 110 USD equivalent per qualifying vehicle-day',
          amountMinorUnits: perUnitCap,
        }),
        Object.freeze({
          code: 'COVERAGE_APPLIED',
          message: 'coverage is settlement economics only; entitlement is not withdrawable cash',
          amountMinorUnits: applied,
        }),
      ]),
    });
  },
});

const STAY_STANDARD_POLICY: AccessCoveragePolicy = Object.freeze({
  policyId: 'STAY_STANDARD',
  version: 'v1',
  evaluate(context: CoveragePolicyContext): CoverageDecision {
    const perUnitCap = 18_000n;
    const maxCoverage = perUnitCap * context.quantity;
    const applied = context.providerPriceMinorUnits < maxCoverage ? context.providerPriceMinorUnits : maxCoverage;
    return Object.freeze({
      policyVersion: 'v1',
      maxCoverageMinorUnits: maxCoverage,
      appliedCoverageMinorUnits: applied,
      entitlementUnitsConsumed: context.quantity,
      explanation: Object.freeze([
        Object.freeze({
          code: 'STAY_STANDARD_PER_NIGHT_CAP',
          message: 'STAY_STANDARD allows up to 180 USD equivalent per qualifying room-night',
          amountMinorUnits: perUnitCap,
        }),
        Object.freeze({
          code: 'COVERAGE_APPLIED',
          message: 'coverage is settlement economics only; entitlement is not withdrawable cash',
          amountMinorUnits: applied,
        }),
      ]),
    });
  },
});

const FOOD_STANDARD_POLICY: AccessCoveragePolicy = Object.freeze({
  policyId: 'FOOD_STANDARD',
  version: 'v1',
  evaluate(context: CoveragePolicyContext): CoverageDecision {
    const perUnitCap = 2_800n;
    const maxCoverage = perUnitCap * context.quantity;
    const applied = context.providerPriceMinorUnits < maxCoverage ? context.providerPriceMinorUnits : maxCoverage;
    return Object.freeze({
      policyVersion: 'v1',
      maxCoverageMinorUnits: maxCoverage,
      appliedCoverageMinorUnits: applied,
      entitlementUnitsConsumed: context.quantity,
      explanation: Object.freeze([
        Object.freeze({
          code: 'FOOD_STANDARD_PER_MEAL_CAP',
          message: 'FOOD_STANDARD allows up to 28 USD equivalent per qualifying meal',
          amountMinorUnits: perUnitCap,
        }),
      ]),
    });
  },
});

const GOODS_STANDARD_POLICY: AccessCoveragePolicy = Object.freeze({
  policyId: 'GOODS_STANDARD',
  version: 'v1',
  evaluate(context: CoveragePolicyContext): CoverageDecision {
    const perUnitCap = 4_000n;
    const maxCoverage = perUnitCap * context.quantity;
    const applied = context.providerPriceMinorUnits < maxCoverage ? context.providerPriceMinorUnits : maxCoverage;
    return Object.freeze({
      policyVersion: 'v1',
      maxCoverageMinorUnits: maxCoverage,
      appliedCoverageMinorUnits: applied,
      entitlementUnitsConsumed: context.quantity,
      explanation: Object.freeze([
        Object.freeze({
          code: 'GOODS_STANDARD_PER_ITEM_CAP',
          message: 'GOODS_STANDARD allows up to 40 USD equivalent per qualifying delivery item',
          amountMinorUnits: perUnitCap,
        }),
      ]),
    });
  },
});

const MOBILITY_WAVE3_POLICY: AccessCoveragePolicy = Object.freeze({
  policyId: 'MOBILITY_WAVE3',
  version: 'v1',
  evaluate(context: CoveragePolicyContext): CoverageDecision {
    const perUnitCap = 300_00n;
    const maxCoverage = perUnitCap * context.quantity;
    const applied = context.providerPriceMinorUnits < maxCoverage ? context.providerPriceMinorUnits : maxCoverage;
    return Object.freeze({
      policyVersion: 'v1',
      maxCoverageMinorUnits: maxCoverage,
      appliedCoverageMinorUnits: applied,
      entitlementUnitsConsumed: context.quantity,
      explanation: Object.freeze([
        Object.freeze({
          code: 'MOBILITY_WAVE3_PER_UNIT_CAP',
          message: 'MOBILITY_WAVE3 allows up to 300 USD equivalent per qualifying vehicle-day',
          amountMinorUnits: perUnitCap,
        }),
      ]),
    });
  },
});

const POLICY_REGISTRY: Readonly<Record<string, AccessCoveragePolicy>> = Object.freeze({
  MOBILITY_STANDARD: MOBILITY_STANDARD_POLICY,
  MOBILITY_WAVE3: MOBILITY_WAVE3_POLICY,
  STAY_STANDARD: STAY_STANDARD_POLICY,
  FOOD_STANDARD: FOOD_STANDARD_POLICY,
  GOODS_STANDARD: GOODS_STANDARD_POLICY,
});

export function resolveCoveragePolicy(entitlementClass: string): AccessCoveragePolicy | null {
  return POLICY_REGISTRY[entitlementClass] ?? null;
}

export function listCoveragePolicies(): readonly AccessCoveragePolicy[] {
  return Object.freeze(Object.values(POLICY_REGISTRY));
}
