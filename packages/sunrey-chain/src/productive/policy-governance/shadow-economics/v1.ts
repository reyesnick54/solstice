/**
 * Legacy V1 evaluation for shadow comparison.
 *
 * LEGACY_ENGINEERING_SIMULATION_V1 remains available. It is not
 * production economics. Capacity and reserve claims are deliberately
 * not valued.
 */

import { evaluateIssuanceFormula } from '../../formula.ts';
import { developmentIssuancePolicy } from '../../policy.ts';
import { WEIGHT_SCALE } from '../../types.ts';
import { LEGACY_ENGINEERING_SIMULATION_V1 } from './identities.ts';
import type { MoonReyShadowScenario, PathValuation, ShadowReasonCode } from './types.ts';

export type V1Evaluation = PathValuation & {
  readonly path: typeof LEGACY_ENGINEERING_SIMULATION_V1;
  readonly policyVersion: number;
  readonly capApplied: boolean;
  readonly uncappedQuantity: bigint | null;
};

export function evaluateLegacyV1(scenario: MoonReyShadowScenario): V1Evaluation {
  const policy = developmentIssuancePolicy();
  const claimWeight = policy.claimTypeWeight[scenario.claimType];
  if (claimWeight === 0n || scenario.claimType === 'CAPACITY' || scenario.claimType === 'RESERVE') {
    return Object.freeze({
      path: LEGACY_ENGINEERING_SIMULATION_V1,
      valued: false,
      quantity: null,
      uncappedQuantity: null,
      policyVersion: scenario.v1PolicyVersion,
      capApplied: false,
      reasonCodes: Object.freeze(['V1_CLAIM_NOT_VALUED'] as const satisfies readonly ShadowReasonCode[]),
    });
  }
  const result = evaluateIssuanceFormula({
    eligibleQuantity: scenario.canonicalQuantity,
    categoryWeight: policy.categoryWeight[scenario.category],
    claimTypeWeight: claimWeight,
    qualityFactor: scenario.evidence.quality ?? WEIGHT_SCALE,
    roundingMode: policy.roundingMode,
    maximumIssuance: scenario.v1MaximumIssuance,
  });
  const capApplied = result.uncappedQuantity > result.moonreyQuantity;
  const reasonCodes: ShadowReasonCode[] = ['V1_VALUED'];
  if (capApplied) {
    reasonCodes.push('V1_CAP_APPLIED');
  }
  return Object.freeze({
    path: LEGACY_ENGINEERING_SIMULATION_V1,
    valued: true,
    quantity: result.moonreyQuantity,
    uncappedQuantity: result.uncappedQuantity,
    policyVersion: scenario.v1PolicyVersion,
    capApplied,
    reasonCodes: Object.freeze(reasonCodes),
  });
}
