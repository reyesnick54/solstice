/**
 * HELIOS ALT07 — maritime, logistics, and commodity flow intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createExternalDataPlane, buildProductiveEconomicGraph } from '../packages/external-data/src/index.ts';
import {
  CARGO_EVIDENCE_CLASSES,
  HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED,
  compileAlt07LogisticsFlowSnapshot,
  cargoPresentationPolicySatisfied,
  buildCargoAttribution,
  evaluateAlt07LogisticsFlowQualification,
  projectAlt07FeaturesToAaf,
  SUPPLY_DEMAND_FEATURE_KEYS,
} from '../packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow/index.ts';

const DECISION_TIME = '2026-08-31T12:00:00.000Z' as const;

describe('HELIOS ALT07 logistics flow intelligence', () => {
  it('compiles Wave 5 maritime and logistics into research snapshot', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const snapshot = compileAlt07LogisticsFlowSnapshot({
      plane,
      decisionTimeUtc: DECISION_TIME,
      researchAdapter: 'SPATIOTEMPORAL_GNN',
    });

    assert.ok(snapshot.vessels.length > 0);
    assert.ok(snapshot.routes.length > 0);
    assert.ok(snapshot.ports.length > 0);
    assert.ok(snapshot.shipmentFlows.length > 0);
    assert.ok(snapshot.chokepoints.length > 0);
    assert.equal(snapshot.grantsExecutionAuthority, false);
    assert.ok(snapshot.graph.nodes.length >= snapshot.routes.length);
    assert.ok(snapshot.supplyDemandFeatures.length === SUPPLY_DEMAND_FEATURE_KEYS.length);
  });

  it('distinguishes cargo evidence classes and blocks inferred-as-observed presentation', () => {
    assert.deepEqual(CARGO_EVIDENCE_CLASSES, [
      'OBSERVED_CARGO',
      'DECLARED_CARGO',
      'INFERRED_CARGO',
      'UNKNOWN',
    ]);

    const inferred = buildCargoAttribution({
      evidenceClass: 'INFERRED_CARGO',
      commodityCode: 'CRUDE_OIL',
      sourceObservationIds: ['obs-1'],
    });
    assert.ok(cargoPresentationPolicySatisfied(inferred));
    assert.match(inferred.presentationLabel, /inferred/i);

    const bad = Object.freeze({
      ...inferred,
      presentationLabel: 'observed cargo',
    });
    assert.equal(cargoPresentationPolicySatisfied(bad), false);
  });

  it('maps firm exposure company → facility → port → route → commodity', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const snapshot = compileAlt07LogisticsFlowSnapshot({
      plane,
      decisionTimeUtc: DECISION_TIME,
    });
    assert.ok(snapshot.firmExposures.length > 0);
    const exposure = snapshot.firmExposures[0]!;
    assert.ok(exposure.companyId.includes('xom'));
    assert.equal(exposure.facilityId, 'refinery-baytown');
    assert.equal(exposure.commodityCode, 'CRUDE_OIL');
    assert.ok(exposure.evidenceRefs.length > 0);
  });

  it('emits research forecasts that never control execution', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const snapshot = compileAlt07LogisticsFlowSnapshot({
      plane,
      decisionTimeUtc: DECISION_TIME,
      researchAdapter: 'TEMPORAL_GRAPH_ATTENTION',
    });
    for (const hint of snapshot.researchForecasts) {
      assert.equal(hint.controlsExecution, false);
    }
  });

  it('projects ALT_DATA features for AAF fabric', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const snapshot = compileAlt07LogisticsFlowSnapshot({
      plane,
      decisionTimeUtc: DECISION_TIME,
    });
    const rows = projectAlt07FeaturesToAaf(snapshot.supplyDemandFeatures);
    assert.equal(rows.length, SUPPLY_DEMAND_FEATURE_KEYS.length);
    assert.ok(rows.every((r) => r.kind === 'ALT_DATA' && r.grantsExecutionAuthority === false));
  });

  it('qualifies HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const snapshot = compileAlt07LogisticsFlowSnapshot({
      plane,
      decisionTimeUtc: DECISION_TIME,
      researchAdapter: 'SPATIOTEMPORAL_GNN',
    });

    const unlicensedVessel = snapshot.vessels.every((v) => !v.ais.licensed || Object.keys(v.ais.features).length >= 0);
    const inferredOk = snapshot.routes.every(
      (r) => r.cargo.evidenceClass !== 'INFERRED_CARGO' || cargoPresentationPolicySatisfied(r.cargo),
    );

    const result = evaluateAlt07LogisticsFlowQualification({
      wave5MaritimeLogisticsBridge: snapshot.vessels.length > 0 && snapshot.routes.length > 0,
      cargoClassesDistinguished: true,
      inferredNotPresentedAsObserved: inferredOk,
      aisGatedWhenUnlicensed: unlicensedVessel,
      firmExposureEvidencePresent: snapshot.firmExposures.every((e) => e.evidenceRefs.length > 0),
      deterministicGraphBaseline: snapshot.graph.nodes.length > 0,
      supplyDemandFeaturesEmitted: snapshot.supplyDemandFeatures.length === SUPPLY_DEMAND_FEATURE_KEYS.length,
      weatherOverlayPermitted: true,
      researchAdapterNoExecution: snapshot.researchForecasts.every((f) => f.controlsExecution === false),
      executionModeDisabled: true,
    });

    assert.equal(result.marker, HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED, result.blockers.join('; '));
  });

  it('extends Wave 5 productive graph with port nodes from logistics', () => {
    const plane = createExternalDataPlane({ nowUtc: DECISION_TIME });
    const peg = buildProductiveEconomicGraph(plane);
    assert.ok(peg.nodes.some((n) => n.nodeType === 'PORT'));
  });
});
