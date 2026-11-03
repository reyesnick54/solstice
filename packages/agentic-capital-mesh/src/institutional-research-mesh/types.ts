import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';

export const INSTITUTIONAL_RESEARCH_ROLES = [
  'FUNDAMENTAL_RESEARCH',
  'EARNINGS_RESEARCH',
  'TECHNICAL_RESEARCH',
  'MACRO_RESEARCH',
  'NEWS_RESEARCH',
  'SENTIMENT_RESEARCH',
  'OPTIONS_RESEARCH',
  'FLOW_RESEARCH',
  'CRYPTO_ONCHAIN_RESEARCH',
  'BULL_RESEARCH',
  'BEAR_RESEARCH',
  'RISK_RESEARCH',
  'EXECUTION_RESEARCH',
  'RESEARCH_SYNTHESIS',
] as const;

export type InstitutionalResearchRole = (typeof INSTITUTIONAL_RESEARCH_ROLES)[number];

export const RESEARCH_RECOMMENDATION_CLASSES = [
  'RESEARCH_SUPPORTS',
  'RESEARCH_OPPOSES',
  'INCONCLUSIVE',
  'NEEDS_MORE_INFORMATION',
] as const;

export type ResearchRecommendationClass = (typeof RESEARCH_RECOMMENDATION_CLASSES)[number];

export const RESEARCH_TIME_HORIZONS = [
  'INTRADAY',
  'DAYS_1_5',
  'WEEKS_1_4',
  'MONTHS_1_3',
  'MONTHS_3_12',
  'MULTI_YEAR',
] as const;

export type ResearchTimeHorizon = (typeof RESEARCH_TIME_HORIZONS)[number];

export const INSTITUTIONAL_MESH_PHASES = [
  'ANALYST_COVERAGE',
  'ADVOCACY_DEBATE',
  'RISK_REVIEW',
  'EXECUTION_RESEARCH',
  'SYNTHESIS',
] as const;

export type InstitutionalMeshPhase = (typeof INSTITUTIONAL_MESH_PHASES)[number];

export type ResearchSourceRef = {
  readonly sourceRef: string;
  readonly evidenceId?: string;
  readonly sourceKind: EvidenceReference['sourceKind'] | 'HELIOS_OBSERVATION' | 'MESH_TOOL_READ';
  readonly informationTime: UtcInstant;
};

export type StructuredResearchArtifact = {
  readonly artifactId: string;
  readonly role: InstitutionalResearchRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly timeHorizon: ResearchTimeHorizon;
  readonly applicableInstruments: readonly string[];
  readonly applicableRegimes: readonly string[];
  readonly sourceRefs: readonly ResearchSourceRef[];
  readonly informationTime: UtcInstant;
  readonly knownLimitations: readonly string[];
  readonly recommendationClass: ResearchRecommendationClass;
  readonly toolsUsed: readonly string[];
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type InstitutionalResearchRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly instrumentHints?: readonly string[];
  readonly regimeHints?: readonly string[];
  readonly roles?: readonly InstitutionalResearchRole[];
};

export type InstitutionalResearchMeshRun = {
  readonly runId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly phases: readonly InstitutionalMeshPhase[];
  readonly artifacts: readonly StructuredResearchArtifact[];
  readonly synthesisArtifactId: string | null;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type InstitutionalResearchMeshFailure = {
  readonly code: 'VALIDATION_FAILED' | 'SUBJECT_MISMATCH' | 'DATA_ACCESS_REFUSED';
  readonly message: string;
};
