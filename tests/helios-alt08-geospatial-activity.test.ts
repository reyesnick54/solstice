/**
 * ALT08 — geospatial and satellite physical-activity engine qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  DEMO_FACTORY_ASSET,
  DEMO_FACTORY_NTL,
  DEMO_FACTORY_THERMAL,
  DEMO_FUTURE_LEAKING_OBS,
  DEMO_MINE_ASSET,
  DEMO_MINE_SURFACE,
  DERIVED_GEOSPATIAL_OBSERVATION_KINDS,
  GEO_ASSET_TYPES,
} from '../packages/external-data/src/geospatial-activity/index.ts';
import {
  DERIVED_OBSERVATION_KINDS,
  GEO_ASSET_TYPES as DOMAIN_ASSET_TYPES,
  HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED,
  compileGeospatialActivityManifest,
  createGeospatialActivityStore,
  evaluateAlt08GeospatialActivityQualification,
  filterKnowableGeoObservations,
  fusePhysicalActivityEstimate,
  mapExternalGeoObservation,
  physicalActivityBand,
  runGeospatialActivityPipeline,
} from '../packages/platform/src/helios/alternative-data-intelligence/geospatial-activity/index.ts';
import {
  compileGeospatialFeaturePlaneFromManifest,
  geospatialEstimatesToContributions,
} from '../packages/platform/src/helios/feature-fabric/geospatial-activity/index.ts';

const EVAL_TIME = asUtcInstant('2025-06-02T12:00:00.000Z');
const BEFORE_LEAK = asUtcInstant('2025-06-01T09:00:00.000Z');

describe('HELIOS ALT08 geospatial physical-activity engine', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('taxonomy covers facility asset types and derived observation kinds', () => {
    assert.equal(GEO_ASSET_TYPES.length, 9);
    assert.deepEqual([...GEO_ASSET_TYPES].sort(), [...DOMAIN_ASSET_TYPES].sort());
    assert.equal(DERIVED_GEOSPATIAL_OBSERVATION_KINDS.length, 12);
    assert.deepEqual([...DERIVED_GEOSPATIAL_OBSERVATION_KINDS].sort(), [...DERIVED_OBSERVATION_KINDS].sort());
  });

  it('enforces knowableAt — future observations hidden at evaluation time', () => {
    const store = createGeospatialActivityStore();
    store.appendObservation(mapExternalGeoObservation(DEMO_FACTORY_NTL));
    store.appendObservation(mapExternalGeoObservation(DEMO_FUTURE_LEAKING_OBS));
    const snap = store.snapshotKnowableAt(BEFORE_LEAK);
    assert.equal(snap.observations.length, 1);
    assert.equal(snap.observations[0]?.observationId, DEMO_FACTORY_NTL.observationId);
  });

  it('manifest compile rejects leakage', () => {
    const store = createGeospatialActivityStore();
    store.appendObservation(mapExternalGeoObservation(DEMO_FUTURE_LEAKING_OBS));
    assert.throws(() =>
      compileGeospatialActivityManifest({
        evaluationTime: BEFORE_LEAK,
        compiledAt: BEFORE_LEAK,
        snapshot: store.snapshot(),
      }),
    );
  });

  it('multi-sensor fusion yields estimate with uncertainty and source contributions', () => {
    const observations = [
      mapExternalGeoObservation(DEMO_FACTORY_NTL),
      mapExternalGeoObservation(DEMO_FACTORY_THERMAL),
    ];
    const estimate = fusePhysicalActivityEstimate({
      geoAssetId: DEMO_FACTORY_ASSET.geoAssetId,
      evaluationTime: EVAL_TIME,
      observations,
    });
    assert.equal(estimate.luminosityIsNotProduction, true);
    assert.ok(estimate.sourceContributions.length >= 2);
    assert.ok(estimate.uncertaintyBps >= 0);
    assert.ok(estimate.activityIndexBps > 0);
    assert.equal(estimate.grantsExecutionAuthority, false);
    const band = physicalActivityBand(estimate);
    assert.ok(['IDLE', 'LOW', 'MODERATE', 'ELEVATED', 'UNKNOWN'].includes(band));
  });

  it('pipeline produces manifest and feature plane without raw imagery on features', () => {
    const manifest = runGeospatialActivityPipeline({
      assets: [DEMO_FACTORY_ASSET, DEMO_MINE_ASSET],
      observations: [DEMO_FACTORY_NTL, DEMO_FACTORY_THERMAL, DEMO_MINE_SURFACE],
      evaluationTime: EVAL_TIME,
      compiledAt: EVAL_TIME,
    });
    assert.equal(manifest.assets.length, 2);
    assert.ok(manifest.estimates.length >= 1);
    const plane = compileGeospatialFeaturePlaneFromManifest({ manifest });
    assert.ok(plane);
    assert.ok(plane.features.length > 0);
    assert.ok(plane.features.every((row) => row.rawImageryExcluded === true));
    const contributions = geospatialEstimatesToContributions({
      evaluationTime: EVAL_TIME,
      estimates: manifest.estimates,
    });
    assert.ok(contributions.length > 0);
  });

  it('derived metrics carry lineage refs; imagery stays evidence-only', () => {
    const mapped = mapExternalGeoObservation(DEMO_FACTORY_NTL);
    assert.ok(mapped.derived.lineage.evidenceRef.length > 0);
    assert.ok(mapped.derived.lineage.rawImageryRef);
    assert.equal(mapped.derived.lineage.rawImageryRef, DEMO_FACTORY_NTL.provenance.evidence.rawImageryRef);
  });

  it('qualification marker HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED', () => {
    const result = evaluateAlt08GeospatialActivityQualification({
      coreTypesDefined: true,
      assetTaxonomyComplete: true,
      derivedObservationKindsComplete: true,
      qualityStateTracked: true,
      rawImageryNotOnFeaturePlane: true,
      knowableAtEnforced: true,
      multiSensorFusionPresent: true,
      noIndividualBehaviorInference: true,
      luminosityNotProductionProxy: true,
      featureFabricBridgePresent: true,
      noExecutionAuthorityOnArtifacts: true,
    });
    assert.equal(result.marker, HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });

  it('filterKnowableGeoObservations is pure at boundary', () => {
    const rows = filterKnowableGeoObservations(BEFORE_LEAK, [
      mapExternalGeoObservation(DEMO_FACTORY_NTL),
      mapExternalGeoObservation(DEMO_FUTURE_LEAKING_OBS),
    ]);
    assert.equal(rows.length, 1);
  });
});
