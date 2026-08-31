/**
 * Read-only Health Agent evidence exposure.
 * Agent must not infer user health conditions from reference data.
 */

import type { HealthResearchContext } from './types.ts';

export const HEALTH_OBSERVATION_EVIDENCE_KIND = 'health.observation.reference' as const;

export type HealthAgentEvidenceRef = {
  readonly kind: typeof HEALTH_OBSERVATION_EVIDENCE_KIND;
  readonly hasFoodReference: boolean;
  readonly hasTrialReference: boolean;
  readonly hasPublicHealthReference: boolean;
  readonly retrievedAt: string;
  readonly grantsExecutionAuthority: false;
  readonly grantsDiagnosis: false;
  readonly inferHealthCondition: false;
  readonly referenceOnly: true;
};

export function toHealthAgentEvidence(context: HealthResearchContext): HealthAgentEvidenceRef {
  return Object.freeze({
    kind: HEALTH_OBSERVATION_EVIDENCE_KIND,
    hasFoodReference: context.foods.length > 0,
    hasTrialReference: context.trials.length > 0,
    hasPublicHealthReference: context.publicHealth.length > 0,
    retrievedAt: context.retrievedAt,
    grantsExecutionAuthority: false,
    grantsDiagnosis: false,
    inferHealthCondition: false,
    referenceOnly: true,
  });
}
