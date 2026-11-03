import type { Clock } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { ResearchBudgetSnapshot } from '../../execution-types.ts';
import type { EconomicWorkOrder } from '../../types.ts';
import type {
  ResearchMonitorDefinition,
  ResearchMonitorEvaluation,
  AafFeatureFabricPort,
  ResearchMonitorStoreSnapshot,
} from '../types.ts';
import type { ResearchMonitorId } from '../ids.ts';
import type {
  ProactiveHistoryKind,
  ProactiveMonitorLifecycle,
  ProactivePipelineStage,
} from './taxonomy.ts';
import type {
  ResearchTriggerMeshPort,
  ResearchTriggerRunResult,
} from '../../open-source-integration/os08/types.ts';
import type { ResearchMonitorTriggerEvent } from '../../open-source-integration/os07/research-monitor-contract.ts';
import type { ResearchTriggerDedupeSnapshot } from '../../open-source-integration/os08/dedupe.ts';

export type ProactiveMonitorSchedule = {
  readonly intervalMs: number;
  readonly nextFireAt: UtcInstant;
};

export type ProactiveMonitorRegistration = {
  readonly registrationId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly monitorId: ResearchMonitorId;
  readonly definition: ResearchMonitorDefinition;
  readonly lifecycle: ProactiveMonitorLifecycle;
  readonly mandateBoundWorkOrder: EconomicWorkOrder;
  readonly schedule: ProactiveMonitorSchedule | null;
  readonly registeredAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type MarketFeatureEvent = {
  readonly eventId: string;
  readonly instrumentIds: readonly string[];
  readonly featureFabric: AafFeatureFabricPort;
  readonly primaryObservationRef: string | null;
  readonly summary: string;
  readonly emittedAt: UtcInstant;
};

export type ProactiveEventSubscription = {
  readonly subscriptionId: string;
  readonly instrumentIds: readonly string[] | null;
  readonly active: boolean;
};

export type ProactivePipelineRecord = {
  readonly recordId: string;
  readonly kind: ProactiveHistoryKind;
  readonly stage: ProactivePipelineStage | null;
  readonly monitorId: ResearchMonitorId | null;
  readonly eventId: string | null;
  readonly triggerEventId: string | null;
  readonly runId: string | null;
  readonly detail: string;
  readonly recordedAt: UtcInstant;
  readonly evidenceRef: string | null;
};

export type ProactiveEngineTickResult = {
  readonly processedEvents: number;
  readonly evaluations: number;
  readonly triggersRouted: number;
  readonly triggersBlocked: number;
  readonly schedulesFired: number;
};

export type ProactiveResearchEngineSnapshot = {
  readonly monitorStore: ResearchMonitorStoreSnapshot;
  readonly registrations: readonly ProactiveMonitorRegistration[];
  readonly subscriptions: readonly ProactiveEventSubscription[];
  readonly history: readonly ProactivePipelineRecord[];
  readonly triggerRuns: readonly ResearchTriggerRunResult[];
  readonly dedupe: ResearchTriggerDedupeSnapshot;
};

export type ProactiveResearchVoiContext = {
  readonly estimatedOpportunitySizeMinor: string;
  readonly unresolvedUncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly accountSizeFeasible: boolean;
  readonly opportunityHalfLifeHours: number;
  readonly timeRemainingHours: number;
  readonly specialistDisagreement: boolean;
  readonly calibratedProbabilityBps: number | null;
};

export type ProactiveResearchEnginePorts = {
  readonly clock: Clock;
  readonly mesh: ResearchTriggerMeshPort;
  readonly evidenceVault?: EvidenceVault;
  readonly researchBudget: ResearchBudgetSnapshot;
  readonly voiContext: ProactiveResearchVoiContext;
};

export type ProactiveDispatchResult = {
  readonly evaluation: ResearchMonitorEvaluation;
  readonly integrationTrigger: ResearchMonitorTriggerEvent | null;
  readonly routeResult: ResearchTriggerRunResult | null;
};
