/**
 * Wave 6 — versioned contribution-specific valuation methodology interfaces.
 *
 * Production formulas are not approved. Each interface defines the schema
 * for a governed methodology without inventing economic weights.
 */

import type { ContributionClass } from '../taxonomy.ts';
import {
  asValuationPolicyVersion,
  valuationMethodologyIdFor,
  type ValuationMethodologyId,
  type ValuationPolicyVersion,
} from '../valuation/ids.ts';

const SIMULATION_METHODOLOGY_VERSION = asValuationPolicyVersion('1');

export const METHODOLOGY_APPROVAL_STATUSES = [
  'SIMULATION_ONLY',
  'PRODUCTION_CANDIDATE',
  'RESEARCH_REQUIRED',
  'NOT_APPROVED',
] as const;
export type MethodologyApprovalStatus = (typeof METHODOLOGY_APPROVAL_STATUSES)[number];

export const CONTRIBUTION_METHODOLOGY_DOMAINS = [
  'RESEARCH',
  'WORK',
  'EDUCATION',
  'COMPUTATION',
  'AUTHORIZED_DATA_USE',
] as const;
export type ContributionMethodologyDomain = (typeof CONTRIBUTION_METHODOLOGY_DOMAINS)[number];

export type VersionedValuationMethodology = {
  readonly methodologyId: ValuationMethodologyId;
  readonly methodologyVersion: ValuationPolicyVersion;
  readonly domain: ContributionMethodologyDomain;
  readonly contributionClasses: readonly ContributionClass[];
  readonly approvalStatus: MethodologyApprovalStatus;
  readonly productionApproved: false;
  readonly formulaApproved: false;
  readonly permitsAiDirectMonetaryInput: false;
  readonly requiresDeterministicCommitment: true;
  readonly requiresVerifiedContribution: true;
  readonly requiresRightsProof: boolean;
  readonly requiresConsentProof: boolean;
  readonly governanceReference: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly simulationOnly: true;
  /** Inputs requiring later legal/policy review before production activation. */
  readonly policyReviewRequiredInputs: readonly string[];
};

function methodology(
  input: Omit<VersionedValuationMethodology, 'productionApproved' | 'formulaApproved' | 'permitsAiDirectMonetaryInput' | 'requiresDeterministicCommitment' | 'requiresVerifiedContribution' | 'simulationOnly'>,
): VersionedValuationMethodology {
  return Object.freeze({
    ...input,
    productionApproved: false,
    formulaApproved: false,
    permitsAiDirectMonetaryInput: false,
    requiresDeterministicCommitment: true,
    requiresVerifiedContribution: true,
    simulationOnly: true,
  });
}

export const RESEARCH_METHODOLOGY_V1 = methodology({
  methodologyId: valuationMethodologyIdFor('wave6-research-v1'),
  methodologyVersion: SIMULATION_METHODOLOGY_VERSION,
  domain: 'RESEARCH',
  contributionClasses: Object.freeze(['RESEARCH_PARTICIPATION', 'VERIFIED_KNOWLEDGE_CONTRIBUTION']),
  approvalStatus: 'SIMULATION_ONLY',
  requiresRightsProof: false,
  requiresConsentProof: true,
  governanceReference: 'policy.sim.research-valuation.unconfigured',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  policyReviewRequiredInputs: Object.freeze(['informed_consent_scope', 'institutional_review_status']),
});

export const WORK_METHODOLOGY_V1 = methodology({
  methodologyId: valuationMethodologyIdFor('wave6-work-v1'),
  methodologyVersion: SIMULATION_METHODOLOGY_VERSION,
  domain: 'WORK',
  contributionClasses: Object.freeze([
    'PROFESSIONAL_EXPERTISE',
    'HUMAN_SERVICE_DELIVERY',
    'ENTREPRENEURIAL_ACTIVITY',
    'ECONOMIC_PARTICIPATION',
  ]),
  approvalStatus: 'SIMULATION_ONLY',
  requiresRightsProof: false,
  requiresConsentProof: false,
  governanceReference: 'policy.sim.work-valuation.unconfigured',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  policyReviewRequiredInputs: Object.freeze(['contractual_term_interpretation', 'jurisdiction_labor_rules']),
});

export const EDUCATION_METHODOLOGY_V1 = methodology({
  methodologyId: valuationMethodologyIdFor('wave6-education-v1'),
  methodologyVersion: SIMULATION_METHODOLOGY_VERSION,
  domain: 'EDUCATION',
  contributionClasses: Object.freeze(['EDUCATION_SKILL_ATTESTATION']),
  approvalStatus: 'SIMULATION_ONLY',
  requiresRightsProof: false,
  requiresConsentProof: false,
  governanceReference: 'policy.sim.education-valuation.unconfigured',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  policyReviewRequiredInputs: Object.freeze(['credential_verification_standard', 'skill_taxonomy_mapping']),
});

export const COMPUTATION_METHODOLOGY_V1 = methodology({
  methodologyId: valuationMethodologyIdFor('wave6-computation-v1'),
  methodologyVersion: SIMULATION_METHODOLOGY_VERSION,
  domain: 'COMPUTATION',
  contributionClasses: Object.freeze(['MODEL_TRAINING_PARTICIPATION', 'ECONOMIC_PARTICIPATION']),
  approvalStatus: 'SIMULATION_ONLY',
  requiresRightsProof: true,
  requiresConsentProof: true,
  governanceReference: 'policy.sim.computation-valuation.unconfigured',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  policyReviewRequiredInputs: Object.freeze(['compute_metering_standard', 'model_training_consent_scope']),
});

export const AUTHORIZED_DATA_USE_METHODOLOGY_V1 = methodology({
  methodologyId: valuationMethodologyIdFor('wave6-authorized-data-use-v1'),
  methodologyVersion: SIMULATION_METHODOLOGY_VERSION,
  domain: 'AUTHORIZED_DATA_USE',
  contributionClasses: Object.freeze(['INFORMATION_RIGHT_CONTRIBUTION', 'VERIFIED_KNOWLEDGE_CONTRIBUTION']),
  approvalStatus: 'SIMULATION_ONLY',
  requiresRightsProof: true,
  requiresConsentProof: true,
  governanceReference: 'policy.sim.data-use-valuation.unconfigured',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  policyReviewRequiredInputs: Object.freeze(['information_rights_scope', 'usage_receipt_binding', 'privacy_regime']),
});

export const WAVE6_SIMULATION_METHODOLOGIES: readonly VersionedValuationMethodology[] = Object.freeze([
  RESEARCH_METHODOLOGY_V1,
  WORK_METHODOLOGY_V1,
  EDUCATION_METHODOLOGY_V1,
  COMPUTATION_METHODOLOGY_V1,
  AUTHORIZED_DATA_USE_METHODOLOGY_V1,
]);

export function resolveMethodology(
  methodologyId: ValuationMethodologyId,
  methodologyVersion: ValuationPolicyVersion,
): VersionedValuationMethodology | null {
  return (
    WAVE6_SIMULATION_METHODOLOGIES.find(
      (item) => item.methodologyId === methodologyId && item.methodologyVersion === methodologyVersion,
    ) ?? null
  );
}

export function methodologySupportsClass(
  methodology: VersionedValuationMethodology,
  contributionClass: ContributionClass,
): boolean {
  return methodology.contributionClasses.includes(contributionClass);
}
