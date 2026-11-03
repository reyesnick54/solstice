/**
 * HELIOS AAF04 — adversarial point-in-time feature compiler qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  asOfJoinOnSourceEvent,
  compileFeatureVector,
  compilePointInTimeDatasetManifest,
  evaluateAaf04Qualification,
  HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED,
  reproduceVectorsFromManifest,
  type FeatureCompilerContext,
  type FeatureDefinition,
  type TemporalObservation,
} from '../packages/platform/src/helios/feature-fabric/index.ts';
import {
  attachPointInTimeManifestToEvaluation,
  resolvePointInTimeVectorsForEvaluation,
} from '../packages/strategy-lab/src/evaluation/point-in-time-feature-fabric-seam.ts';

const ENTITY = 'ent_acme';
const INSTRUMENT = 'inst_acme';
const UNIVERSE_VERSION = 'univ_v1';
const ERES = 'eres_v1';

const DECISION = asUtcInstant('2026-03-15T21:00:00.000Z');
const MARKET_CLOSE = asUtcInstant('2026-03-15T20:00:00.000Z');
const EARNINGS_KNOWABLE = asUtcInstant('2026-03-15T21:30:00.000Z');

function baseContext(overrides?: Partial<FeatureCompilerContext>): FeatureCompilerContext {
  return Object.freeze({
    observations: Object.freeze([]),
    universeMembership: Object.freeze([]),
    tickerHistory: Object.freeze([]),
    corporateActionRevisions: Object.freeze([]),
    entityResolutionVersion: ERES,
    revisionPolicy: 'LATEST_KNOWABLE_REVISION',
    missingnessPolicy: 'FAIL_CLOSED',
    ...overrides,
  });
}

function obs(partial: TemporalObservation): TemporalObservation {
  return Object.freeze(partial);
}

function compile(
  featureDefinitions: readonly FeatureDefinition[],
  context: FeatureCompilerContext,
  decisionTime = DECISION,
) {
  return compileFeatureVector({
    entityId: ENTITY,
    instrumentId: INSTRUMENT,
    decisionTime,
    universeVersion: UNIVERSE_VERSION,
    featureDefinitions,
    context,
  });
}

const closeFeature: FeatureDefinition = Object.freeze({
  featureId: 'close_minor',
  version: '1',
  computeKind: 'AS_OF_SCALAR',
  observationKind: 'MARKET_BAR',
  instrumentId: INSTRUMENT,
});

describe('HELIOS AAF04 point-in-time feature compiler', () => {
  it('rejects earnings filing released after market close', () => {
    const result = compile(
      [
        Object.freeze({
          featureId: 'eps_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'CORPORATE_FILING',
          entityId: ENTITY,
        }),
      ],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'filing_future',
            kind: 'CORPORATE_FILING',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: MARKET_CLOSE,
            knowableAt: EARNINGS_KNOWABLE,
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: EARNINGS_KNOWABLE,
            valueMinor: 125_00n,
            metadata: Object.freeze({ form: '10-Q' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'LEAKAGE_DETECTED');
    assert.equal(result.error.leakageCode, 'FUTURE_OBSERVATION');
  });

  it('rejects macro revision not yet knowable at decision time', () => {
    const result = compile(
      [
        Object.freeze({
          featureId: 'cpi_yoy_bps',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MACRO_RELEASE',
          entityId: ENTITY,
        }),
      ],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'cpi_r0',
            kind: 'MACRO_RELEASE',
            entityId: ENTITY,
            instrumentId: null,
            sourceEventTime: asUtcInstant('2026-02-01T13:30:00.000Z'),
            knowableAt: asUtcInstant('2026-02-01T13:30:05.000Z'),
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 320n,
            metadata: Object.freeze({ series: 'CPI' }),
          }),
          obs({
            observationRef: 'cpi_r1',
            kind: 'MACRO_RELEASE',
            entityId: ENTITY,
            instrumentId: null,
            sourceEventTime: asUtcInstant('2026-02-01T13:30:00.000Z'),
            knowableAt: asUtcInstant('2026-03-16T12:00:00.000Z'),
            validUntil: null,
            revisionSequence: 1,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 280n,
            metadata: Object.freeze({ series: 'CPI', revision: '1' }),
          }),
        ]),
      }),
      asUtcInstant('2026-03-15T21:00:00.000Z'),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.features[0]?.valueMinor, 320n);
  });

  it('rejects future ticker metadata when it is the only candidate', () => {
    const result = compile(
      [
        Object.freeze({
          featureId: 'ticker_code',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'REFERENCE_METADATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
        }),
      ],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'ticker_new',
            kind: 'REFERENCE_METADATA',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: asUtcInstant('2026-04-01T00:00:00.000Z'),
            knowableAt: asUtcInstant('2026-04-01T09:00:00.000Z'),
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 1n,
            metadata: Object.freeze({ symbol: 'ACME2' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FUTURE_OBSERVATION');
  });

  it('rejects future index constituent knowledge', () => {
    const result = compile(
      [closeFeature],
      baseContext({
        indexId: 'idx_sp500',
        universeMembership: Object.freeze([
          Object.freeze({
            instrumentId: INSTRUMENT,
            indexId: 'idx_sp500',
            enteredKnowableAt: asUtcInstant('2026-04-01T00:00:00.000Z'),
            leftKnowableAt: null,
          }),
        ]),
        observations: Object.freeze([
          obs({
            observationRef: 'bar_1',
            kind: 'MARKET_BAR',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: MARKET_CLOSE,
            knowableAt: MARKET_CLOSE,
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 100_00n,
            metadata: Object.freeze({}),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FUTURE_CONSTITUENT');
  });

  it('rejects delayed provider feed', () => {
    const result = compile(
      [closeFeature],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'bar_delayed',
            kind: 'MARKET_BAR',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: MARKET_CLOSE,
            knowableAt: asUtcInstant('2026-03-16T08:00:00.000Z'),
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 100_00n,
            metadata: Object.freeze({ provider: 'delayed' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FUTURE_OBSERVATION');
  });

  it('rejects late-arriving alternative observation', () => {
    const result = compile(
      [
        Object.freeze({
          featureId: 'alt_signal',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'ALT_DATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
        }),
      ],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'alt_late',
            kind: 'ALT_DATA',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: MARKET_CLOSE,
            knowableAt: asUtcInstant('2026-03-16T02:00:00.000Z'),
            validUntil: null,
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 42n,
            metadata: Object.freeze({ vendor: 'alt' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FUTURE_OBSERVATION');
  });

  it('rejects revised corporate action not knowable at decision', () => {
    const result = compile(
      [
        Object.freeze({
          featureId: 'div_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'CORPORATE_ACTION',
          instrumentId: INSTRUMENT,
        }),
      ],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'div_rev1',
            kind: 'CORPORATE_ACTION',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: asUtcInstant('2026-03-10T00:00:00.000Z'),
            knowableAt: asUtcInstant('2026-03-20T00:00:00.000Z'),
            validUntil: null,
            revisionSequence: 1,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 50n,
            metadata: Object.freeze({ action: 'DIVIDEND' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FUTURE_OBSERVATION');
  });

  it('enforces rolling-window boundary without look-ahead', () => {
    const bars: TemporalObservation[] = [];
    for (let i = 0; i < 3; i += 1) {
      const at = asUtcInstant(`2026-03-${String(13 + i).padStart(2, '0')}T20:00:00.000Z`);
      bars.push(
        obs({
          observationRef: `bar_${String(i)}`,
          kind: 'MARKET_BAR',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: at,
          knowableAt: at,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: BigInt((i + 1) * 10),
          metadata: Object.freeze({}),
        }),
      );
    }
    const rollingFeature: FeatureDefinition = Object.freeze({
      featureId: 'roll_sum',
      version: '1',
      computeKind: 'ROLLING_SUM',
      observationKind: 'MARKET_BAR',
      instrumentId: INSTRUMENT,
      rollingWindow: 3,
    });
    const early = compile(
      [rollingFeature],
      baseContext({ observations: Object.freeze(bars) }),
      bars[1]!.knowableAt,
    );
    assert.equal(early.ok, false);
    const full = compile(
      [rollingFeature],
      baseContext({ observations: Object.freeze(bars) }),
      bars[2]!.knowableAt,
    );
    assert.equal(full.ok, true);
    if (!full.ok) return;
    assert.equal(full.value.features[0]?.valueMinor, 60n);
  });

  it('rejects forward-filled observations beyond configured validity', () => {
    const result = compile(
      [closeFeature],
      baseContext({
        observations: Object.freeze([
          obs({
            observationRef: 'bar_stale',
            kind: 'MARKET_BAR',
            entityId: ENTITY,
            instrumentId: INSTRUMENT,
            sourceEventTime: asUtcInstant('2026-03-10T20:00:00.000Z'),
            knowableAt: asUtcInstant('2026-03-10T20:00:00.000Z'),
            validUntil: asUtcInstant('2026-03-12T20:00:00.000Z'),
            revisionSequence: 0,
            periodEnd: null,
            publishedKnowableAt: null,
            valueMinor: 99_00n,
            metadata: Object.freeze({ forwardFilled: 'true' }),
          }),
        ]),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'FORWARD_FILL_BEYOND_VALIDITY');
  });

  it('reproduces feature vectors from PointInTimeDatasetManifest', () => {
    const bars: TemporalObservation[] = [];
    for (let i = 0; i < 3; i += 1) {
      const at = asUtcInstant(`2026-03-${String(13 + i).padStart(2, '0')}T20:00:00.000Z`);
      bars.push(
        obs({
          observationRef: `bar_${String(i)}`,
          kind: 'MARKET_BAR',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: at,
          knowableAt: at,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: BigInt((i + 1) * 100),
          metadata: Object.freeze({}),
        }),
      );
    }
    const decisionTimes = bars.map((row) => row.knowableAt);
    const dataset = compilePointInTimeDatasetManifest({
      strategyEvaluationId: 'eval_aaf04',
      decisionTimeRange: { start: decisionTimes[0]!, end: decisionTimes[2]! },
      universeVersion: UNIVERSE_VERSION,
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes,
      featureDefinitions: [closeFeature],
      context: baseContext({ observations: Object.freeze(bars) }),
    });
    assert.equal(dataset.ok, true);
    if (!dataset.ok) return;

    const reproduced = reproduceVectorsFromManifest({
      manifest: dataset.value.manifest,
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes,
      featureDefinitions: [closeFeature],
      context: baseContext({ observations: Object.freeze(bars) }),
    });
    assert.equal(reproduced.ok, true);
    if (!reproduced.ok) return;
    assert.deepEqual(
      reproduced.value.map((row) => row.features[0]?.valueMinor),
      dataset.value.vectors.map((row) => row.features[0]?.valueMinor),
    );

    const seamVectors = resolvePointInTimeVectorsForEvaluation({
      manifest: dataset.value.manifest,
      featureDefinitions: [closeFeature],
      context: baseContext({ observations: Object.freeze(bars) }),
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes,
    });
    assert.equal(seamVectors.length, 3);

    const config = attachPointInTimeManifestToEvaluation(
      {
        mode: 'CHRONOLOGICAL_REALISTIC',
        runKind: 'BACKTEST',
        partition: 'TRAIN',
        period: { start: decisionTimes[0]!, end: decisionTimes[2]! },
        startingCapitalMinor: 1_000_000n,
        latency: {
          zeroLatencyAssumed: false,
          decisionDelayMs: 250,
          executionDelayMs: 500,
          quoteStalenessMs: 0,
          feedEntitlement: 'SIMULATION',
        },
        costs: { spreadBps: 5, slippageBps: 2, commissionMinorPerShare: 0n },
        operatingResearchCostMinor: 0n,
        seed: 'aaf04',
        customerId: null,
      },
      {
        manifest: dataset.value.manifest,
        featureDefinitions: [closeFeature],
        context: baseContext({ observations: Object.freeze(bars) }),
        entityId: ENTITY,
        instrumentId: INSTRUMENT,
        decisionTimes,
      },
    );
    assert.ok(config.pointInTimeFeatureAttachment);
  });

  it('as-of join is deterministic on knowable time', () => {
    const left = [
      obs({
        observationRef: 'l1',
        kind: 'MARKET_BAR',
        entityId: ENTITY,
        instrumentId: INSTRUMENT,
        sourceEventTime: MARKET_CLOSE,
        knowableAt: MARKET_CLOSE,
        validUntil: null,
        revisionSequence: 0,
        periodEnd: null,
        publishedKnowableAt: null,
        valueMinor: 1n,
        metadata: Object.freeze({}),
      }),
    ];
    const right = [
      obs({
        observationRef: 'r1',
        kind: 'SCHEDULED_EVENT',
        entityId: ENTITY,
        instrumentId: INSTRUMENT,
        sourceEventTime: MARKET_CLOSE,
        knowableAt: asUtcInstant('2026-03-15T20:00:01.000Z'),
        validUntil: null,
        revisionSequence: 0,
        periodEnd: null,
        publishedKnowableAt: null,
        valueMinor: 2n,
        metadata: Object.freeze({}),
      }),
    ];
    const joined = asOfJoinOnSourceEvent(left, right, DECISION);
    assert.equal(joined.length, 1);
    assert.equal(joined[0]?.left.observationRef, 'l1');
    assert.equal(joined[0]?.right.observationRef, 'r1');
  });

  it('emits HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED when adversarial checks pass', () => {
    const qualification = evaluateAaf04Qualification({
      earningsAfterCloseRejected: true,
      macroRevisionRejected: true,
      tickerChangeRejected: true,
      futureIndexConstituentRejected: true,
      delayedProviderRejected: true,
      lateAltDataRejected: true,
      revisedCorporateActionRejected: true,
      rollingWindowBoundary: true,
      manifestReproducible: true,
      asOfJoinDeterministic: true,
    });
    assert.equal(qualification.marker, HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
