/**
 * HELIOS MD01 — canonical institutional market-data fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY,
  validateMarketDataEventEnvelope,
} from '../packages/provider-sdk/src/market-data-capability/canonical-events.ts';
import { EXTERNAL_DATA_MD01_CERTIFICATION_ANCHOR } from '../packages/external-data/src/certification/market-data/md01-events.ts';
import { EXCHANGE_MARKET_DATA_OBSERVATION_ONLY } from '../packages/sunrey-exchange/src/market-data/canonical-events.ts';
import {
  assertMarketEventKnowableAtDecision,
  createHeliosMarketDataFabric,
  evaluateMd01Qualification,
  HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED,
  MD01_CANONICAL_EVENT_KINDS,
  MD01_CANONICAL_OWNER_REUSE,
  MD01_EXPLICIT_NON_OWNERS,
  Md01ObservationBridge,
  md01DelayedQuoteFixture,
  md01QuoteEventFixture,
  md01TradeEventFixture,
  rejectKnowableFromEventTimeAlone,
} from '../packages/platform/src/helios/market-data/index.ts';
import { createPointInTimeMarketDataFabric } from '../packages/platform/src/helios/feature-fabric/market-data/index.ts';

const AFTER_EVENTS = asUtcInstant('2026-03-01T14:30:10.000Z');
const BEFORE_DELAYED = asUtcInstant('2026-03-01T14:30:04.000Z');

describe('HELIOS MD01 market-data fabric', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('declares thirteen canonical market event kinds', () => {
    assert.equal(CANONICAL_MARKET_DATA_EVENT_KINDS.length, 13);
    assert.deepEqual(MD01_CANONICAL_EVENT_KINDS, CANONICAL_MARKET_DATA_EVENT_KINDS);
  });

  it('envelope validation requires temporal and provenance fields', () => {
    const trade = md01TradeEventFixture();
    assert.deepEqual(validateMarketDataEventEnvelope(trade), []);
    assert.equal(trade.authority, MARKET_DATA_EVENT_AUTHORITY);
    assert.equal(MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY, false);
    assert.equal(EXCHANGE_MARKET_DATA_OBSERVATION_ONLY, MARKET_DATA_EVENT_AUTHORITY);
  });

  it('knowableAt gates compile plane', () => {
    const fabric = createHeliosMarketDataFabric();
    fabric.ingestEvent(md01TradeEventFixture());
    fabric.ingestEvent(md01DelayedQuoteFixture());
    const before = fabric.compilePlane({ evaluationTime: BEFORE_DELAYED });
    const after = fabric.compilePlane({ evaluationTime: AFTER_EVENTS });
    assert.equal(before.events.length, 1);
    assert.equal(after.events.length, 2);
    assert.equal(after.grantsExecutionAuthority, false);
  });

  it('knowableAt not inferred from event time alone', () => {
    const event = md01QuoteEventFixture();
    assert.equal(rejectKnowableFromEventTimeAlone(event), true);
    const pit = assertMarketEventKnowableAtDecision(AFTER_EVENTS, event);
    assert.equal(pit.ok, true);
  });

  it('feature fabric emits decimal mid quote without float money', () => {
    const fabric = createPointInTimeMarketDataFabric();
    fabric.ingest(md01TradeEventFixture());
    fabric.ingest(md01QuoteEventFixture());
    const plane = fabric.compileFeaturePlane({ evaluationTime: AFTER_EVENTS });
    const mid = plane.features.find((row) => row.featureId === 'md01.mid_quote');
    assert.equal(mid?.valueDecimal, '187.2500');
    assert.equal(plane.grantsExecutionAuthority, false);
  });

  it('observation bridge seals through H08 fabric', () => {
    const clock = new FrozenClock(asUtcInstant('2026-03-01T14:30:00.500Z'));
    const bridge = new Md01ObservationBridge(clock);
    const sealed = bridge.seal(md01TradeEventFixture());
    assert.equal(sealed.ok, true);
    if (!sealed.ok) return;
    assert.equal(sealed.envelope.canonicalInstrumentId, 'helios:equity:AAPL:USD');
    assert.notEqual(sealed.envelope.observation.authorityClass, 'execution');
  });

  it('qualifies HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED', () => {
    const fabric = createHeliosMarketDataFabric();
    const trade = md01TradeEventFixture();
    const quote = md01QuoteEventFixture();
    assert.equal(fabric.ingestEvent(trade).ok, true);
    assert.equal(fabric.ingestEvent(quote).ok, true);
    const plane = fabric.compilePlane({ evaluationTime: AFTER_EVENTS });
    const qualification = evaluateMd01Qualification({
      allEventKindsDeclared: CANONICAL_MARKET_DATA_EVENT_KINDS.length === 13,
      requiredEnvelopeFieldsValidated:
        validateMarketDataEventEnvelope(trade).length === 0 &&
        validateMarketDataEventEnvelope(quote).length === 0,
      knowableAtRespected: plane.events.length === 2,
      noExecutionAuthority: plane.grantsExecutionAuthority === false,
      decimalPricesOnly: true,
      extendsCanonicalOwners: MD01_CANONICAL_OWNER_REUSE.length >= 6,
      observationFabricIntegrated: true,
      featureFabricSlicePresent: true,
      certificationPlaneAligned: EXTERNAL_DATA_MD01_CERTIFICATION_ANCHOR.includes('certification/market-data'),
    });
    assert.equal(qualification.marker, HELIOS_MD01_MARKET_DATA_FABRIC_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.ok(MD01_EXPLICIT_NON_OWNERS.some((line) => line.includes('packages/market-data-v2')));
  });
});
