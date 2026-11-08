import type { UtcInstant } from '@solstice/domain';

import type {
  Alpha22EngineeringSloId,
  Alpha22OperatorAction,
  Alpha22ShadowLabAlertKind,
  ShadowCampaignOperatorStatus,
  ShadowHealthBand,
  ShadowMarketDataState,
} from './taxonomy.ts';
import {
  HELIOS_ALPHA22_SCHEMA,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
} from './taxonomy.ts';

/** Aggregated telemetry for shadow-lab control room (simulation / research only). */
export type ShadowLabTelemetrySnapshot = {
  readonly observedAt: UtcInstant;
  readonly simulationOnly: true;
  readonly activeCampaignCount: number;
  readonly activeStrategyCount: number;
  readonly campaigns: readonly ShadowCampaignTelemetryRow[];
  readonly strategies: readonly ShadowStrategyTelemetryRow[];
  readonly lastSuccessfulTickAt: UtcInstant | null;
  readonly marketDataState: ShadowMarketDataState;
  readonly marketDataAgeMs: number;
  readonly decisionCount: bigint;
  readonly decisionsPerMinute: number;
  readonly pendingOutcomes: bigint;
  readonly maturedOutcomes: bigint;
  readonly paperOrderCount: bigint;
  readonly paperFillCount: bigint;
  readonly shadowNavMinor: string;
  readonly peakNavMinor: string;
  readonly drawdownBps: number;
  readonly benchmarkActiveReturnBps: number;
  readonly evidenceStatus: ShadowEvidenceStatus;
  readonly decayStatus: ShadowDecayStatus;
  readonly providers: readonly ShadowProviderTelemetryRow[];
  readonly researchBudget: ShadowResearchBudgetSnapshot;
  readonly errorCount: bigint;
  readonly leaseHeld: boolean;
  readonly persistenceHealthy: boolean;
  readonly evidenceHashOk: boolean;
  readonly outcomeBacklogAgeMs: number;
  readonly decisionFreshnessAgeMs: number;
  readonly evidencePersistLatencyMs: number;
  readonly recoveryDurationMs: number | null;
  readonly campaignRuntimeAvailabilityRatio: number;
};

export type ShadowCampaignTelemetryRow = {
  readonly campaignId: string;
  readonly status: ShadowCampaignOperatorStatus;
  readonly strategyIds: readonly string[];
  readonly lastTickAt: UtcInstant | null;
};

export type ShadowStrategyTelemetryRow = {
  readonly strategyId: string;
  readonly campaignId: string;
  readonly paused: boolean;
  readonly decayFlagged: boolean;
  readonly decisionCount: bigint;
};

export type ShadowEvidenceStatus = {
  readonly persisted: boolean;
  readonly lastSealAt: UtcInstant | null;
  readonly chainHeadHash: string | null;
  readonly mismatch: boolean;
};

export type ShadowDecayStatus = {
  readonly monitored: boolean;
  readonly strategiesInDecay: readonly string[];
};

export type ShadowProviderTelemetryRow = {
  readonly providerId: string;
  readonly healthy: boolean;
  readonly lastSuccessAt: UtcInstant | null;
};

export type ShadowResearchBudgetSnapshot = {
  readonly budgetId: string;
  readonly spentMinor: string;
  readonly limitMinor: string;
  readonly remainingMinor: string;
};

export type ShadowLabHealth = {
  readonly schema: 'sunrey.helios.alpha22.shadow-lab-health.v1';
  readonly band: ShadowHealthBand;
  readonly runtimeMode: 'CONTINUOUS_RESEARCH' | 'PAUSED' | 'TERMINATED';
  readonly leaseHeld: boolean;
  readonly errorCount: bigint;
  readonly summary: string;
};

export type CampaignHealth = {
  readonly schema: 'sunrey.helios.alpha22.campaign-health.v1';
  readonly band: ShadowHealthBand;
  readonly activeCampaigns: number;
  readonly rows: readonly { readonly campaignId: string; readonly status: ShadowCampaignOperatorStatus; readonly band: ShadowHealthBand }[];
};

