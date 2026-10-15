/**
 * HELIOS AAF10 — point-in-time macroeconomic + event intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  createDefaultAdapterStates,
  fetchMacroIndicators,
} from '../packages/external-data/src/adapters.ts';
import {
  HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED,
  buildM13MacroRegimeInputs,
  createPointInTimeMacroIntelligenceFabric,
  delayedCpiReleaseFixture,
  evaluateAaf10Qualification,
  januaryCpiInitialReleaseFixture,
  januaryCpiMarchRevisionFixture,
  normalizeMacroReleaseInstant,
  policyRateFixture,
  resolveSeriesKeyFromProviderId,
  staleCpiFixture,
  treasuryYieldsFixture,
  unemploymentSeriesFixture,
  conflictingCpiOfficialFixture,
  scheduledCpiPlaceholderFixture,
} from '../packages/platform/src/helios/feature-fabric/macro-intelligence/index.ts';
import { selectKnowableRevisionAt } from '../packages/platform/src/helios/feature-fabric/revision-ledger/index.ts';
import { createMacroEventIntelligenceFabric } from '../packages/platform/src/helios/multi-asset/index.ts';
const JAN_DECISION = asUtcInstant('2026-01-31T16:00:00.000Z');
const FEB_AFTER_INITIAL = asUtcInstant('2026-02-15T10:00:00.000Z');
const MARCH_AFTER_REVISION = asUtcInstant('2026-03-29T10:00:00.000Z');
const BEFORE_DELAYED = asUtcInstant('2026-02-12T14:00:00.000Z');
const AFTER_DELAYED = asUtcInstant('2026-02-12T16:00:00.000Z');
const STALE_EVAL = asUtcInstant('2026-09-01T12:00:00.000Z');

describe('HELIOS AAF10 point-in-time macro intelligence', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('initial release versus revision — March revision never visible in January', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    fabric.ingestReading(januaryCpiInitialReleaseFixture());
    fabric.ingestReading(januaryCpiMarchRevisionFixture());

    const janPlane = fabric.compileFeaturePlane({
      evaluationTime: JAN_DECISION,
      revisionPolicy: 'LATEST_KNOWABLE_REVISION',
    });
    assert.equal(janPlane.observations.length, 0);

    const febPlane = fabric.compileFeaturePlane({
      evaluationTime: FEB_AFTER_INITIAL,
      revisionPolicy: 'LATEST_KNOWABLE_REVISION',
    });
    const febCpi = febPlane.observations.find((row) => row.metadata.seriesKey === 'cpi');
    assert.equal(febCpi?.valueMinor, 323_000n);
    assert.equal(febCpi?.revisionSequence, 0);

    const marPlane = fabric.compileFeaturePlane({
      evaluationTime: MARCH_AFTER_REVISION,
      revisionPolicy: 'LATEST_KNOWABLE_REVISION',
    });
    const marCpi = marPlane.observations.find((row) => row.metadata.seriesKey === 'cpi');
    assert.equal(marCpi?.valueMinor, 323_500n);
    assert.equal(marCpi?.revisionSequence, 1);

    const ledger = fabric.revisionLedger();
    const atJan = selectKnowableRevisionAt(
      ledger.listChain('chain.cpi.2026-01'),
      JAN_DECISION,
      'LATEST_KNOWABLE_REVISION',
    );
    assert.equal(atJan, null);
  });

  it('delayed release is not knowable before provider arrival', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    fabric.ingestReading(delayedCpiReleaseFixture());
    const before = fabric.compileFeaturePlane({ evaluationTime: BEFORE_DELAYED });
    const after = fabric.compileFeaturePlane({ evaluationTime: AFTER_DELAYED });
    assert.equal(before.observations.length, 0);
    assert.equal(after.observations.length, 1);
  });

  it('missing release — surprise unavailable without certified expectation', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    const plane = fabric.compileFeaturePlane({ evaluationTime: FEB_AFTER_INITIAL });
    const surprise = plane.features.find((row) => row.featureId === 'aaf10.release_surprise');
    assert.equal(surprise?.valueText, 'CONSENSUS_UNAVAILABLE');
    assert.equal(surprise?.quality, 'UNAVAILABLE');
  });

  it('provider outage degrades macro plane (empty external plane)', () => {
    const states = createDefaultAdapterStates();
    const fred = states.get('fred');
    assert.ok(fred);
    states.set('fred', { ...fred!, down: true });
    const observations = fetchMacroIndicators({
      nowUtc: '2026-08-30T12:00:00.000Z',
      states,
    });
    assert.equal(observations.length, 0);
  });

  it('conflicting official/reference sources are detected on ingest', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    const first = fabric.ingestReading(januaryCpiInitialReleaseFixture());
    const conflict = fabric.ingestReading(conflictingCpiOfficialFixture());
    assert.equal(first.ok, true);
    assert.equal(conflict.ok, true);
    if (!conflict.ok) return;
    assert.ok(conflict.conflicts.length >= 1);
  });

  it('stale series produces degraded inflation trend feature', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    fabric.ingestReading(staleCpiFixture());
    const plane = fabric.compileFeaturePlane({ evaluationTime: STALE_EVAL });
    const inflation = plane.features.find((row) => row.featureId === 'aaf10.inflation_trend');
    assert.equal(inflation?.quality, 'DEGRADED_STALE');
  });

  it('time-zone normalization converts US/Eastern release to UTC', () => {
    const utc = normalizeMacroReleaseInstant('2026-02-12T08:30:00.000', 300);
    assert.equal(utc, '2026-02-12T13:30:00.000Z');
  });

  it('scheduled event followed by actual publication via M14 bridge', () => {
    const scheduled = asUtcInstant('2026-02-12T13:30:00.000Z');
    const m14 = createMacroEventIntelligenceFabric();
    const fabric = createPointInTimeMacroIntelligenceFabric({
      macroEventFabric: m14,
      syncM14OnIngest: true,
    });
    fabric.ingestReading(
      scheduledCpiPlaceholderFixture(scheduled),
    );
    fabric.ingestReading(
      januaryCpiInitialReleaseFixture(),
    );
    const stored = m14.store().list();
    assert.ok(stored.length >= 1);
    const observed = stored.find((row) => row.artifact.eventType === 'observed_release');
    assert.ok(observed);
  });

  it('point-in-time regime input bundle for M13', () => {
    const at = asUtcInstant('2026-03-01T12:00:00.000Z');
    const fabric = createPointInTimeMacroIntelligenceFabric();
    fabric.ingestReading(
      Object.freeze({
        ...unemploymentSeriesFixture(at, 420n, 'obs.u1'),
        periodEnd: asUtcInstant('2026-02-28T23:59:59.000Z'),
        revisionChainId: 'chain.unrate.2026-02',
      }),
    );
    fabric.ingestReading(
      Object.freeze({
        ...unemploymentSeriesFixture(asUtcInstant('2026-02-01T12:00:00.000Z'), 400n, 'obs.u0'),
        periodEnd: asUtcInstant('2026-01-31T23:59:59.000Z'),
        revisionChainId: 'chain.unrate.2026-01',
      }),
    );
    for (const row of treasuryYieldsFixture(at)) {
      fabric.ingestReading(row);
    }
    fabric.ingestReading(
      Object.freeze({
        ...policyRateFixture(at, 525n, 'obs.pr1'),
        periodEnd: asUtcInstant('2026-03-01T00:00:00.000Z'),
        knowableAt: at,
        revisionChainId: 'chain.fedfunds.2026-03',
      }),
    );
    fabric.ingestReading(
      Object.freeze({
        ...policyRateFixture(asUtcInstant('2026-02-01T12:00:00.000Z'), 500n, 'obs.pr0'),
        periodEnd: asUtcInstant('2026-02-01T00:00:00.000Z'),
        knowableAt: asUtcInstant('2026-02-01T12:00:00.000Z'),
        revisionChainId: 'chain.fedfunds.2026-02',
      }),
    );
    fabric.ingestReading(januaryCpiInitialReleaseFixture());
    fabric.ingestReading(
      Object.freeze({
        ...januaryCpiInitialReleaseFixture(),
        observationRef: 'obs.cpi.dec',
        periodEnd: asUtcInstant('2025-12-31T23:59:59.000Z'),
        valueMinor: 320_000n,
        knowableAt: asUtcInstant('2026-01-15T12:00:00.000Z'),
        revisionChainId: 'chain.cpi.2025-12',
      }),
    );

    const plane = fabric.compileFeaturePlane({ evaluationTime: at });
    const bundle = buildM13MacroRegimeInputs({
      evaluationTime: at,
      features: plane.features,
      highImpactReleaseActive: false,
    });
    assert.equal(bundle.grantsExecutionAuthority, false);
    assert.equal(bundle.unemploymentTrendBps, 20n);
    assert.equal(bundle.yieldCurveSlopeBps, 38n);
    assert.equal(bundle.rateChangeState, 'TIGHTENING');
    assert.ok(bundle.evidenceRefs.length > 0);
    const regimeFeature = plane.features.find((row) => row.featureId === 'aaf10.macro_regime_inputs');
    assert.ok(regimeFeature?.valueText);
  });

  it('wave2 macro provider catalog maps FRED series ids', () => {
    assert.equal(resolveSeriesKeyFromProviderId({ providerId: 'fred', seriesId: 'CPIAUCSL' }), 'cpi');
    assert.equal(resolveSeriesKeyFromProviderId({ providerId: 'fred', seriesId: 'UNRATE' }), 'unemployment');
  });

  it('qualification marker when all checks pass', () => {
    const result = evaluateAaf10Qualification({
      initialVsRevisionSafe: true,
      delayedReleaseKnowable: true,
      missingReleaseSurpriseUnavailable: true,
      providerOutageDegrades: true,
      conflictingSourceDetected: true,
      staleSeriesDegraded: true,
      timezoneNormalizationUtc: true,
      scheduledThenPublishedEvent: true,
      pointInTimeRegimeInput: true,
      noExecutionAuthority: true,
    });
    assert.equal(result.marker, HELIOS_AAF10_POINT_IN_TIME_MACRO_INTELLIGENCE_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('feature plane never grants execution authority', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    fabric.ingestReading(januaryCpiInitialReleaseFixture());
    const plane = fabric.compileFeaturePlane({ evaluationTime: FEB_AFTER_INITIAL });
    assert.equal(plane.grantsExecutionAuthority, false);
    for (const feature of plane.features) {
      assert.equal(feature.grantsExecutionAuthority, false);
    }
  });

  it('AAF06 revision ledger rejects duplicate revision records', () => {
    const fabric = createPointInTimeMacroIntelligenceFabric();
    assert.equal(fabric.ingestReading(januaryCpiInitialReleaseFixture()).ok, true);
    const duplicate = fabric.ingestReading(januaryCpiInitialReleaseFixture());
    assert.equal(duplicate.ok, false);
    if (duplicate.ok) return;
    assert.equal(duplicate.code, 'DUPLICATE_OBSERVATION');
  });
});
