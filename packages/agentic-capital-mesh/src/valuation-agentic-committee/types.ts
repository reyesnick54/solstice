import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';
import type { ValuationCommitteePhase, ValuationCommitteeRole, ValuationTimeHorizon } from './taxonomy.ts';

export type ValuationEvidenceRef = EvidenceReference;

export type CanonicalFinancialFact = {
  readonly factId: string;
  readonly label: string;
  readonly valueMinor: bigint;
  readonly currency: string;
  readonly asOf: UtcInstant;
  readonly sourceRef: string;
};

export type FrozenValuationEvidencePack = {
  readonly packId: string;
  readonly contentHash: string;
  readonly factsHash: string;
  readonly frozenAt: UtcInstant;
  readonly evidence: readonly ValuationEvidenceRef[];
  readonly canonicalFinancialFacts: readonly CanonicalFinancialFact[];
};

export type IntrinsicValueBand = {
  readonly label: string;
  readonly perShareMinor: bigint;
  readonly probability: number;
};

export type MarketImpliedExpectation = {
  readonly metric: string;
  readonly impliedView: string;
  readonly evidenceRef: string;
};

export type ExpectationGap = {
  readonly topic: string;
  readonly intrinsicView: string;
  readonly marketImplied: string;
  readonly gapSummary: string;
  readonly evidenceRefs: readonly string[];
};

export type ValuationAssumptionChallengeState = {
  readonly stateId: string;
  readonly entityRef: string;
  readonly instrumentRef: string;
  readonly informationTime: UtcInstant;
  readonly intrinsicValueDistribution: readonly IntrinsicValueBand[];
  readonly marketPriceMinor: bigint | null;
  readonly impliedGrowthBps: number | null;
  readonly impliedWaccBps: number | null;
  readonly uncertaintyScore: number;
};

export type SpecialistCostProfile = {
  readonly modelCostMicros: bigint;
  readonly dataCostMicros: bigint;
  readonly baselineInformationValue: number;
};

export type H20SpecialistAssignmentDecision = {
  readonly role: ValuationCommitteeRole;
  readonly assigned: boolean;
  readonly expectedInformationValue: number;
  readonly modelCostMicros: bigint;
  readonly dataCostMicros: bigint;
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
  readonly reason: string;
};

export type ValuationCaseNarrative = {
  readonly summary: string;
  readonly perShareMinor: bigint | null;
  readonly keyPoints: readonly string[];
  readonly confidence: number;
};

export type AafQualification = {
  readonly pointInTimeFrozen: boolean;
  readonly simulationOnly: true;
  readonly futureLeakRejected: boolean;
  readonly canonicalFactsImmutable: true;
  readonly note: string;
};

export type ValuationInvestmentThesis = {
  readonly thesisId: string;
  readonly entity: string;
  readonly instrumentId: string;
  readonly timeHorizon: ValuationTimeHorizon;
  readonly intrinsicValueDistribution: readonly IntrinsicValueBand[];
  readonly marketImpliedExpectations: readonly MarketImpliedExpectation[];
  readonly expectationGaps: readonly ExpectationGap[];
  readonly baseCase: ValuationCaseNarrative;
  readonly bullCase: ValuationCaseNarrative;
  readonly bearCase: ValuationCaseNarrative;
  readonly keyAssumptions: readonly string[];
  readonly fragileAssumptions: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly evidenceRefs: readonly string[];
  readonly AAFQualification: AafQualification;
  readonly expirationTime: UtcInstant;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type ValuationSpecialistArtifact = {
  readonly artifactId: string;
  readonly role: ValuationCommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly challengesIssued: readonly string[];
  readonly assumptionTopicsChallenged: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly informationTime: UtcInstant;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type ValuationCommitteeRequest = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly instrumentId: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly ValuationEvidenceRef[];
  readonly canonicalFinancialFacts: readonly CanonicalFinancialFact[];
  readonly timeHorizon?: ValuationTimeHorizon;
  readonly decisionImportance?: number;
  readonly forceAllSpecialists?: boolean;
};

export type ValuationCommitteeRun = {
  readonly runId: string;
  readonly schema: typeof import('./taxonomy.ts').VALUATION_COMMITTEE_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly instrumentId: string;
  readonly phases: readonly ValuationCommitteePhase[];
  readonly frozenEvidencePack: FrozenValuationEvidencePack;
  readonly assumptionChallengeState: ValuationAssumptionChallengeState;
  readonly h20Assignments: readonly H20SpecialistAssignmentDecision[];
  readonly artifacts: readonly ValuationSpecialistArtifact[];
  readonly thesis: ValuationInvestmentThesis;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type ValuationCommitteeFailure = {
  readonly code:
    | 'VALIDATION_FAILED'
    | 'SUBJECT_MISMATCH'
    | 'DATA_ACCESS_REFUSED'
    | 'EVIDENCE_MUTATED'
    | 'CANONICAL_FACTS_MUTATED';
  readonly message: string;
};
