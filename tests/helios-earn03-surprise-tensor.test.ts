/**
 * HELIOS EARN03 — multi-dimensional earnings surprise tensor.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import {
  assertNoMixedSourceScalar,
  buildPreReleaseExpectationSnapshot,
  evaluateEarn03Qualification,
  earn03BuybackBeatTensorFixture,
  earn03FixtureTimes,
  earn03OperatingBeatTensorFixture,
  HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED,
  isOperatingQualityDriver,
  vectorSlotId,
} from '../packages/platform/src/helios/feature-fabric/earnings/surprise/index.ts';

describe('HELIOS EARN03 earnings surprise tensor', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('computes independent EPS and revenue surprises from street consensus', () => {
    const { tensor, vector } = earn03OperatingBeatTensorFixture();
    const epsSue = tensor.cells.find(
      (cell) =>
        cell.key.dimension === 'EPS' &&
        cell.key.method === 'CONSENSUS_DISPERSION_SUE' &&
        cell.key.expectationSource === 'STREET_CONSENSUS',
    );
    assert.equal(epsSue?.calculable, true);
    assert.equal(epsSue?.rawDeltaMinor, 1n);
    assert.equal(epsSue?.standardizedScaled, 1000);

    const revSue = tensor.cells.find(
      (cell) =>
        cell.key.dimension === 'REVENUE' &&
        cell.key.method === 'CONSENSUS_DISPERSION_SUE' &&
        cell.key.expectationSource === 'STREET_CONSENSUS',
    );
    assert.equal(revSue?.calculable, true);
    assert.equal(revSue?.rawDeltaMinor, 200_000_000_00n);

    assert.ok(vector.orderedSlots.length > 0);
    assert.equal(vector.orderedSlots.some((slot) => 'compositeScalar' in (slot as object)), false);
  });

  it('distinguishes operating beat quality from buyback-driven beat', () => {
    const operating = earn03OperatingBeatTensorFixture().tensor.beatQuality;
    const buyback = earn03BuybackBeatTensorFixture().tensor.beatQuality;
    assert.ok(operating);
    assert.ok(buyback);
    assert.equal(operating.dominantDriver, 'REVENUE');
    assert.equal(buyback.dominantDriver, 'SHARE_COUNT');
    assert.ok(operating.operatingQualityScoreScaled > buyback.operatingQualityScoreScaled);
    assert.equal(isOperatingQualityDriver('SHARE_COUNT'), false);
  });

  it('binds surprises to pre-release expectation snapshot', () => {
    const { tensor } = earn03OperatingBeatTensorFixture();
    assert.ok(Date.parse(tensor.expectationSnapshot.knowableAt) <= Date.parse(earn03FixtureTimes.ACTUAL_KNOWABLE));
    for (const cell of tensor.cells) {
      assert.equal(cell.quality.expectationSnapshotId, tensor.expectationSnapshot.snapshotId);
      assert.equal(cell.quality.expectationSource, cell.key.expectationSource);
    }
  });

  it('rejects conflicting expectation sources for the same dimension', () => {
    assert.throws(() =>
      buildPreReleaseExpectationSnapshot({
        snapshotId: 'conflict',
        canonicalEntityId: 'ENTITY:TEST',
        fiscalPeriod: '2026-Q1',
        cutoffUtc: earn03FixtureTimes.PRE_EVENT_CUTOFF,
        points: Object.freeze([
          Object.freeze({
            dimension: 'EPS',
            segmentId: null,
            fiscalPeriod: '2026-Q1',
            valueMinor: 100n,
            valueScaled: null,
            knowableAt: earn03FixtureTimes.CONSENSUS_KNOWABLE,
            observationRef: 'a',
            source: 'STREET_CONSENSUS',
          }),
          Object.freeze({
            dimension: 'EPS',
            segmentId: null,
            fiscalPeriod: '2026-Q1',
            valueMinor: 101n,
            valueScaled: null,
            knowableAt: earn03FixtureTimes.CONSENSUS_KNOWABLE,
            observationRef: 'b',
            source: 'COMPANY_GUIDANCE',
          }),
        ]),
        dispersions: Object.freeze([]),
      }),
    );
  });

  it('rejects future expectations at cutoff (AAF)', () => {
    assert.throws(() =>
      buildPreReleaseExpectationSnapshot({
        snapshotId: 'future',
        canonicalEntityId: 'ENTITY:TEST',
        fiscalPeriod: '2026-Q1',
        cutoffUtc: earn03FixtureTimes.PRE_EVENT_CUTOFF,
        points: Object.freeze([
          Object.freeze({
            dimension: 'EPS',
            segmentId: null,
            fiscalPeriod: '2026-Q1',
            valueMinor: 100n,
            valueScaled: null,
            knowableAt: earn03FixtureTimes.ACTUAL_KNOWABLE,
            observationRef: 'late',
            source: 'STREET_CONSENSUS',
          }),
        ]),
        dispersions: Object.freeze([]),
      }),
    );
  });

  it('rejects mixed-source scalar weighting', () => {
    const { vector } = earn03OperatingBeatTensorFixture();
    const slot = vector.orderedSlots[0]!;
    const check = assertNoMixedSourceScalar(
      Object.freeze({
        [vectorSlotId(slot)]: 0.5,
        'EPS|consolidated|CONSENSUS_DISPERSION_SUE|COMPANY_GUIDANCE': 0.5,
      }),
      Object.freeze([
        slot,
        Object.freeze({
          cellKey: Object.freeze({
            dimension: 'EPS',
            segmentId: null,
            method: 'CONSENSUS_DISPERSION_SUE',
            expectationSource: 'COMPANY_GUIDANCE',
          }),
          decomposition: slot.decomposition,
        }),
      ]),
    );
    assert.equal(check.ok, false);
    if (check.ok) return;
    assert.equal(check.code, 'SOURCE_MIXING_REJECTED');
  });

  it('qualification marker', () => {
    const result = evaluateEarn03Qualification({
      multiDimensionSurpriseComputed: true,
      explicitExpectationSources: true,
      noSilentSourceMixing: true,
      preReleaseExpectationBound: true,
      beatQualityDistinguishesOperatingVsFinancial: true,
      vectorHasNoUniversalScalar: true,
      peerNormalizationSupported: true,
      futureExpectationRejected: true,
      noExecutionAuthority: true,
    });
    assert.equal(result.marker, HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
