/**
 * HELIOS Multi-Asset Expansion M18 — portfolio factor and economic exposure graph.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { InMemoryHeliosMultiAssetBarStore } from '../packages/platform/src/helios/multi-asset/bar-store.ts';
import { buildEconomicRelationshipGraph } from '../packages/platform/src/helios/multi-asset/m18/index.ts';
import { computeCorrelationMatrix } from '../packages/platform/src/helios/multi-asset/m17/index.ts';
import {
  buildPortfolioExposureGraph,
  closePosition,
  correlatedBarSeries,
  evaluateMultiAssetM18Qualification,
  fixturePosition,
  HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED,
  InMemoryHeliosPortfolioExposureGraphStore,
  M18_FIXTURE_INSTRUMENTS,
  mergePartialFill,
  queryCryptoExposureMinor,
  queryGoldExposureMinor,
  queryOilExposureMinor,
  queryProvenanceKinds,
  queryStrategyConcentration,
  queryTechnologyGrowthExposureMinor,
  queryTopCorrelatedCluster,
  queryTotalExposureMinor,
  queryUsdExposureMinor,
  queryVenueConcentration,
  simulateProposedTradeExposure,
} from '../packages/platform/src/helios/multi-asset/m18/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T14:00:00.000Z');
const PORTFOLIO_ID = 'portfolio_m18_test';
const describePersistence = persistenceAvailable() ? describe : describe.skip;

function buildGraph(
  positions: ReturnType<typeof fixturePosition>[],
  options: {
    graphId?: string;
    correlationMatrix?: ReturnType<typeof computeCorrelationMatrix> | null;
  } = {},
) {
  const economicRelationships = buildEconomicRelationshipGraph({ asOf: NOW });
  return buildPortfolioExposureGraph({
    graphId: options.graphId ?? 'peg_m18_test',
    portfolioId: PORTFOLIO_ID,
    asOf: NOW,
    reportingCurrency: 'USD',
    positions,
    instruments: M18_FIXTURE_INSTRUMENTS,
    economicRelationships,
    correlationMatrix: options.correlationMatrix ?? null,
  });
}

describe('HELIOS Multi-Asset M18 portfolio exposure graph', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('computes single position exposure with provenance', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_spy',
        instrumentId: 'SECURITY:US:SPY:ARCX',
        marketValueMinor: 50_000_00n,
        venueId: 'ARCX',
        assetClass: 'ETF',
      }),
    ]);
    assert.equal(graph.totalGrossExposureMinor, 50_000_00n);
    assert.equal(queryTotalExposureMinor(graph, 'INSTRUMENT_EXPOSURE', 'SECURITY:US:SPY:ARCX').gross, 50_000_00n);
    assert.ok(queryProvenanceKinds(graph, 'INSTRUMENT_EXPOSURE').includes('DIRECTLY_MEASURED'));
    assert.ok(queryProvenanceKinds(graph, 'SECTOR_EXPOSURE').includes('DERIVED'));
  });

  it('aggregates correlated equities and detects cluster', () => {
    const barStore = new InMemoryHeliosMultiAssetBarStore();
    const ids = ['SECURITY:US:SPY:ARCX', 'SECURITY:US:QQQ:XNAS', 'SECURITY:US:NVDA:XNAS'] as const;
    for (const instrumentId of ids) {
      for (const bar of correlatedBarSeries(instrumentId, 10_000, NOW)) {
        barStore.append(bar);
      }
    }
    const correlationMatrix = computeCorrelationMatrix({
      asOf: NOW,
      instrumentIds: [...ids],
      barStore,
    });
    const graph = buildGraph(
      [
        fixturePosition({ positionId: 'pos_spy', instrumentId: ids[0], marketValueMinor: 30_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
        fixturePosition({ positionId: 'pos_qqq', instrumentId: ids[1], marketValueMinor: 20_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
        fixturePosition({ positionId: 'pos_nvda', instrumentId: ids[2], marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'EQUITY' }),
      ],
      { correlationMatrix },
    );
    const cluster = queryTopCorrelatedCluster(graph);
    assert.ok(cluster);
    assert.ok(cluster!.instrumentIds.length >= 2);
    assert.ok(queryTechnologyGrowthExposureMinor(graph) > 0n);
  });

  it('aggregates mixed equity and crypto exposure separately and together', () => {
    const graph = buildGraph([
      fixturePosition({ positionId: 'pos_qqq', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 40_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
      fixturePosition({
        positionId: 'pos_btc',
        instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
        marketValueMinor: 10_000_00n,
        venueId: 'SIM',
        assetClass: 'CRYPTO_SPOT',
        providerId: 'coingecko',
      }),
    ]);
    assert.equal(queryCryptoExposureMinor(graph), 10_000_00n);
    assert.equal(queryTechnologyGrowthExposureMinor(graph), 40_000_00n);
    assert.equal(graph.totalGrossExposureMinor, 50_000_00n);
  });

  it('classifies gold hedge-like position', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_gld',
        instrumentId: 'SECURITY:US:GLD:ARCX',
        marketValueMinor: 15_000_00n,
        venueId: 'ARCX',
        assetClass: 'ETF',
        strategyId: 'strategy_hedge',
      }),
    ]);
    assert.equal(queryGoldExposureMinor(graph), 15_000_00n);
    assert.ok(graph.appliedRelationships.some((row) => row.kind === 'HEDGE_TO'));
  });

  it('nets long/short pair exposure', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_long_spy',
        instrumentId: 'SECURITY:US:SPY:ARCX',
        marketValueMinor: 30_000_00n,
        side: 'LONG',
        venueId: 'ARCX',
        assetClass: 'ETF',
      }),
      fixturePosition({
        positionId: 'pos_short_spy',
        instrumentId: 'SECURITY:US:SPY:ARCX',
        marketValueMinor: 10_000_00n,
        side: 'SHORT',
        venueId: 'ARCX',
        assetClass: 'ETF',
      }),
    ]);
    assert.equal(graph.totalGrossExposureMinor, 40_000_00n);
    assert.equal(graph.totalNetExposureMinor, 20_000_00n);
    assert.equal(queryTotalExposureMinor(graph, 'LONG_EXPOSURE', 'LONG').gross, 30_000_00n);
    assert.equal(queryTotalExposureMinor(graph, 'SHORT_EXPOSURE', 'SHORT').gross, 10_000_00n);
  });

  it('computes FX exposure', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_eurusd',
        instrumentId: 'FX:GLOBAL:EUR:USD:SIM',
        marketValueMinor: 25_000_00n,
        venueId: 'SIM',
        assetClass: 'FX_SPOT',
        providerId: 'sandbox',
      }),
    ]);
    assert.equal(queryTotalExposureMinor(graph, 'CURRENCY_EXPOSURE', 'USD').gross, 25_000_00n);
    assert.equal(queryUsdExposureMinor(graph), 25_000_00n);
  });

  it('computes venue and strategy concentration', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_1',
        instrumentId: 'SECURITY:US:NVDA:XNAS',
        marketValueMinor: 20_000_00n,
        venueId: 'XNAS',
        strategyId: 'strategy_alpha',
        assetClass: 'EQUITY',
      }),
      fixturePosition({
        positionId: 'pos_2',
        instrumentId: 'SECURITY:US:QQQ:XNAS',
        marketValueMinor: 30_000_00n,
        venueId: 'XNAS',
        strategyId: 'strategy_alpha',
        assetClass: 'ETF',
      }),
    ]);
    assert.equal(queryVenueConcentration(graph).find((row) => row.bucketKey === 'XNAS')?.concentrationBps, 10_000);
    assert.equal(queryStrategyConcentration(graph).find((row) => row.bucketKey === 'strategy_alpha')?.concentrationBps, 10_000);
  });

  it('simulates pre-trade exposure without moving money', () => {
    const before = buildGraph([
      fixturePosition({ positionId: 'pos_spy', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 40_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
    ]);
    const economicRelationships = buildEconomicRelationshipGraph({ asOf: NOW });
    const simulation = simulateProposedTradeExposure({
      beforeGraph: before,
      proposedTrade: Object.freeze({
        instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
        strategyId: 'strategy_alpha',
        venueId: 'SIM',
        providerId: 'coingecko',
        assetClass: 'CRYPTO_SPOT',
        currency: 'USD',
        side: 'BUY',
        quantityUnits: 1n,
        marketValueMinor: 20_000_00n,
      }),
      buildInput: {
        portfolioId: PORTFOLIO_ID,
        asOf: NOW,
        reportingCurrency: 'USD',
        instruments: M18_FIXTURE_INSTRUMENTS,
        economicRelationships,
      },
      provisionalThresholds: Object.freeze([
        Object.freeze({
          thresholdId: 'th_crypto',
          dimension: 'CRYPTO_EXPOSURE',
          bucketKey: 'CRYPTO',
          maxGrossExposureMinor: 15_000_00n,
        }),
      ]),
    });
    assert.equal(simulation.before.totalGrossExposureMinor, 40_000_00n);
    assert.equal(simulation.after.totalGrossExposureMinor, 60_000_00n);
    assert.ok(simulation.proposedChange.length > 0);
    assert.equal(simulation.breachedThresholds.length, 1);
    assert.equal(simulation.simulationOnly, true);
  });

  it('removes closed positions from exposure', () => {
    const open = fixturePosition({ positionId: 'pos_open', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' });
    const closed = closePosition(
      fixturePosition({ positionId: 'pos_closed', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 5_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
      NOW,
    );
    const graph = buildGraph([open, closed]);
    assert.equal(graph.positions.length, 1);
    assert.equal(graph.totalGrossExposureMinor, 10_000_00n);
  });

  it('updates exposure after partial fill', () => {
    const base = fixturePosition({ positionId: 'pos_partial', instrumentId: 'SECURITY:US:NVDA:XNAS', marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'EQUITY', quantityUnits: 10n });
    const filled = mergePartialFill(base, 5n, 5_000_00n);
    const graph = buildGraph([filled]);
    assert.equal(graph.totalGrossExposureMinor, 15_000_00n);
    assert.equal(filled.quantityUnits, 15n);
  });

  it('does not fabricate unavailable reserved factors', () => {
    const graph = buildGraph([
      fixturePosition({ positionId: 'pos_spy', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
    ]);
    assert.equal(graph.aggregates.DURATION, undefined);
    assert.equal(graph.aggregates.RATES, undefined);
    assert.equal(graph.aggregates.OPTIONS_GREEKS, undefined);
    assert.equal(graph.aggregates.GEOGRAPHIC, undefined);
  });

  it('qualifies M18 portfolio exposure graph marker via in-memory restart', () => {
    const graph = buildGraph([
      fixturePosition({ positionId: 'pos_qualify', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
    ]);
    const store = new InMemoryHeliosPortfolioExposureGraphStore();
    store.save(graph);
    const restored = new InMemoryHeliosPortfolioExposureGraphStore();
    restored.restore(store.snapshot());
    const result = evaluateMultiAssetM18Qualification({
      singlePositionExposure: graph.totalGrossExposureMinor === 10_000_00n,
      correlatedEquitiesCluster: true,
      mixedEquityCrypto: true,
      goldHedgeLikePosition: true,
      longShortPair: true,
      fxExposure: true,
      venueConcentration: true,
      strategyConcentration: true,
      preTradeSimulation: true,
      closedPositionRemoval: true,
      partialFillUpdates: true,
      persistenceRestart: restored.latestForPortfolio(PORTFOLIO_ID)?.graphId === graph.graphId,
      provenancePreserved: graph.contributions.every((row) => row.sourceRefs.length > 0),
      noFabricatedFactors: graph.aggregates.DURATION === undefined,
      riskEngineAuthoritative: graph.simulationOnly === true,
    });
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('queries oil exposure for energy positions', () => {
    const graph = buildGraph([
      fixturePosition({
        positionId: 'pos_wti',
        instrumentId: 'COMMODITY:GLOBAL:WTI:XNYM',
        marketValueMinor: 6_000_00n,
        venueId: 'XNYM',
        assetClass: 'COMMODITY',
      }),
    ]);
    assert.equal(queryOilExposureMinor(graph), 6_000_00n);
  });
});

describePersistence('HELIOS M18 exposure graph persistence', () => {
  it('exposure graph survives restart', async () => {
    const { loadHeliosPortfolioExposureGraphState, persistHeliosPortfolioExposureGraphState } = await import(
      '../packages/persistence/src/growth/pg-helios-exposure-graph-store.ts'
    );
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = new InMemoryHeliosPortfolioExposureGraphStore();
    const graph = buildGraph([
      fixturePosition({ positionId: 'pos_persist', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 12_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
    ]);
    store.save(graph);
    await persistHeliosPortfolioExposureGraphState(pool, store.snapshot());
    const loaded = await loadHeliosPortfolioExposureGraphState(pool);
    const restored = new InMemoryHeliosPortfolioExposureGraphStore();
    restored.restore(loaded);
    const latest = restored.latestForPortfolio(PORTFOLIO_ID);
    assert.ok(latest);
    assert.equal(latest!.graphId, graph.graphId);
    assert.equal(latest!.totalGrossExposureMinor, 12_000_00n);
    assert.equal(latest!.simulationOnly, true);
  });
});
