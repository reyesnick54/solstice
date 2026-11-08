/**
 * HELIOS Forward Alpha ALPHA22 — Shadow Lab control room, observability, and engineering SLOs.
 */

export {
  HELIOS_ALPHA22_SCHEMA,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED,
  SHADOW_LAB_RUNTIME_MODES,
  SHADOW_CAMPAIGN_OPERATOR_STATUSES,
  SHADOW_MARKET_DATA_STATES,
  SHADOW_HEALTH_BANDS,
  ALPHA22_ENGINEERING_SLO_IDS,
  ALPHA22_SHADOW_LAB_ALERT_KINDS,
  ALPHA22_OPERATOR_ACTIONS,
  ALPHA22_FORBIDDEN_OPERATOR_EFFECTS,
  type ShadowLabRuntimeMode,
  type ShadowCampaignOperatorStatus,
  type ShadowMarketDataState,
  type ShadowHealthBand,
  type Alpha22EngineeringSloId,
  type Alpha22ShadowLabAlertKind,
  type Alpha22OperatorAction,
} from './taxonomy.ts';

export type {
  ShadowLabTelemetrySnapshot,
  ShadowCampaignTelemetryRow,
  ShadowStrategyTelemetryRow,
  ShadowEvidenceStatus,
  ShadowDecayStatus,
  ShadowProviderTelemetryRow,
  ShadowResearchBudgetSnapshot,
  ShadowLabHealth,
  CampaignHealth,
  StrategyRuntimeHealth,
  ResearchDataHealth,
  EvidencePipelineHealth,
  Alpha22EngineeringSloTarget,
  Alpha22SloEvaluation,
  Alpha22ShadowLabAlert,
  ShadowLabControlRoomProjection,
  Alpha22OperatorActionRequest,
  Alpha22OperatorActionResult,
  Alpha22QualificationChecks,
  Alpha22QualificationResult,
} from './types.ts';

export {
  buildShadowLabHealth,
  buildCampaignHealth,
  buildStrategyRuntimeHealth,
  buildResearchDataHealth,
  buildEvidencePipelineHealth,
} from './health.ts';

export { listAlpha22EngineeringSloTargets, evaluateAlpha22EngineeringSlos } from './slos.ts';

export { listAlpha22AlertKinds, evaluateAlpha22ShadowLabAlerts } from './alerts.ts';

export {
  listAlpha22OperatorActions,
  forbiddenOperatorEffects,
  applyAlpha22OperatorAction,
} from './actions.ts';

export {
  projectShadowLabControlRoom,
  ingestShadowLabTelemetry,
  submitShadowLabOperatorAction,
  controlRoomAt,
  assertNoLiveExecutionFromControlRoom,
  lastSuccessfulTickObserved,
  type ShadowLabControlRoomState,
} from './control-room.ts';

export {
  ALPHA22_FIXTURE_NOW,
  ALPHA22_FIXTURE_TICK,
  healthyShadowLabTelemetryFixture,
  degradedShadowLabTelemetryFixture,
} from './fixtures.ts';

export {
  runAlpha22QualificationSelfCheck,
  evaluateAlpha22ShadowControlRoomQualification,
  qualifyAlpha22ShadowControlRoom,
} from './qualification.ts';
