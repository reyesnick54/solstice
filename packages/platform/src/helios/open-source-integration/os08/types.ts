import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { ResearchBudgetSnapshot } from '../../execution-types.ts';
import type { EconomicWorkOrder } from '../../types.ts';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { ResearchMonitorTriggerEvent } from '../os07/research-monitor-contract.ts';
import type { ResearchSpendDecision } from '../../meta-allocator/taxonomy.ts';
import type { ResearchValueAssessment } from '../../meta-allocator/types.ts';
import type {
  MeshSpecialistRoleName,
  TriggerRouterOutcome,
  TriggerRouterReasonCode,
  TriggerSpecialistClass,
} from './taxonomy.ts';
import type { ResearchTriggerRunId, TriggeredResearchWorkOrderId } from './ids.ts';

export type ResearchTriggerBudgetLimits = {
  readonly systemSpendCapMicros: bigint;
  readonly customerSpendCapMicros: bigint;
  readonly maxConcurrentRunsSystem: number;
  readonly maxConcurrentRunsPerCustomer: number;
  readonly maxRunsSystemPerDay: number;
  readonly maxRunsPerCustomerPerDay: number;
  readonly dedupeWindowSeconds: number;
  readonly defaultCooldownSeconds: number;
};

export const DEFAULT_RESEARCH_TRIGGER_BUDGET_LIMITS: ResearchTriggerBudgetLimits = Object.freeze({
  systemSpendCapMicros: 50_000_000n,
  customerSpendCapMicros: 10_000_000n,
  maxConcurrentRunsSystem: 32,
  maxConcurrentRunsPerCustomer: 4,
  maxRunsSystemPerDay: 500,
  maxRunsPerCustomerPerDay: 40,
  dedupeWindowSeconds: 300,
  defaultCooldownSeconds: 60,
});

export type ModelProviderCostEntry = {
  readonly provider: string;
  readonly modelId: string;
  readonly costMicros: bigint;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly inferenceCalls: number;
};

export type ResearchTriggerCostAccounting = {
  readonly totalCostMicros: bigint;
  readonly modelCosts: readonly ModelProviderCostEntry[];
  readonly providerTotalsMicros: Readonly<Record<string, string>>;
};

export type TriggeredResearchWorkOrder = {
  readonly triggeredWorkOrderId: TriggeredResearchWorkOrderId;
  readonly economicWorkOrderId: EconomicWorkOrderId;
  readonly triggerEventId: string;
  readonly monitorId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
  readonly approvedBudgetMinor: string;
  readonly approvedBudgetCurrency: string;
  readonly requestedSpecialistClasses: readonly TriggerSpecialistClass[];
  readonly routedMeshRoles: readonly MeshSpecialistRoleName[];
  readonly economicWorkOrder: EconomicWorkOrder;
  readonly createdAt: UtcInstant;
};

export type ResearchTriggerMeshAgentSummary = {
  readonly role: MeshSpecialistRoleName;
  readonly taskId: string;
  readonly modelProvider: string;
  readonly modelId: string;
  readonly sourceRefs: readonly string[];
  readonly costMicros: bigint;
};

export type ResearchTriggerConfidenceDelta = {
  readonly confidenceBefore: ResearchMonitorTriggerEvent['confidenceBefore'];
  readonly confidenceAfter: ResearchMonitorTriggerEvent['confidenceBefore'];
  readonly deltaLabel: 'IMPROVED' | 'UNCHANGED' | 'DEGRADED' | 'UNKNOWN';
};

export type ResearchTriggerEvidenceRecord = {
  readonly evidenceRecordId: string;
  readonly runId: ResearchTriggerRunId;
  readonly triggerEventId: string;
  readonly whyTriggered: string;
  readonly availableInformationSummary: string;
  readonly observationRef: string | null;
  readonly featureRef: string | null;
  readonly agentsRan: readonly ResearchTriggerMeshAgentSummary[];
  readonly sourcesUsed: readonly string[];
  readonly cost: ResearchTriggerCostAccounting;
  readonly confidenceDelta: ResearchTriggerConfidenceDelta;
  readonly voiAssessment: ResearchValueAssessment;
  readonly spendDecision: ResearchSpendDecision;
  readonly sealedVaultEvidenceId: string | null;
  readonly recordedAt: UtcInstant;
};

export type ResearchTriggerRunResult = {
  readonly runId: ResearchTriggerRunId;
  readonly outcome: TriggerRouterOutcome;
  readonly reasonCodes: readonly TriggerRouterReasonCode[];
  readonly triggeredWorkOrder: TriggeredResearchWorkOrder | null;
  readonly meshRunId: string | null;
  readonly evidence: ResearchTriggerEvidenceRecord | null;
  readonly strategyEvaluationRequested: boolean;
};

export type ResearchTriggerRouterInput = {
  readonly trigger: ResearchMonitorTriggerEvent;
  readonly now: UtcInstant;
  readonly mandateBoundWorkOrder: EconomicWorkOrder;
  readonly researchBudget: ResearchBudgetSnapshot;
  readonly voiContext: {
    readonly estimatedOpportunitySizeMinor: string;
    readonly unresolvedUncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
    readonly accountSizeFeasible: boolean;
    readonly opportunityHalfLifeHours: number;
    readonly timeRemainingHours: number;
    readonly specialistDisagreement: boolean;
    readonly calibratedProbabilityBps: number | null;
  };
  readonly requestStrategyEvaluation?: boolean;
};

export type ResearchTriggerMeshPort = {
  readonly runTriggeredResearch: (input: {
    readonly workOrderId: string;
    readonly subjectId: string;
    readonly objective: string;
    readonly opportunityKind: NonNullable<ResearchMonitorTriggerEvent['opportunityKind']>;
    readonly roles: readonly MeshSpecialistRoleName[];
    readonly evidenceBundle: readonly {
      readonly evidenceId: string;
      readonly sourceKind: string;
      readonly sourceRef: string;
      readonly observedAt: UtcInstant;
      readonly freshnessOk: boolean;
      readonly entitlementOk: boolean;
      readonly provenanceRef: string;
    }[];
    readonly approvedBudgetMicros: bigint;
  }) =>
    | {
        readonly ok: true;
        readonly meshRunId: string;
        readonly agents: readonly ResearchTriggerMeshAgentSummary[];
        readonly sourcesUsed: readonly string[];
        readonly cost: ResearchTriggerCostAccounting;
        readonly confidenceAfter: ResearchMonitorTriggerEvent['confidenceBefore'];
      }
    | { readonly ok: false; readonly message: string };
};

export type ResearchTriggerStrategyEvaluationPort = {
  readonly evaluateResearchResult: (input: {
    readonly runId: ResearchTriggerRunId;
    readonly triggeredWorkOrder: TriggeredResearchWorkOrder;
    readonly evidence: ResearchTriggerEvidenceRecord;
  }) => void;
};

export type ResearchTriggerRouterFailure = {
  readonly code: 'INVALID_TRIGGER' | 'CUSTOMER_MISMATCH' | 'WORK_ORDER_INACTIVE';
  readonly message: string;
};
