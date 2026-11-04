import type { UtcInstant } from '@solstice/domain';
import type { PointInTimeDatasetManifest } from '../feature-fabric/compiler/manifest.ts';
import type { CoverageManifest } from '../feature-fabric/feature-coverage/types.ts';
import type { CoverageBiasAssessment } from '../feature-fabric/aaf06/coverage-bias-types.ts';

export const ADAPTIVE_ALPHA_V2_SCHEMA = 'sunrey.helios.adaptive-alpha-v2.v2.6' as const;

export const ADAPTIVE_ALPHA_MANDATORY_GATES = Object.freeze([
  'POINT_IN_TIME_INTEGRITY',
  'ENTITY_RESOLUTION_INTEGRITY',
  'REVISION_INTEGRITY',
  'FEATURE_LINEAGE_INTEGRITY',
  'COVERAGE_INTEGRITY',
  'MISSINGNESS_INTEGRITY',
  'BIAS_INTEGRITY',
  'ENTITLEMENT_INTEGRITY',
  'REPRODUCIBILITY',
] as const);

export type AdaptiveAlphaMandatoryGate = (typeof ADAPTIVE_ALPHA_MANDATORY_GATES)[number];

export type AdaptiveAlphaGateStatus = 'PASS' | 'WARNING' | 'FAIL';

export type AdaptiveAlphaGateVerdict = {
  readonly gate: AdaptiveAlphaMandatoryGate;
  readonly status: AdaptiveAlphaGateStatus;
  readonly detail: string;
};

export type AdaptiveAlphaFailure = {
  readonly code: string;
  readonly message: string;
  readonly gate: AdaptiveAlphaMandatoryGate;
  readonly severity: 'BLOCKING' | 'WARNING';
};

export type AdaptiveAlphaValueOfInformationSummary = {
  readonly coverageRatioBps: number | null;
  readonly missingnessRateBps: number | null;
  readonly biasSeverity: CoverageBiasAssessment['severity'] | null;
  readonly uncertaintyNotes: readonly string[];
  readonly counterfactualManifestReady: boolean;
};

export type AdaptiveAlphaDatasetCertification = {
  readonly schema: typeof ADAPTIVE_ALPHA_V2_SCHEMA;
  readonly certificationId: string;
  readonly contentHash: string;
  readonly pitManifest: PointInTimeDatasetManifest;
  readonly coverageManifest: CoverageManifest | null;
  readonly biasAssessment: CoverageBiasAssessment | null;
  readonly certifiedAt: UtcInstant;
  readonly gateVerdicts: readonly AdaptiveAlphaGateVerdict[];
  readonly certified: boolean;
  readonly voiSummary: AdaptiveAlphaValueOfInformationSummary;
  readonly grantsExecutionAuthority: false;
};

export type AdaptiveAlphaEvidenceBundle = {
  readonly schema: typeof ADAPTIVE_ALPHA_V2_SCHEMA;
  readonly bundleId: string;
  readonly certification: AdaptiveAlphaDatasetCertification;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly evidenceVaultRefs: readonly string[];
  readonly sealedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type AdaptiveAlphaQualification = {
  readonly schema: typeof ADAPTIVE_ALPHA_V2_SCHEMA;
  readonly qualificationId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly certification: AdaptiveAlphaDatasetCertification;
  readonly evidenceBundle: AdaptiveAlphaEvidenceBundle;
  readonly qualified: boolean;
  readonly promotionPermitted: boolean;
  readonly failures: readonly AdaptiveAlphaFailure[];
  readonly grantsExecutionAuthority: false;
};

export type AdaptiveAlphaQualificationPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly policyHash: string;
  readonly mandatoryGates: readonly AdaptiveAlphaMandatoryGate[];
  readonly allowWarningWithControlledReview: boolean;
  readonly agentWaiveForbidden: true;
  readonly grantsExecutionAuthority: false;
};

export type AdaptiveAlphaControlledWarningReview = {
  readonly reviewId: string;
  readonly reviewerRef: string;
  readonly reason: string;
  readonly reviewedAt: UtcInstant;
  readonly warningGate: AdaptiveAlphaMandatoryGate;
  readonly policyVersion: string;
  readonly evidenceVaultRef: string;
};
