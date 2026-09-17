import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId, HeliosTaskId } from '../ids.ts';
import type { BudgetUnitKind } from '../taxonomy.ts';
import type {
  AssertionKind,
  ResearchCompletionStatus,
  ResearchPrivacyClass,
  ResearchRecommendationClass,
  ResearchToolCategory,
  ToolAuthorizationOutcome,
  GROK_RESEARCH_SCHEMA_VERSION,
} from './taxonomy.ts';

export type ResearchEvidenceRef = {
  readonly evidenceId: string;
  readonly sourceId: string | null;
  readonly sourceTime: UtcInstant | null;
  readonly arrivalTime: UtcInstant;
  readonly provider: string | null;
  readonly entitlement: string | null;
  readonly provenanceRef: string | null;
  readonly excerptHash: string | null;
  readonly freshnessMs: number | null;
  readonly confidenceBand: string | null;
};

export type ResearchAssertion = {
  readonly assertionId: string;
  readonly kind: AssertionKind;
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
  readonly unsupported: boolean;
  readonly contradictedBy: readonly string[];
};

export type ResearchHypothesis = {
  readonly hypothesisId: string;
  readonly statement: string;
  readonly evidenceRefs: readonly string[];
  readonly invalidatingConditions: readonly string[];
  readonly confidenceBand: string | null;
};

export type ResearchCandidateRef = {
  readonly candidateKey: string;
  readonly hypothesisId: string | null;
  readonly instrumentSymbol: string | null;
  readonly evidenceRefs: readonly string[];
};

export type GrokResearchUsage = {
  readonly modelCalls: number;
  readonly toolCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMicros: string;
  readonly failedAttempts: number;
  readonly retries: number;
  readonly elapsedMs: number;
  readonly budgetUnitKind: BudgetUnitKind;
  readonly budgetConsumed: string;
};

export type GrokResearchResult = {
  readonly schemaVersion: typeof GROK_RESEARCH_SCHEMA_VERSION;
  readonly researchResultId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly taskId: HeliosTaskId;
  readonly customerId: CustomerId;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly question: string;
  readonly privacyClass: ResearchPrivacyClass;
  readonly evidenceRefs: readonly ResearchEvidenceRef[];
  readonly keyFacts: readonly ResearchAssertion[];
  readonly contradictions: readonly ResearchAssertion[];
  readonly hypotheses: readonly ResearchHypothesis[];
  readonly candidateRefs: readonly ResearchCandidateRef[];
  readonly invalidatingConditions: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly calibrationBand: string | null;
  readonly recommendation: ResearchRecommendationClass;
  readonly usage: GrokResearchUsage;
  readonly narrativeSummary: string | null;
  readonly completionStatus: ResearchCompletionStatus;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
};

export type HeliosResearchTaskInput = {
  readonly taskId: HeliosTaskId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly question: string;
  readonly permittedTools: readonly string[];
  readonly permittedModelClass: string;
  readonly timeHorizonDays: number | null;
  readonly deadline: UtcInstant | null;
  readonly budgetCeiling: string;
  readonly budgetUnitKind: BudgetUnitKind;
  readonly budgetCurrency: string | null;
  readonly outputSchema: string;
  readonly privacyClass: ResearchPrivacyClass;
  readonly existingEvidenceRefs: readonly string[];
  readonly candidateOpportunityKey: string | null;
  readonly publicContext: Readonly<Record<string, unknown>>;
  readonly privateContext: Readonly<Record<string, unknown>> | null;
};

export type ResearchToolRequest = {
  readonly requestId: string;
  readonly taskId: HeliosTaskId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly toolId: string;
  readonly operation: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly requestedAt: UtcInstant;
};

export type ResearchToolCallRecord = {
  readonly request: ResearchToolRequest;
  readonly authorization: ToolAuthorizationOutcome;
  readonly capability: ResearchToolCategory | null;
  readonly budgetImpact: string;
  readonly resultEvidenceRef: string | null;
  readonly resultPayload: Readonly<Record<string, unknown>> | null;
  readonly error: string | null;
  readonly completedAt: UtcInstant;
};

export type ResearchLoopLimits = {
  readonly maxReasoningIterations: number;
  readonly maxToolCalls: number;
  readonly maxModelCalls: number;
  readonly maxWallClockMs: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxBudgetConsumed: string;
  readonly perToolCallLimit: number;
};

export type ResearchReasoningStep = {
  readonly stepIndex: number;
  readonly modelCallId: string;
  readonly toolRequests: readonly ResearchToolRequest[];
  readonly synthesis: string | null;
  readonly isFinal: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type GrokResearchFailure = {
  readonly code:
    | 'PRIVATE_CONTEXT_REJECTED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_TIMEOUT'
    | 'BUDGET_EXHAUSTED'
    | 'CANCELLED'
    | 'INVALID_INPUT'
    | 'LIMIT_REACHED';
  readonly message: string;
  readonly partialResult: GrokResearchResult | null;
};
