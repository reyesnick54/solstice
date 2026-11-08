import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';
import type {
  ALPHA_EVIDENCE_COMMITTEE_SCHEMA,
  Alpha14CommitteePhase,
  Alpha14CommitteeRole,
} from './taxonomy.ts';
import { ALPHA14_EVIDENCE_QUESTIONS, SKEPTIC_ALPHA14_ATTACK_VECTORS } from './taxonomy.ts';

export type AlphaEvidenceRef = EvidenceReference;

export type FrozenAlphaEvidencePack = {
  readonly packId: string;
  readonly contentHash: string;
  readonly frozenAt: UtcInstant;
  readonly evidence: readonly AlphaEvidenceRef[];
};

export type EvidenceStrengthLabel = 'INSUFFICIENT' | 'WEAK' | 'MODERATE' | 'STRONG';

export type AlphaPerformanceClaimEnvelope = {
  readonly claimId: string;
  readonly strategyRef: string;
  readonly performanceClaimSummary: string;
  readonly observationWindowDays: number;
  readonly independentTrialCount: number;
  readonly benchmarkRelativeClaimed: boolean;
  readonly concentrationFlag: boolean;
  readonly dominantRegimeTag: string | null;
  readonly executionAssumptionRef: string;
  readonly costsModeled: boolean;
  readonly evidenceDurationSufficientClaimed: boolean;
  readonly scalabilityClaimed: boolean;
  readonly decaySignalClaimed: boolean;
};

export type AlphaEvidenceDomainBlock = {
  readonly domain: string;
  readonly status: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  readonly summary: string;
  readonly detailRefs: readonly string[];
};

export type AlphaEvidenceThesis = {
  readonly thesisId: string;
  readonly schema: typeof ALPHA_EVIDENCE_COMMITTEE_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly strategyRef: string;
  readonly supportedClaims: readonly string[];
  readonly unsupportedClaims: readonly string[];
  readonly evidenceStrength: EvidenceStrengthLabel;
  readonly statisticalEvidence: AlphaEvidenceDomainBlock;
  readonly implementationEvidence: AlphaEvidenceDomainBlock;
  readonly regimeEvidence: AlphaEvidenceDomainBlock;
  readonly capacityEvidence: AlphaEvidenceDomainBlock;
  readonly contradictions: readonly string[];
  readonly limitations: readonly string[];
  readonly recommendedNextEvidence: readonly string[];
  readonly questionsAddressed: readonly (typeof ALPHA14_EVIDENCE_QUESTIONS)[number][];
  readonly evidenceRefs: readonly string[];
  readonly rejectsPerformanceUpgrade: boolean;
  readonly simulationOnly: true;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
  readonly activatesCapital: false;
};

export type Alpha14ThesisExtraction = {
  readonly supportedClaims?: readonly string[];
  readonly unsupportedClaims?: readonly string[];
  readonly statisticalEvidence?: AlphaEvidenceDomainBlock;
  readonly implementationEvidence?: AlphaEvidenceDomainBlock;
  readonly regimeEvidence?: AlphaEvidenceDomainBlock;
  readonly capacityEvidence?: AlphaEvidenceDomainBlock;
  readonly contradictions?: readonly string[];
  readonly limitations?: readonly string[];
  readonly recommendedNextEvidence?: readonly string[];
  readonly rejectReasons?: readonly string[];
};

export type Alpha14CommitteeArtifact = {
  readonly artifactId: string;
  readonly role: Alpha14CommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly questionsAddressed: readonly (typeof ALPHA14_EVIDENCE_QUESTIONS)[number][];
  readonly skepticAttacksConsidered: readonly (typeof SKEPTIC_ALPHA14_ATTACK_VECTORS)[number][];
  readonly seeksRejection: boolean;
  readonly confidence: number;
  readonly uncertainty: string;
  readonly informationTime: UtcInstant;
  readonly extraction: Alpha14ThesisExtraction | null;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
  readonly activatesCapital: false;
};

export type Alpha14CommitteeRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly strategyRef: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly AlphaEvidenceRef[];
  readonly performanceClaim: AlphaPerformanceClaimEnvelope;
  readonly roles?: readonly Alpha14CommitteeRole[];
};

export type Alpha14CommitteeRun = {
  readonly runId: string;
  readonly schema: typeof ALPHA_EVIDENCE_COMMITTEE_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly strategyRef: string;
  readonly phases: readonly Alpha14CommitteePhase[];
  readonly frozenEvidencePack: FrozenAlphaEvidencePack;
  readonly performanceClaim: AlphaPerformanceClaimEnvelope;
  readonly artifacts: readonly Alpha14CommitteeArtifact[];
  readonly thesis: AlphaEvidenceThesis;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type Alpha14CommitteeFailure = {
  readonly code:
    | 'SUBJECT_MISMATCH'
    | 'EVIDENCE_MUTATED'
    | 'VALIDATION_FAILED'
    | 'LANGUAGE_GUARD_VIOLATION'
    | 'FORBIDDEN_AGENT_ACTION';
  readonly message: string;
};
