import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';
import type {
  EarningsCommitteePhase,
  EarningsCommitteeRole,
  EarningsTimeHorizon,
} from './taxonomy.ts';

export type EarningsEvidenceRef = EvidenceReference;

export type FrozenEarningsEvidencePack = {
  readonly packId: string;
  readonly contentHash: string;
  readonly frozenAt: UtcInstant;
  readonly evidence: readonly EarningsEvidenceRef[];
};

export type ProbabilityBand = {
  readonly label: string;
  readonly probability: number;
};

export type ProbabilisticEarningsState = {
  readonly stateId: string;
  readonly entityRef: string;
  readonly eventRef: string;
  readonly informationTime: UtcInstant;
  readonly beatProbabilities: readonly ProbabilityBand[];
  readonly guidanceProbabilities: readonly ProbabilityBand[];
  readonly impliedMoveBps: number | null;
  readonly consensusEpsMinor: bigint | null;
  readonly uncertaintyScore: number;
};

export type SpecialistCostProfile = {
  readonly modelCostMicros: bigint;
  readonly dataCostMicros: bigint;
  readonly baselineInformationValue: number;
};

export type H20SpecialistAssignmentInput = {
  readonly role: EarningsCommitteeRole;
  readonly expectedInformationValue: number;
  readonly modelCostMicros: bigint;
  readonly dataCostMicros: bigint;
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
};

export type H20SpecialistAssignmentDecision = {
  readonly role: EarningsCommitteeRole;
  readonly assigned: boolean;
  readonly expectedInformationValue: number;
  readonly modelCostMicros: bigint;
  readonly dataCostMicros: bigint;
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
  readonly reason: string;
};

export type EarningsCaseNarrative = {
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly confidence: number;
};

export type AgentDisagreementMetric = {
  readonly score: number;
  readonly opposingPairs: readonly string[];
  readonly unresolvedTopics: readonly string[];
};

export type AafQualification = {
  readonly pointInTimeFrozen: boolean;
  readonly simulationOnly: true;
  readonly futureLeakRejected: boolean;
  readonly note: string;
};

export type EarningsInvestmentThesis = {
  readonly thesisId: string;
  readonly entity: string;
  readonly event: string;
  readonly timeHorizon: EarningsTimeHorizon;
  readonly baseCase: EarningsCaseNarrative;
  readonly bullCase: EarningsCaseNarrative;
  readonly bearCase: EarningsCaseNarrative;
  readonly beatProbabilities: readonly ProbabilityBand[];
  readonly guidanceProbabilities: readonly ProbabilityBand[];
  readonly keyDrivers: readonly string[];
  readonly keyRisks: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly agentDisagreement: AgentDisagreementMetric;
  readonly dataCoverage: readonly string[];
  readonly AAFQualification: AafQualification;
  readonly evidenceRefs: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly expirationTime: UtcInstant;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type EarningsSpecialistArtifact = {
  readonly artifactId: string;
  readonly role: EarningsCommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly challengesIssued: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly informationTime: UtcInstant;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type EarningsCommitteeRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly event: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EarningsEvidenceRef[];
  readonly timeHorizon?: EarningsTimeHorizon;
  readonly decisionImportance?: number;
  readonly forceAllSpecialists?: boolean;
};

export type EarningsCommitteeRun = {
  readonly runId: string;
  readonly schema: typeof import('./taxonomy.ts').EARNINGS_COMMITTEE_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly event: string;
  readonly phases: readonly EarningsCommitteePhase[];
  readonly frozenEvidencePack: FrozenEarningsEvidencePack;
  readonly probabilisticState: ProbabilisticEarningsState;
  readonly h20Assignments: readonly H20SpecialistAssignmentDecision[];
  readonly artifacts: readonly EarningsSpecialistArtifact[];
  readonly thesis: EarningsInvestmentThesis;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type EarningsCommitteeFailure = {
  readonly code: 'VALIDATION_FAILED' | 'SUBJECT_MISMATCH' | 'DATA_ACCESS_REFUSED' | 'EVIDENCE_MUTATED';
  readonly message: string;
};
