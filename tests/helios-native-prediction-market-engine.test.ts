/**
 * HELIOS NATIVE13 — Polymarket CLOB engine assimilation (research / paper only).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  createPolymarketClobSandboxProvider,
  POLYMARKET_LIVE_TRADING_ENABLED,
} from '../packages/external-data/src/prediction-market/index.ts';
import {
  computeClobBookMetrics,
  createHeliosPredictionMarketService,
  createPredictionMarketStore,
  emptyPredictionMarketStore,
  evaluatePredictionMarketEngineQualification,
  fixtureClobBooks,
  fixtureYesNoContracts,
  HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED,
  resolvePolymarketTokenEntity,
  simulateClobFill,
} from '../packages/platform/src/helios/prediction-market/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  DEFAULT_MAX_COMPLEMENT_GAP_MINOR,
  DEFAULT_MIN_PROBABILITY_EDGE_MINOR,
  evaluateCrossMarketConsistency,
  evaluateLiquidityStrategy,
  evaluateProbabilityEdgeStrategy,
  fixtureNoBookView,
  fixtureYesBookView,
} from '../packages/strategy-lab/src/prediction-market/index.ts';

const NOW = asUtcInstant('2026-11-03T09:05:00.000Z');

describe('HELIOS native prediction market engine (NATIVE13)', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('computes CLOB metrics and simulated fills from fixture books', () => {
    const book = fixtureClobBooks()[0]!;
    const metrics = computeClobBookMetrics(book);
    assert.equal(metrics.bestBidMinor, 6400n);
    assert.equal(metrics.bestAskMinor, 6450n);
    assert.ok(metrics.spreadMinor !== null && metrics.spreadMinor > 0n);
    assert.ok(metrics.volume24hContracts > 0n);

    const fill = simulateClobFill({
      contractInstrumentId: book.contractInstrumentId,
      side: 'BUY',
      orderSide: 'YES',
      quantityContracts: 10_000n,
      book,
      asOf: NOW,
    });
    assert.equal(fill.filled, true);
    assert.ok(fill.filledQuantity > 0n);
  });

  it('resolves entities and runs paper execution twin without live trading', () => {
    const clock = new FrozenClock(NOW);
    const service = createHeliosPredictionMarketService({
      clock,
      store: createPredictionMarketStore(emptyPredictionMarketStore()),
    });
    service.loadSandboxFixtures();
    const markets = service.browseMarkets({ status: 'ACTIVE' });
    assert.ok(markets.length >= 1);

    const binding = resolvePolymarketTokenEntity({
      providerNativeConditionId: '0xfixture_fed_dec_2026',
      providerNativeTokenId: '0xfixture_yes_token',
      side: 'YES',
      resolvedAt: NOW,
    });
    assert.ok(binding.canonicalInstrumentId.endsWith(':yes'));
    const features = service.featureVectorForCondition('0xfixture_fed_dec_2026');
    assert.ok(features?.features['pm.complement_gap'] !== undefined);

    const { yes } = fixtureYesNoContracts();
    const twin = service.submitPaperTwinOrder({
      twinOrderId: 'twin_1',
      contractInstrumentId: yes.instrumentId,
      conditionId: yes.conditionId,
      side: 'BUY',
      outcomeSide: 'YES',
      quantityContracts: 5_000n,
    });
    assert.equal(twin.order.status, 'SIMULATED_FILL');
    assert.ok(twin.positions.length >= 1);

    const evidence = service.sealResearchEvidence('PM_RESEARCH_RUN', { markets: markets.length });
    assert.ok(evidence.evidenceId.startsWith('pm_ev_'));
  });

  it('loads external-data sandbox provider with live trading disabled', () => {
    assert.equal(POLYMARKET_LIVE_TRADING_ENABLED, false);
    const provider = createPolymarketClobSandboxProvider();
    const snap = provider.fetchSnapshot();
    assert.ok(snap.markets.length >= 1);
    assert.ok(snap.books.length >= 2);
    assert.equal(provider.privateKeyHandling, 'PROHIBITED');
  });

  it('evaluates strategy-lab probability, liquidity, and cross-market rules', () => {
    const yes = fixtureYesBookView();
    const no = fixtureNoBookView();
    const edge = evaluateProbabilityEdgeStrategy({
      fairProbMinor: 6600n,
      yesBook: yes,
      asOf: NOW,
      minEdgeMinor: DEFAULT_MIN_PROBABILITY_EDGE_MINOR,
    });
    assert.equal(edge.action, 'BUY_YES');

    const liq = evaluateLiquidityStrategy({
      book: yes,
      maxSpreadBps: 500,
      minBidDepth: 10_000n,
    });
    assert.equal(liq.tradable, true);

    const cross = evaluateCrossMarketConsistency({
      pair: { yesMidMinor: yes.midMinor, noMidMinor: no.midMinor },
      maxComplementGapMinor: DEFAULT_MAX_COMPLEMENT_GAP_MINOR,
    });
    assert.equal(cross.consistent, true);
  });

  it('qualifies HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED', () => {
    const result = evaluatePredictionMarketEngineQualification({
      domainModelsPresent: true,
      clobMetricsComputed: true,
      entityResolutionWorks: true,
      featureFabricExtracts: true,
      paperPositionsTracked: true,
      simulatedFillsWork: true,
      exposureMetricsWork: true,
      executionTwinPaperOnly: true,
      riskAssessmentWorks: true,
      evidenceSealed: true,
      noPrivateKeyHandling: true,
      livePolymarketTradingDisabled: true,
      strategyLabStrategiesPresent: true,
      externalDataSandboxProvider: true,
      crossMarketConsistencyChecks: true,
    });
    assert.equal(result.marker, HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
