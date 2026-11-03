import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  DebateInformationValueHint,
  ResearchDebateParticipantRole,
  ResearchDebatePhase,
} from './taxonomy.ts';
import type { RESEARCH_DEBATE_SCHEMA } from './taxonomy.ts';

export type DebateEvidenceRef = {
  readonly evidenceId: string;
  readonly sourceKind:
    | 'MARKET_OBSERVATION'
    | 'MANDATE'
    | 'PORTFOLIO'
    | 'EXTERNAL_PUBLIC'
    | 'ASSERTION'
    | 'RISK_SIGNAL';
  readonly sourceRef: string;
  readonly observedAt: UtcInstant;
  readonly freshnessOk: boolean;
  readonly entitlementOk: boolean;
  readonly provenanceRef: string;
};

export type FrozenEvidencePack = {
  readonly packId: string;
  readonly contentHash: string;
  readonly frozenAt: UtcInstant;
  readonly evidence: readonly DebateEvidenceRef[];
};

export type StructuredResearchClaim = {
  readonly claimId: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly confidenceBps: number;
  readonly topic: string;
};

export type CounterEvidenceChallenge = {
  readonly challengeId: string;
  readonly targetClaimId: string;
  readonly counterStatement: string;
  readonly evidenceIds: readonly string[];
  readonly fromParticipant: ResearchDebateParticipantRole;
  readonly round: number;
};

export type ResearchDebateParticipant = {
  readonly role: ResearchDebateParticipantRole;
  readonly participantId: string;
  readonly modelProvider: 'LOCAL_DETERMINISTIC' | 'S3M' | 'GROK';
  readonly modelId: string;
  readonly modelVersion: string;
  readonly promptTemplateId: string;
  readonly grantsFinancialAuthority: false;
};

export type BullCase = {
  readonly participant: 'BULL_RESEARCH';
  readonly thesisSummary: string;
  readonly claims: readonly StructuredResearchClaim[];
  readonly supportingEvidenceIds: readonly string[];
  readonly keyAssumptions: readonly string[];
};

export type BearCase = {
  readonly participant: 'BEAR_RESEARCH';
  readonly thesisSummary: string;
  readonly claims: readonly StructuredResearchClaim[];
  readonly supportingEvidenceIds: readonly string[];
  readonly keyAssumptions: readonly string[];
};

export type RiskCase = {
  readonly participant: 'RISK_EVALUATOR';
  readonly downsideSummary: string;
  readonly claims: readonly StructuredResearchClaim[];
  readonly dominantRiskFactors: readonly string[];
  readonly tailScenarios: readonly string[];
  readonly supportingEvidenceIds: readonly string[];
};

export type ResearchSynthesis = {
  readonly participant: 'SYNTHESIS';
  readonly summary: string;
  readonly pointsOfAgreement: readonly string[];
  readonly pointsOfDisagreement: readonly string[];
  readonly preservedDisagreement: true;
  readonly consensusIsNotTruth: true;
};

export type ResearchDisagreementMetric = {
  readonly disagreementScore: number;
  readonly confidenceSpreadBps: number;
  readonly opposingClaimPairs: number;
  readonly sharedEvidenceAgreementBps: number;
  readonly materialDisagreement: boolean;
  readonly lowValueDisagreement: boolean;
  readonly informationValueHint: DebateInformationValueHint;
  readonly calibrationNotes: readonly string[];
};

export type ResearchConsensus = {
  readonly schema: typeof RESEARCH_DEBATE_SCHEMA;
  readonly bullishEvidence: readonly DebateEvidenceRef[];
  readonly bearishEvidence: readonly DebateEvidenceRef[];
  readonly keyUnknowns: readonly string[];
  readonly disagreementScore: number;
  readonly confidenceRange: { readonly lowBps: number; readonly highBps: number };
  readonly dominantRiskFactors: readonly string[];
  readonly informationGaps: readonly string[];
  readonly suggestedResearchNextSteps: readonly string[];
  readonly evidenceRefs: readonly DebateEvidenceRef[];
  readonly pointsOfAgreement: readonly string[];
  readonly pointsOfDisagreement: readonly string[];
  readonly consensusIsNotTruth: true;
};

export type ResearchDebate = {
  readonly debateId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly schema: typeof RESEARCH_DEBATE_SCHEMA;
  readonly phase: ResearchDebatePhase;
  readonly frozenEvidencePack: FrozenEvidencePack;
  readonly participants: readonly ResearchDebateParticipant[];
  readonly bullCase: BullCase;
  readonly bearCase: BearCase;
  readonly riskCase: RiskCase;
  readonly rebuttals: readonly CounterEvidenceChallenge[];
  readonly synthesis: ResearchSynthesis;
  readonly disagreementMetric: ResearchDisagreementMetric;
  readonly consensus: ResearchConsensus;
  readonly completedAt: UtcInstant;
  readonly grantsFinancialAuthority: false;
};

export type ResearchDebateInput = {
  readonly debateId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly evidence: readonly DebateEvidenceRef[];
  readonly now: UtcInstant;
};
