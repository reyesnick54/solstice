import type { UtcInstant } from '@solstice/domain';

import { evaluateAlpha22ShadowLabAlerts } from './alerts.ts';
import {
  buildCampaignHealth,
  buildEvidencePipelineHealth,
  buildResearchDataHealth,
  buildShadowLabHealth,
  buildStrategyRuntimeHealth,
} from './health.ts';
import { evaluateAlpha22EngineeringSlos } from './slos.ts';
import { HELIOS_ALPHA22_SCHEMA } from './taxonomy.ts';
import type {
  Alpha22OperatorActionRequest,
  Alpha22OperatorActionResult,
  ShadowLabControlRoomProjection,
  ShadowLabTelemetrySnapshot,
} from './types.ts';
import { applyAlpha22OperatorAction } from './actions.ts';

export type ShadowLabControlRoomState = {
  readonly snapshot: ShadowLabTelemetrySnapshot;
  readonly acknowledgedAlertIds: ReadonlySet<string>;
};

export function projectShadowLabControlRoom(snapshot: ShadowLabTelemetrySnapshot): ShadowLabControlRoomProjection {
  const alerts = evaluateAlpha22ShadowLabAlerts(snapshot);
  return Object.freeze({
    schema: HELIOS_ALPHA22_SCHEMA,
    observedAt: snapshot.observedAt,
    simulationOnly: true,
    authorizesLiveExecution: false,
    activeCampaigns: snapshot.activeCampaignCount,
    activeStrategies: snapshot.activeStrategyCount,
    campaignStatuses: Object.freeze(
      snapshot.campaigns.map((c) => Object.freeze({ campaignId: c.campaignId, status: c.status })),
    ),
    lastSuccessfulTick: snapshot.lastSuccessfulTickAt,
    marketDataState: snapshot.marketDataState,
    decisionCount: snapshot.decisionCount.toString(),
    pendingOutcomes: snapshot.pendingOutcomes.toString(),
    maturedOutcomes: snapshot.maturedOutcomes.toString(),
    paperOrders: snapshot.paperOrderCount.toString(),
    paperFills: snapshot.paperFillCount.toString(),
    shadowNavMinor: snapshot.shadowNavMinor,
    drawdownBps: snapshot.drawdownBps,
    benchmarkRelativePerformanceBps: snapshot.benchmarkActiveReturnBps,
    evidenceStatus: snapshot.evidenceStatus,
    decayStatus: snapshot.decayStatus,
    providerHealth: Object.freeze(
      snapshot.providers.map((p) => Object.freeze({ providerId: p.providerId, healthy: p.healthy })),
    ),
    researchBudget: snapshot.researchBudget,
    errorCount: snapshot.errorCount.toString(),
    shadowLabHealth: buildShadowLabHealth(snapshot),
    campaignHealth: buildCampaignHealth(snapshot),
    strategyRuntimeHealth: buildStrategyRuntimeHealth(snapshot),
    researchDataHealth: buildResearchDataHealth(snapshot),
    evidencePipelineHealth: buildEvidencePipelineHealth(snapshot),
    slos: evaluateAlpha22EngineeringSlos(snapshot),
    openAlerts: alerts,
  });
}

export function ingestShadowLabTelemetry(
  state: ShadowLabControlRoomState,
  snapshot: ShadowLabTelemetrySnapshot,
): ShadowLabControlRoomState {
  if (snapshot.simulationOnly !== true) {
    throw new Error('shadow lab control room requires simulationOnly');
  }
  return Object.freeze({
    snapshot,
    acknowledgedAlertIds: state.acknowledgedAlertIds,
  });
}

export function submitShadowLabOperatorAction(
  state: ShadowLabControlRoomState,
  request: Alpha22OperatorActionRequest,
): { readonly state: ShadowLabControlRoomState; readonly result: Alpha22OperatorActionResult } {
  const result = applyAlpha22OperatorAction(request);
  if (result.outcome === 'REFUSED') {
    return Object.freeze({ state, result });
  }
  let acknowledged = state.acknowledgedAlertIds;
  if (request.action === 'ACKNOWLEDGE_INCIDENT' && request.incidentId) {
    const next = new Set(state.acknowledgedAlertIds);
    for (const alert of evaluateAlpha22ShadowLabAlerts(state.snapshot)) {
      if (alert.summary.includes(request.incidentId) || alert.alertId === request.incidentId) {
        next.add(alert.alertId);
      }
    }
    next.add(request.incidentId);
    acknowledged = next;
  }
  return Object.freeze({
    state: Object.freeze({ snapshot: state.snapshot, acknowledgedAlertIds: acknowledged }),
    result,
  });
}

export function controlRoomAt(state: ShadowLabControlRoomState): ShadowLabControlRoomProjection {
  const alerts = evaluateAlpha22ShadowLabAlerts(state.snapshot, state.acknowledgedAlertIds);
  const base = projectShadowLabControlRoom(state.snapshot);
  return Object.freeze({ ...base, openAlerts: alerts });
}

export function assertNoLiveExecutionFromControlRoom(projection: ShadowLabControlRoomProjection): void {
  if (projection.authorizesLiveExecution !== false || projection.simulationOnly !== true) {
    throw new Error('control-room must not authorize live execution');
  }
}

export function lastSuccessfulTickObserved(projection: ShadowLabControlRoomProjection): UtcInstant | null {
  return projection.lastSuccessfulTick;
}
