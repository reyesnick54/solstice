/**
 * HELIOS MD08 — derivatives market data intelligence qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  applyMd08IncrementalBookUpdate,
  applyMd08RecoveryBookSnapshot,
  buildDerivativeMarketState,
  buildMd08QualificationChecksFromState,
  createMd08DerivativesFeedTransport,
  evaluateMd08DerivativesQualification,
  HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED,
  MD08_DERIVED_IV_LABEL,
  MD08_FIXTURE_EVAL_TIME,
  MD08_FIXTURE_FUTURES,
  MD08_FIXTURE_OPTIONS,
  MD08_FIXTURE_UNDERLYING_SPOT,
  MD08_ESZ2026_ID,
} from '../packages/platform/src/helios/market-data/index.ts';

describe('HELIOS MD08 derivatives market data', () => {
  it('stays in simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('builds futures and options contract state with OBSERVED vs DERIVED provenance', () => {
    const state = buildDerivativeMarketState({
      snapshotId: 'md08-test-1',
      evaluatedAt: MD08_FIXTURE_EVAL_TIME,
      futures: MD08_FIXTURE_FUTURES,
      options: MD08_FIXTURE_OPTIONS,
      underlyingSpotById: MD08_FIXTURE_UNDERLYING_SPOT,
      riskFreeRate: 0.045,
      feedTransport: null,
    });
    assert.equal(state.futures.length, 3);
    assert.equal(state.options.length, 2);
    const call = state.options.find((row) => row.right === 'CALL');
    assert.ok(call?.derivedImpliedVolatility);
    assert.equal(call!.derivedImpliedVolatility!.provenance.kind, 'DERIVED');
    assert.equal(call!.derivedImpliedVolatility!.label, MD08_DERIVED_IV_LABEL);
    assert.equal(call!.derivedImpliedVolatility!.provenance.notExchangeObserved, true);
    assert.equal(call!.quote.bidProvenance.kind, 'OBSERVED');
    const put = state.options.find((row) => row.right === 'PUT');
    assert.equal(put!.exchangeIvProvenance?.kind, 'OBSERVED');
    assert.ok(put!.researchGreeks?.researchOnly);
  });

  it('derives futures term structure with contango and calendar spread', () => {
    const state = buildDerivativeMarketState({
      snapshotId: 'md08-test-2',
      evaluatedAt: MD08_FIXTURE_EVAL_TIME,
      futures: MD08_FIXTURE_FUTURES,
      options: [],
      underlyingSpotById: {},
      riskFreeRate: 0.04,
      feedTransport: null,
    });
    const es = state.termStructures.find((row) => row.rootSymbol === 'ES');
    assert.ok(es);
    assert.equal(es!.shape, 'CONTANGO');
    assert.ok(es!.calendarSpread);
    assert.equal(es!.calendarSpread!.provenance.kind, 'DERIVED');
  });

  it('supports CME-style dual/incremental/recovery through MD03', () => {
    const book = MD08_FIXTURE_FUTURES[0]!.book!;
    const sessionId = 'cme-sess-md08';
    let transport = createMd08DerivativesFeedTransport({
      primaryFeedId: 'CME:MDP3:PRIMARY',
      secondaryFeedId: 'CME:MDP3:SECONDARY',
      sessionId,
      startedAt: MD08_FIXTURE_EVAL_TIME,
    });
    transport = applyMd08IncrementalBookUpdate(transport, {
      feedRole: 'PRIMARY',
      instrumentId: MD08_ESZ2026_ID,
      sequence: 1,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      book,
      sessionId,
    });
    transport = applyMd08IncrementalBookUpdate(transport, {
      feedRole: 'SECONDARY',
      instrumentId: MD08_ESZ2026_ID,
      sequence: 1,
      knowableAt: MD08_FIXTURE_EVAL_TIME,
      book,
      sessionId,
    });
    const gap = applyMd08IncrementalBookUpdate(transport, {
      feedRole: 'PRIMARY',
      instrumentId: MD08_ESZ2026_ID,
      sequence: 3,
      knowableAt: asUtcInstant('2026-09-15T18:00:01.000Z'),
      book,
      sessionId,
    });
    assert.equal(gap.primary.lastAppliedSequence, 1);
    transport = applyMd08RecoveryBookSnapshot(gap, {
      feedRole: 'PRIMARY',
      instrumentId: MD08_ESZ2026_ID,
      snapshotSequence: 10,
      knowableAt: asUtcInstant('2026-09-15T18:00:02.000Z'),
      book,
      sessionId,
      checksum: 'fixture-checksum',
    });
    assert.equal(transport.primary.lastAppliedSequence, 10);
    assert.ok(transport.booksByInstrument[MD08_ESZ2026_ID]);
  });

  it('emits HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED when checks pass', () => {
    const state = buildDerivativeMarketState({
      snapshotId: 'md08-qualify',
      evaluatedAt: MD08_FIXTURE_EVAL_TIME,
      futures: MD08_FIXTURE_FUTURES,
      options: MD08_FIXTURE_OPTIONS,
      underlyingSpotById: MD08_FIXTURE_UNDERLYING_SPOT,
      riskFreeRate: 0.045,
      feedTransport: null,
    });
    const checks = buildMd08QualificationChecksFromState(state, true);
    const result = evaluateMd08DerivativesQualification(checks);
    assert.equal(result.marker, HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED, result.blockers.join('; '));
  });
});
