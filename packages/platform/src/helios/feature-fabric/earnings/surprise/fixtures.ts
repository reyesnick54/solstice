import { asUtcInstant } from '@solstice/domain';
import { buildPreReleaseExpectationSnapshot } from './expectation.ts';
import { buildEarningsSurpriseTensor } from './tensor.ts';
import { buildEarningsSurpriseVector } from './vector.ts';
import type { BuildSurpriseTensorInput, PreReleaseExpectationSnapshot } from './types.ts';

export const EARN03_FIXTURE_ENTITY = 'ENTITY:US:AAPL:XNYS' as const;
export const EARN03_FIXTURE_PERIOD = '2026-Q1' as const;

const PRE_EVENT_CUTOFF = asUtcInstant('2026-04-28T20:59:00.000Z');
const CONSENSUS_KNOWABLE = asUtcInstant('2026-04-28T20:00:00.000Z');
const ACTUAL_KNOWABLE = asUtcInstant('2026-04-28T21:05:00.000Z');
const EVAL_AFTER_RELEASE = asUtcInstant('2026-04-28T21:30:00.000Z');

export function earn03OperatingBeatExpectationFixture(): PreReleaseExpectationSnapshot {
  return buildPreReleaseExpectationSnapshot({
    snapshotId: 'earn03:fixture:expectation:2026-q1',
    canonicalEntityId: EARN03_FIXTURE_ENTITY,
    fiscalPeriod: EARN03_FIXTURE_PERIOD,
    cutoffUtc: PRE_EVENT_CUTOFF,
    points: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 150n,
        valueScaled: null,
        knowableAt: CONSENSUS_KNOWABLE,
        observationRef: 'consensus:eps:2026-q1',
        source: 'STREET_CONSENSUS',
      }),
      Object.freeze({
        dimension: 'REVENUE',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 94_000_000_000_00n,
        valueScaled: null,
        knowableAt: CONSENSUS_KNOWABLE,
        observationRef: 'consensus:rev:2026-q1',
        source: 'STREET_CONSENSUS',
      }),
    ]),
    dispersions: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        dispersionMinor: 10n,
        dispersionScaled: null,
        medianMinor: 150n,
        medianScaled: null,
        knowableAt: CONSENSUS_KNOWABLE,
        source: 'STREET_CONSENSUS',
      }),
      Object.freeze({
        dimension: 'REVENUE',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        dispersionMinor: 500_000_000_00n,
        dispersionScaled: null,
        medianMinor: 94_000_000_000_00n,
        medianScaled: null,
        knowableAt: CONSENSUS_KNOWABLE,
        source: 'STREET_CONSENSUS',
      }),
    ]),
  });
}

export function earn03BuybackBeatExpectationFixture(): PreReleaseExpectationSnapshot {
  return earn03OperatingBeatExpectationFixture();
}

export function earn03OperatingBeatTensorFixture() {
  const expectationSnapshot = earn03OperatingBeatExpectationFixture();
  const input: BuildSurpriseTensorInput = Object.freeze({
    canonicalEntityId: EARN03_FIXTURE_ENTITY,
    fiscalPeriod: EARN03_FIXTURE_PERIOD,
    evaluationTimeUtc: EVAL_AFTER_RELEASE,
    expectationSnapshot,
    preEventPriceMinor: 180_00n,
    actuals: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 151n,
        valueScaled: null,
        knowableAt: ACTUAL_KNOWABLE,
        observationRef: 'actual:eps:2026-q1',
      }),
      Object.freeze({
        dimension: 'REVENUE',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 94_200_000_000_00n,
        valueScaled: null,
        knowableAt: ACTUAL_KNOWABLE,
        observationRef: 'actual:rev:2026-q1',
      }),
    ]),
    seasonalHistory: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        quarterlyDeltasMinor: Object.freeze([8n, 10n, 9n, 11n, 12n]),
        quarterlyDeltasScaled: Object.freeze([]),
      }),
    ]),
    reportedEpsBeatMinor: 1n,
    beatQualityLines: Object.freeze([
      Object.freeze({ driver: 'REVENUE', epsImpactMinor: 1n, evidenceRef: 'bridge:rev' }),
    ]),
    peerGroups: Object.freeze({
      INDUSTRY_RELATIVE: Object.freeze({
        groupId: 'GICS4510',
        peerStandardizedByKey: Object.freeze({
          'EPS|CONSENSUS_DISPERSION_SUE|STREET_CONSENSUS': 50,
        }),
      }),
    }),
  });
  const tensor = buildEarningsSurpriseTensor(input);
  const vector = buildEarningsSurpriseVector({ vectorId: 'earn03:fixture:vector', tensor });
  return Object.freeze({ tensor, vector, input });
}

export function earn03BuybackBeatTensorFixture() {
  const expectationSnapshot = earn03BuybackBeatExpectationFixture();
  const input: BuildSurpriseTensorInput = Object.freeze({
    canonicalEntityId: EARN03_FIXTURE_ENTITY,
    fiscalPeriod: EARN03_FIXTURE_PERIOD,
    evaluationTimeUtc: EVAL_AFTER_RELEASE,
    expectationSnapshot,
    preEventPriceMinor: 180_00n,
    actuals: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 151n,
        valueScaled: null,
        knowableAt: ACTUAL_KNOWABLE,
        observationRef: 'actual:eps:2026-q1',
      }),
    ]),
    reportedEpsBeatMinor: 1n,
    beatQualityLines: Object.freeze([
      Object.freeze({ driver: 'SHARE_COUNT', epsImpactMinor: 1n, evidenceRef: 'bridge:buyback' }),
    ]),
  });
  return Object.freeze({ tensor: buildEarningsSurpriseTensor(input), input });
}

export function earn03FutureExpectationLeakFixture(): PreReleaseExpectationSnapshot {
  return buildPreReleaseExpectationSnapshot({
    snapshotId: 'earn03:fixture:leak',
    canonicalEntityId: EARN03_FIXTURE_ENTITY,
    fiscalPeriod: EARN03_FIXTURE_PERIOD,
    cutoffUtc: PRE_EVENT_CUTOFF,
    points: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        valueMinor: 150n,
        valueScaled: null,
        knowableAt: ACTUAL_KNOWABLE,
        observationRef: 'consensus:late',
        source: 'STREET_CONSENSUS',
      }),
    ]),
    dispersions: Object.freeze([
      Object.freeze({
        dimension: 'EPS',
        segmentId: null,
        fiscalPeriod: EARN03_FIXTURE_PERIOD,
        dispersionMinor: 10n,
        dispersionScaled: null,
        medianMinor: 150n,
        medianScaled: null,
        knowableAt: ACTUAL_KNOWABLE,
        source: 'STREET_CONSENSUS',
      }),
    ]),
  });
}

export const earn03FixtureTimes = Object.freeze({
  PRE_EVENT_CUTOFF,
  CONSENSUS_KNOWABLE,
  ACTUAL_KNOWABLE,
  EVAL_AFTER_RELEASE,
});
