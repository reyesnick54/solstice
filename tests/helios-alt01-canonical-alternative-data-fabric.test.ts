/**
 * HELIOS ALT01 — canonical alternative-data intelligence fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  ALTERNATIVE_DATA_SIGNAL_FAMILIES,
  HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED,
  assertAlternativeDataKnowableAtDecision,
  assertNoBackfillBeforeHistoricalAvailability,
  createAlternativeDataIntelligenceFabric,
  delayedProviderObservationFixture,
  evaluateAlt01Qualification,
  illegalBackfillObservationFixture,
  wave5CategoryToSignalFamily,
  wave6CategoryToSignalFamily,
  workforceObservationFollowOnFixture,
  workforceObservationInitialFixture,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';
import {
  createPointInTimeAlternativeDataFabric,
  evaluateAlt01FabricQualification,
  HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED,
} from '../packages/platform/src/helios/feature-fabric/alternative-data/index.ts';

const BEFORE_WORKFORCE = asUtcInstant('2026-02-02T08:00:00.000Z');
const AFTER_WORKFORCE = asUtcInstant('2026-02-02T12:00:00.000Z');
const BEFORE_GEOSPATIAL = asUtcInstant('2026-01-20T13:00:00.000Z');
const AFTER_GEOSPATIAL = asUtcInstant('2026-01-20T15:00:00.000Z');

describe('HELIOS ALT01 canonical alternative-data fabric', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('declares twenty signal families', () => {
    assert.equal(ALTERNATIVE_DATA_SIGNAL_FAMILIES.length, 20);
    assert.equal(wave6CategoryToSignalFamily('jobs_skills'), 'WORKFORCE');
    assert.equal(wave5CategoryToSignalFamily('geospatial'), 'GEOSPATIAL');
  });

  it('knowableAt <= decisionTime — workforce invisible before arrival', () => {
    const fabric = createAlternativeDataIntelligenceFabric();
    const obs = fabric.ingestObservation(workforceObservationInitialFixture());
    const before = fabric.compilePlane({ evaluationTime: BEFORE_WORKFORCE });
    const after = fabric.compilePlane({ evaluationTime: AFTER_WORKFORCE });
    assert.equal(before.observations.length, 0);
    assert.equal(after.observations.length, 1);
    assert.equal(after.observations[0]!.observationId, obs.observationId);
    assert.equal(after.grantsExecutionAuthority, false);
  });

  it('rejects illegal backfill before historical availability', () => {
    const fabric = createPointInTimeAlternativeDataFabric();
    const result = fabric.ingestObservation(illegalBackfillObservationFixture());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'BACKFILL_BEFORE_AVAILABILITY');
  });

  it('delayed geospatial provider — not knowable before providerAvailableAt', () => {
    const fabric = createAlternativeDataIntelligenceFabric();
    fabric.ingestObservation(delayedProviderObservationFixture());
    const before = fabric.compilePlane({ evaluationTime: BEFORE_GEOSPATIAL });
    const after = fabric.compilePlane({ evaluationTime: AFTER_GEOSPATIAL });
    assert.equal(before.observations.length, 0);
    assert.equal(after.observations.length, 1);
    assert.equal(after.temporalObservations[0]!.kind, 'ALT_DATA');
  });

  it('feature momentum uses only knowable observations', () => {
    const fabric = createAlternativeDataIntelligenceFabric();
    fabric.ingestObservation(workforceObservationInitialFixture());
    fabric.ingestObservation(workforceObservationFollowOnFixture());
    const mid = fabric.compilePlane({ evaluationTime: AFTER_WORKFORCE });
    const late = fabric.compilePlane({ evaluationTime: asUtcInstant('2026-03-03T00:00:00.000Z') });
    const midFeature = mid.features.find((row) => row.featureId === 'alt01.workforce_posting_momentum');
    const lateFeature = late.features.find((row) => row.featureId === 'alt01.workforce_posting_momentum');
    assert.equal(midFeature?.valueMinor, null);
    assert.equal(lateFeature?.valueMinor, 15_000n);
  });

  it('coverage tensor digest emitted per provider family', () => {
    const fabric = createAlternativeDataIntelligenceFabric();
    fabric.ingestObservation(workforceObservationInitialFixture());
    const plane = fabric.compilePlane({ evaluationTime: AFTER_WORKFORCE });
    assert.equal(plane.coverageStates.length, 1);
    assert.ok(plane.coverageStates[0]!.tensorDigest);
  });

  it('revision ledger append on fabric ingest', () => {
    const fabric = createPointInTimeAlternativeDataFabric();
    const ok = fabric.ingestObservation(workforceObservationInitialFixture());
    assert.equal(ok.ok, true);
    assert.equal(fabric.revisionLedger().list().length, 1);
  });

  it('qualifies HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED', () => {
    const fabric = createAlternativeDataIntelligenceFabric();
    fabric.ingestObservation(workforceObservationInitialFixture());
    const plane = fabric.compilePlane({ evaluationTime: AFTER_WORKFORCE });
    const obs = plane.observations[0]!;
    const pit = assertAlternativeDataKnowableAtDecision(AFTER_WORKFORCE, obs);
    assert.equal(pit.ok, true);
    const backfill = assertNoBackfillBeforeHistoricalAvailability(obs);
    assert.equal(backfill.ok, true);

    const qualification = evaluateAlt01Qualification({
      signalFamiliesDeclared: ALTERNATIVE_DATA_SIGNAL_FAMILIES.length === 20,
      knowableAtRespected: plane.observations.every((row) =>
        assertAlternativeDataKnowableAtDecision(AFTER_WORKFORCE, row).ok,
      ),
      noBackfillBeforeAvailability: true,
      noExecutionAuthority: plane.grantsExecutionAuthority === false,
      extendsExternalDataPlane: true,
      extendsFeatureFabric: true,
      entityResolutionBound: obs.entityLink.canonicalEntityId !== null,
      coverageTensorEmitted: plane.coverageStates.length > 0,
      revisionLedgerCompatible: true,
      authorityReferenceOnly: plane.authorityClass === 'REFERENCE_AND_RESEARCH_ONLY',
    });
    assert.equal(qualification.marker, HELIOS_ALT01_CANONICAL_FABRIC_QUALIFIED, qualification.blockers.join('; '));
  });

  it('qualifies fabric slice HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED', () => {
    const fabric = createPointInTimeAlternativeDataFabric();
    fabric.ingestObservation(workforceObservationInitialFixture());
    const plane = fabric.compileFeaturePlane({ evaluationTime: AFTER_WORKFORCE });
    const qualification = evaluateAlt01FabricQualification({
      pitObservationsFiltered: plane.observations.length === 1,
      altDataTemporalKind: plane.temporalObservations.every((row) => row.kind === 'ALT_DATA'),
      revisionLedgerAppend: fabric.revisionLedger().list().length === 1,
      noExecutionAuthority: plane.grantsExecutionAuthority === false,
      entityLinkPresent: plane.observations[0]!.entityLink.canonicalEntityId !== null,
    });
    assert.equal(
      qualification.marker,
      HELIOS_ALT01_POINT_IN_TIME_ALTERNATIVE_DATA_QUALIFIED,
      qualification.blockers.join('; '),
    );
  });
});