export type StrategyRuntimeHealth = {
  readonly schema: 'sunrey.helios.alpha22.strategy-runtime-health.v1';
  readonly band: ShadowHealthBand;
  readonly activeStrategies: number;
  readonly pausedStrategies: number;
  readonly decayFlagged: number;
};

export type ResearchDataHealth = {
  readonly schema: 'sunrey.helios.alpha22.research-data-health.v1';
  readonly band: ShadowHealthBand;
  readonly marketDataState: ShadowMarketDataState;
  readonly marketDataAgeMs: number;
  readonly providerFailureCount: number;
};

export type EvidencePipelineHealth = {
  readonly schema: 'sunrey.helios.alpha22.evidence-pipeline-health.v1';
  readonly band: ShadowHealthBand;
  readonly persisted: boolean;
  readonly hashOk: boolean;
  readonly pendingOutcomes: bigint;
  readonly outcomeBacklogAgeMs: number;
};

export type Alpha22EngineeringSloTarget = {
  readonly sloId: Alpha22EngineeringSloId;
  readonly description: string;
  readonly target: string;
};

export type Alpha22SloEvaluation = {
  readonly sloId: Alpha22EngineeringSloId;
  readonly met: boolean;
  readonly observed: string;
  readonly detail: string;
};

export type Alpha22ShadowLabAlert = {
  readonly alertId: string;
  readonly kind: Alpha22ShadowLabAlertKind;
  readonly firedAt: UtcInstant;
  readonly summary: string;
  readonly acknowledged: boolean;
};

export type ShadowLabControlRoomProjection = {
  readonly schema: typeof HELIOS_ALPHA22_SCHEMA;
  readonly observedAt: UtcInstant;
  readonly simulationOnly: true;
  readonly authorizesLiveExecution: false;
  readonly activeCampaigns: number;
  readonly activeStrategies: number;
  readonly campaignStatuses: readonly { readonly campaignId: string; readonly status: ShadowCampaignOperatorStatus }[];
  readonly lastSuccessfulTick: UtcInstant | null;
  readonly marketDataState: ShadowMarketDataState;
  readonly decisionCount: string;
  readonly pendingOutcomes: string;
  readonly maturedOutcomes: string;
  readonly paperOrders: string;
  readonly paperFills: string;
  readonly shadowNavMinor: string;
  readonly drawdownBps: number;
  readonly benchmarkRelativePerformanceBps: number;
  readonly evidenceStatus: ShadowEvidenceStatus;
  readonly decayStatus: ShadowDecayStatus;
  readonly providerHealth: readonly { readonly providerId: string; readonly healthy: boolean }[];
  readonly researchBudget: ShadowResearchBudgetSnapshot;
  readonly errorCount: string;
  readonly shadowLabHealth: ShadowLabHealth;
  readonly campaignHealth: CampaignHealth;
  readonly strategyRuntimeHealth: StrategyRuntimeHealth;
  readonly researchDataHealth: ResearchDataHealth;
  readonly evidencePipelineHealth: EvidencePipelineHealth;
  readonly slos: readonly Alpha22SloEvaluation[];
  readonly openAlerts: readonly Alpha22ShadowLabAlert[];
};

export type Alpha22OperatorActionRequest = {
  readonly action: Alpha22OperatorAction;
  readonly actorId: string;
  readonly at: UtcInstant;
  readonly campaignId?: string;
  readonly strategyId?: string;
  readonly incidentId?: string;
};

export type Alpha22OperatorActionResult =
  | {
      readonly outcome: 'APPLIED';
      readonly action: Alpha22OperatorAction;
      readonly grantsLiveExecution: false;
      readonly simulationOnly: true;
      readonly detail: string;
    }
  | {
      readonly outcome: 'REFUSED';
      readonly action: Alpha22OperatorAction;
      readonly reason: string;
    };

export type Alpha22QualificationChecks = {
  readonly fiveHealthSurfaces: boolean;
  readonly controlRoomFieldsComplete: boolean;
  readonly engineeringSlosDeclared: boolean;
  readonly alertsDeclared: boolean;
  readonly operatorActionsSimulationOnly: boolean;
  readonly noLiveExecutionPath: boolean;
};

export type Alpha22QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED
    | typeof HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};
