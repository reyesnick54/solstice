/**
 * HELIOS Forward Alpha ALPHA22 — Shadow Lab control room, observability, and SLOs.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALPHA22_ENGINEERING_SLO_IDS,
  ALPHA22_OPERATOR_ACTIONS,
  ALPHA22_SHADOW_LAB_ALERT_KINDS,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
  applyAlpha22OperatorAction,
  buildCampaignHealth,
  buildEvidencePipelineHealth,
  buildResearchDataHealth,
  buildShadowLabHealth,
  buildStrategyRuntimeHealth,
  controlRoomAt,
  degradedShadowLabTelemetryFixture,
  evaluateAlpha22EngineeringSlos,
  evaluateAlpha22ShadowLabAlerts,
  healthyShadowLabTelemetryFixture,
  ingestShadowLabTelemetry,
  listAlpha22EngineeringSloTargets,
  projectShadowLabControlRoom,
  qualifyAlpha22ShadowControlRoom,
  submitShadowLabOperatorAction,
} from '../packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS Forward Alpha ALPHA22 shadow lab control room', () => {
  it('respects HELIOS boundary lint', () => {
    const scoped = lintHeliosBoundary(process.cwd()).filter((f) =>
      f.file.includes('forward-alpha/alpha22-shadow-control-room'),
    );
    assert.deepEqual(scoped, []);
  });

  it('declares five health surfaces, six engineering SLOs, ten alerts, six operator actions', () => {
    assert.equal(ALPHA22_ENGINEERING_SLO_IDS.length, 6);
    assert.equal(ALPHA22_SHADOW_LAB_ALERT_KINDS.length, 10);
    assert.equal(ALPHA22_OPERATOR_ACTIONS.length, 6);
    assert.equal(listAlpha22EngineeringSloTargets().length, 6);
  });

  it('builds health types from telemetry', () => {
    const snapshot = healthyShadowLabTelemetryFixture();
    assert.equal(buildShadowLabHealth(snapshot).band, 'HEALTHY');
    assert.equal(buildCampaignHealth(snapshot).activeCampaigns, 1);
    assert.equal(buildStrategyRuntimeHealth(snapshot).activeStrategies, 2);
    assert.equal(buildResearchDataHealth(snapshot).marketDataState, 'TRUSTED');
    assert.equal(buildEvidencePipelineHealth(snapshot).pendingOutcomes, 3n);
  });

  it('projects control room with required operator-visible fields', () => {
    const projection = projectShadowLabControlRoom(healthyShadowLabTelemetryFixture());
    assert.equal(projection.simulationOnly, true);
    assert.equal(projection.authorizesLiveExecution, false);
    assert.equal(projection.activeCampaigns, 1);
    assert.equal(projection.activeStrategies, 2);
    assert.equal(projection.marketDataState, 'TRUSTED');
    assert.equal(projection.decisionCount, '200');
    assert.equal(projection.pendingOutcomes, '3');
    assert.equal(projection.maturedOutcomes, '197');
    assert.equal(projection.paperOrders, '45');
    assert.equal(projection.paperFills, '42');
    assert.equal(projection.shadowNavMinor, '102500000');
    assert.ok(projection.drawdownBps >= 0);
    assert.equal(projection.benchmarkRelativePerformanceBps, 125);
    assert.equal(projection.researchBudget.budgetId, 'rbdg_alpha22');
    assert.equal(projection.errorCount, '0');
    assert.equal(projection.slos.length, 6);
    assert.ok(projection.slos.every((s) => s.met));
  });

  it('fires degraded alerts without performance-return SLOs', () => {
    const degraded = degradedShadowLabTelemetryFixture();
    const alerts = evaluateAlpha22ShadowLabAlerts(degraded);
    const kinds = new Set(alerts.map((a) => a.kind));
    assert.ok(kinds.has('CAMPAIGN_STOPPED'));
    assert.ok(kinds.has('MARKET_DATA_UNTRUSTED'));
    assert.ok(kinds.has('OUTCOME_BACKLOG'));
    assert.ok(kinds.has('PERSISTENCE_FAILURE'));
    assert.ok(kinds.has('EVIDENCE_HASH_MISMATCH'));
    assert.ok(kinds.has('STRATEGY_DECAY'));
    assert.ok(kinds.has('DRAWDOWN_BREACH'));
    assert.ok(kinds.has('UNEXPECTED_DECISION_RATE_SPIKE'));
    assert.ok(kinds.has('PROVIDER_FAILURE'));
    const slos = evaluateAlpha22EngineeringSlos(degraded);
    assert.ok(slos.some((s) => !s.met));
    for (const slo of slos) {
      assert.ok(!slo.sloId.includes('RETURN'));
      assert.ok(!slo.sloId.includes('PERFORMANCE'));
    }
  });

  it('operator actions never grant live execution', () => {
    const at = asUtcInstant('2026-11-08T12:05:00.000Z');
    for (const action of ALPHA22_OPERATOR_ACTIONS) {
      const result = applyAlpha22OperatorAction({
        action,
        actorId: 'op_fixture',
        at,
        campaignId: action.includes('CAMPAIGN') ? 'fcamp_alpha22_fixture' : undefined,
        strategyId: action === 'PAUSE_STRATEGY' ? 'strat_a' : undefined,
        incidentId: action === 'ACKNOWLEDGE_INCIDENT' ? 'inc_alpha22' : undefined,
      });
      if (result.outcome === 'APPLIED') {
        assert.equal(result.grantsLiveExecution, false);
        assert.equal(result.simulationOnly, true);
      }
    }
  });

  it('acknowledges incidents in control room state', () => {
    const initial = Object.freeze({
      snapshot: degradedShadowLabTelemetryFixture(),
      acknowledgedAlertIds: new Set<string>(),
    });
    const { state } = submitShadowLabOperatorAction(initial, {
      action: 'ACKNOWLEDGE_INCIDENT',
      actorId: 'op_fixture',
      at: asUtcInstant('2026-11-08T12:06:00.000Z'),
      incidentId: 'inc_alpha22',
    });
    const room = controlRoomAt(state);
    assert.ok(room.openAlerts.some((a) => a.acknowledged) || state.acknowledgedAlertIds.has('inc_alpha22'));
  });

  it('ingest rejects non-simulation snapshots', () => {
    const base = Object.freeze({
      snapshot: healthyShadowLabTelemetryFixture(),
      acknowledgedAlertIds: new Set<string>(),
    });
    const notSimulation = {
      ...healthyShadowLabTelemetryFixture(),
      simulationOnly: false,
    } as ReturnType<typeof healthyShadowLabTelemetryFixture>;
    assert.throws(() => ingestShadowLabTelemetry(base, notSimulation), /simulationOnly/);
  });

  it('emits HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED when checks pass', () => {
    const result = qualifyAlpha22ShadowControlRoom();
    assert.equal(result.marker, HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
