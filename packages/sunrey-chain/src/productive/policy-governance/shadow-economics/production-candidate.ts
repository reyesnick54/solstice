/**
 * Shadow inspection of production-candidate policy structure.
 *
 * The candidate is never treated as an active value path.
 */

import {
  rehearsalProductiveValuePolicyCandidate,
  unconfiguredProductiveValuePolicyCandidate,
  validateProductiveValuePolicyCandidate,
  type MoonReyProductiveValuePolicyCandidate,
} from '../value-function/production-candidate/index.ts';
import {
  rehearsalConversionPolicy,
  unconfiguredProductionConversionPolicy,
  type MoonReyProductionSettlementConversionPolicyCandidate,
} from '../value-settlement/production-candidate/index.ts';
import { PRODUCTION_CANDIDATE_UNACTIVATED } from './identities.ts';

export type ProductionCandidateShadowInspection = {
  readonly path: typeof PRODUCTION_CANDIDATE_UNACTIVATED;
  readonly v1Inspected: true;
  readonly v2Inspected: true;
  readonly candidateStructureValid: boolean;
  readonly candidateActive: false;
  readonly productionActivated: false;
  readonly gpuvValuesSelected: false;
  readonly conversionSelected: false;
  readonly policyId: string;
  readonly conversionPolicyId: string;
};

export function inspectProductionCandidatePolicy(
  policy: MoonReyProductiveValuePolicyCandidate = unconfiguredProductiveValuePolicyCandidate(),
  conversion: MoonReyProductionSettlementConversionPolicyCandidate = unconfiguredProductionConversionPolicy(),
): ProductionCandidateShadowInspection {
  const validated = validateProductiveValuePolicyCandidate(policy);
  return Object.freeze({
    path: PRODUCTION_CANDIDATE_UNACTIVATED,
    v1Inspected: true,
    v2Inspected: true,
    candidateStructureValid: validated.ok && !policy.productionActivated && !conversion.productionActivated,
    candidateActive: false,
    productionActivated: false,
    gpuvValuesSelected: false,
    conversionSelected: false,
    policyId: policy.policyId,
    conversionPolicyId: conversion.policyId,
  });
}

export function inspectRehearsalProductionCandidate(): ProductionCandidateShadowInspection {
  return inspectProductionCandidatePolicy(
    rehearsalProductiveValuePolicyCandidate(),
    rehearsalConversionPolicy(),
  );
}
