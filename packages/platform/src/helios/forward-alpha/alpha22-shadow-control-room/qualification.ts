import {
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
  ALPHA22_ENGINEERING_SLO_IDS,
  ALPHA22_OPERATOR_ACTIONS,
  ALPHA22_SHADOW_LAB_ALERT_KINDS,
} from './taxonomy.ts';
import { listAlpha22OperatorActions, forbiddenOperatorEffects } from './actions.ts';
import { projectShadowLabControlRoom, assertNoLiveExecutionFromControlRoom } from './control-room.ts';
import { healthyShadowLabTelemetryFixture } from './fixtures.ts';
import { listAlpha22EngineeringSloTargets } from './slos.ts';
import {
  buildCampaignHealth,
  buildEvidencePipelineHealth,
  buildResearchDataHealth,
  buildShadowLabHealth,
  buildStrategyRuntimeHealth,
} from './health.ts';
import type { Alpha22QualificationChecks, Alpha22QualificationResult } from './types.ts';

export { HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED, HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED };

const PROJECTION_FIELDS = [
  'activeCampaigns',
  'activeStrategies',
  'campaignStatuses',
  'lastSuccessfulTick',
  'marketDataState',
  'decisionCount',
  'pendingOutcomes',
  'maturedOutcomes',
  'paperOrders',
  'paperFills',
  'shadowNavMinor',
  'drawdownBps',
  'benchmarkRelativePerformanceBps',
  'evidenceStatus',
  'decayStatus',
  'providerHealth',
  'researchBudget',
  'errorCount',
] as const;

export function runAlpha22QualificationSelfCheck(): Alpha22QualificationChecks {
  const snapshot = healthyShadowLabTelemetryFixture();
  const projection = projectShadowLabControlRoom(snapshot);
  assertNoLiveExecutionFromControlRoom(projection);

  const fiveHealthSurfaces =
    buildShadowLabHealth(snapshot).schema.includes('shadow-lab-health') &&
    buildCampaignHealth(snapshot).schema.includes('campaign-health') &&
    buildStrategyRuntimeHealth(snapshot).schema.includes('strategy-runtime-health') &&
    buildResearchDataHealth(snapshot).schema.includes('research-data-health') &&
    buildEvidencePipelineHealth(snapshot).schema.includes('evidence-pipeline-health');

  const controlRoomFieldsComplete = PROJECTION_FIELDS.every((key) => key in projection);

  const engineeringSlosDeclared =
    listAlpha22EngineeringSloTargets().length === ALPHA22_ENGINEERING_SLO_IDS.length;

  const alertsDeclared = ALPHA22_SHADOW_LAB_ALERT_KINDS.length === 10;

  const operatorActionsSimulationOnly =
    listAlpha22OperatorActions().length === ALPHA22_OPERATOR_ACTIONS.length &&
    forbiddenOperatorEffects().includes('LIVE_FINANCIAL_EXECUTION');

  const noLiveExecutionPath =
    projection.authorizesLiveExecution === false && projection.simulationOnly === true;

  return Object.freeze({
    fiveHealthSurfaces,
    controlRoomFieldsComplete,
    engineeringSlosDeclared,
    alertsDeclared,
    operatorActionsSimulationOnly,
    noLiveExecutionPath,
  });
}

export function evaluateAlpha22ShadowControlRoomQualification(
  checks: Alpha22QualificationChecks,
): Alpha22QualificationResult {
  const labels: Record<keyof Alpha22QualificationChecks, string> = {
    fiveHealthSurfaces: 'ShadowLabHealth, CampaignHealth, StrategyRuntimeHealth, ResearchDataHealth, EvidencePipelineHealth',
    controlRoomFieldsComplete: 'control room projection fields',
    engineeringSlosDeclared: 'engineering SLO catalog',
    alertsDeclared: 'alert kinds',
    operatorActionsSimulationOnly: 'operator actions remain simulation-only',
    noLiveExecutionPath: 'no live execution path from control room',
  };
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Alpha22QualificationChecks, boolean][]) {
    if (!passed) blockers.push(labels[key]);
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}

export function qualifyAlpha22ShadowControlRoom(): Alpha22QualificationResult {
  return evaluateAlpha22ShadowControlRoomQualification(runAlpha22QualificationSelfCheck());
}
