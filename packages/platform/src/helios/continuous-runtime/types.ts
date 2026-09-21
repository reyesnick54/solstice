import type { UtcInstant } from '@solstice/domain';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type {
  HeliosCycleOutcome,
  HeliosCycleStage,
  HeliosRuntimeCadenceProfile,
  HeliosRuntimeQueueKind,
  HeliosRuntimeState,
  HeliosScheduledWorkState,
  HeliosSupervisionMode,
  HeliosSupervisionScope,
} from './taxonomy.ts';

export type MandateFundingState = 'FUNDED' | 'PAPER_FUNDED' | 'UNFUNDED';

export type MandateRuntimeConfig = {
  readonly strategyIds: readonly string[];
  readonly assetClasses: readonly string[];
  readonly instrumentIds: readonly string[];
  readonly providerIds: readonly string[];
  readonly jurisdictionEligible: boolean;
  readonly cadenceProfiles: readonly HeliosRuntimeCadenceProfile[];
};

export type MandateRuntimeRegistration = {
  readonly registrationId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly mandateId: string;
  readonly workOrderId: string;
  readonly fundingState: MandateFundingState;
  readonly config: MandateRuntimeConfig;
  readonly registeredAt: UtcInstant;
  readonly active: boolean;
};

export type MandateEligibilityResult =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: string; readonly runtimeState: HeliosRuntimeState };

export type ScheduledWorkItem = {
  readonly scheduleId: string;
  readonly registrationId: string;
  readonly customerId: string;
  readonly queueKind: HeliosRuntimeQueueKind;
  readonly cadenceProfile: HeliosRuntimeCadenceProfile;
  readonly idempotencyKey: string;
  readonly dueAt: UtcInstant;
  readonly state: HeliosScheduledWorkState;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly leaseWorkerId: string | null;
  readonly leaseExpiresAt: UtcInstant | null;
};

export type RuntimeCycleRecord = {
  readonly cycleId: string;
  readonly registrationId: string;
  readonly customerId: string;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly currentStage: HeliosCycleStage | null;
  readonly lastCompletedStage: HeliosCycleStage | null;
  readonly outcome: HeliosCycleOutcome | null;
  readonly runtimeState: HeliosRuntimeState;
  readonly evidenceRef: string | null;
  readonly noActionReason: string | null;
};

export type SupervisionControl = {
  readonly scope: HeliosSupervisionScope;
  readonly scopeKey: string;
  readonly mode: HeliosSupervisionMode;
  readonly updatedAt: UtcInstant;
  readonly reason: string | null;
};

export type RuntimeMetricsSnapshot = {
  readonly opportunitiesDiscovered: number;
  readonly opportunitiesRejected: number;
  readonly strategiesEvaluated: number;
  readonly tradesExecuted: number;
  readonly paperTradesExecuted: number;
  readonly noActionDecisions: number;
  readonly providerErrors: number;
  readonly riskBlocks: number;
  readonly complianceBlocks: number;
  readonly reconciliationExceptions: number;
  readonly queueLatencyMsP50: number;
  readonly queueLatencyMsP99: number;
  readonly decisionLatencyMsP50: number;
  readonly decisionLatencyMsP99: number;
  readonly pendingScheduledWork: number;
  readonly activeRegistrations: number;
};

export type CycleStageContext = {
  readonly now: UtcInstant;
  readonly registration: MandateRuntimeRegistration;
  readonly mandate: CompiledEconomicMandate;
  readonly runtimeState: HeliosRuntimeState;
  readonly exitOnly: boolean;
};

export type CycleStageResult = {
  readonly continueCycle: boolean;
  readonly runtimeState: HeliosRuntimeState;
  readonly outcome: HeliosCycleOutcome | null;
  readonly noActionReason: string | null;
  readonly opportunitiesDiscovered?: number;
  readonly opportunitiesRejected?: number;
  readonly strategiesEvaluated?: number;
  readonly paperTrades?: number;
  readonly providerError?: boolean;
  readonly riskBlock?: boolean;
  readonly complianceBlock?: boolean;
  readonly reconciliationException?: boolean;
};

export type HeliosRuntimePorts = {
  readonly mandateLookup: (mandateId: string) => CompiledEconomicMandate | undefined;
  readonly marketSessionOpen: (input: {
    readonly assetClass: string;
    readonly now: UtcInstant;
  }) => boolean;
  readonly marketDataFresh: (input: {
    readonly customerId: string;
    readonly instrumentIds: readonly string[];
    readonly now: UtcInstant;
  }) => boolean;
  readonly providerAvailable: (input: {
    readonly providerIds: readonly string[];
    readonly now: UtcInstant;
  }) => boolean;
  readonly reconciliationRequired: (input: {
    readonly customerId: string;
    readonly subjectId: string;
  }) => boolean;
  readonly riskPermitsNewEntries: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly now: UtcInstant;
  }) => boolean;
  readonly compliancePermitsAction: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly now: UtcInstant;
  }) => boolean;
  readonly qualifiedOpportunityExists: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly strategyIds: readonly string[];
    readonly now: UtcInstant;
  }) => boolean;
  readonly strategyEligible: (input: {
    readonly strategyId: string;
    readonly now: UtcInstant;
  }) => boolean;
  readonly growDeploymentPaused: (input: {
    readonly customerId: string;
    readonly subjectId: string;
  }) => boolean;
};

export type TickOnceResult = {
  readonly processed: number;
  readonly skipped: number;
  readonly duplicates: number;
  readonly cyclesCompleted: number;
  readonly noActions: number;
};

export type RuntimeStoreSnapshot = {
  readonly registrations: readonly MandateRuntimeRegistration[];
  readonly scheduledWork: readonly ScheduledWorkItem[];
  readonly cycles: readonly RuntimeCycleRecord[];
  readonly supervision: readonly SupervisionControl[];
  readonly metrics: RuntimeMetricsSnapshot;
  readonly shutdownRequested: boolean;
};
