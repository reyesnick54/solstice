#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M18 — portfolio exposure graph qualification harness.
 */

import { asUtcInstant } from '../packages/domain/src/time.ts';
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
  mergePartialFill,
  M18_FIXTURE_INSTRUMENTS,
  queryCryptoExposureMinor,
  queryGoldExposureMinor,
  queryOilExposureMinor,
  queryTechnologyGrowthExposureMinor,
  queryTopCorrelatedCluster,
  queryTotalExposureMinor,
  queryUsdExposureMinor,
  queryVenueConcentration,
  InMemoryHeliosPortfolioExposureGraphStore,
  simulateProposedTradeExposure,
  type MultiAssetM18QualificationChecks,
} from '../packages/platform/src/helios/multi-asset/m18/index.ts';

const NOW = asUtcInstant('2026-09-16T14:00:00.000Z');

function buildGraph(positions: ReturnType<typeof fixturePosition>[], correlationMatrix?: ReturnType<typeof computeCorrelationMatrix> | null) {
  return buildPortfolioExposureGraph({
    graphId: 'peg_m18_qualify',
    portfolioId: 'portfolio_m18_qualify',
    asOf: NOW,
    reportingCurrency: 'USD',
    positions,
    instruments: M18_FIXTURE_INSTRUMENTS,
    economicRelationships: buildEconomicRelationshipGraph({ asOf: NOW }),
    correlationMatrix: correlationMatrix ?? null,
  });
}

function runChecks(): MultiAssetM18QualificationChecks {
  const single = buildGraph([
    fixturePosition({ positionId: 'pos_spy', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
  ]);

  const barStore = new InMemoryHeliosMultiAssetBarStore();
  for (const instrumentId of ['SECURITY:US:SPY:ARCX', 'SECURITY:US:QQQ:XNAS', 'SECURITY:US:NVDA:XNAS']) {
    for (const bar of correlatedBarSeries(instrumentId, 10_000, NOW)) {
      barStore.append(bar);
    }
  }
  const correlationMatrix = computeCorrelationMatrix({
    asOf: NOW,
    instrumentIds: ['SECURITY:US:SPY:ARCX', 'SECURITY:US:QQQ:XNAS', 'SECURITY:US:NVDA:XNAS'],
    barStore,
  });
  const correlated = buildGraph(
    [
      fixturePosition({ positionId: 'pos_spy', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
      fixturePosition({ positionId: 'pos_qqq', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
      fixturePosition({ positionId: 'pos_nvda', instrumentId: 'SECURITY:US:NVDA:XNAS', marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'EQUITY' }),
    ],
    correlationMatrix,
  );

  const mixed = buildGraph([
    fixturePosition({ positionId: 'pos_qqq', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
    fixturePosition({ positionId: 'pos_btc', instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM', marketValueMinor: 5_000_00n, venueId: 'SIM', assetClass: 'CRYPTO_SPOT' }),
  ]);

  const gold = buildGraph([
    fixturePosition({ positionId: 'pos_gld', instrumentId: 'SECURITY:US:GLD:ARCX', marketValueMinor: 8_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
  ]);

  const longShort = buildGraph([
    fixturePosition({ positionId: 'pos_long', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 20_000_00n, side: 'LONG', venueId: 'ARCX', assetClass: 'ETF' }),
    fixturePosition({ positionId: 'pos_short', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 5_000_00n, side: 'SHORT', venueId: 'ARCX', assetClass: 'ETF' }),
  ]);

  const fx = buildGraph([
    fixturePosition({ positionId: 'pos_fx', instrumentId: 'FX:GLOBAL:EUR:USD:SIM', marketValueMinor: 12_000_00n, venueId: 'SIM', assetClass: 'FX_SPOT' }),
  ]);

  const concentration = buildGraph([
    fixturePosition({ positionId: 'pos_1', instrumentId: 'SECURITY:US:NVDA:XNAS', marketValueMinor: 7_000_00n, venueId: 'XNAS', strategyId: 'strategy_a', assetClass: 'EQUITY' }),
    fixturePosition({ positionId: 'pos_2', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 3_000_00n, venueId: 'XNAS', strategyId: 'strategy_a', assetClass: 'ETF' }),
  ]);

  const before = buildGraph([
    fixturePosition({ positionId: 'pos_before', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
  ]);
  const simulation = simulateProposedTradeExposure({
    beforeGraph: before,
    proposedTrade: Object.freeze({
      instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
      strategyId: 'strategy_a',
      venueId: 'SIM',
      providerId: 'coingecko',
      assetClass: 'CRYPTO_SPOT',
      currency: 'USD',
      side: 'BUY',
      quantityUnits: 1n,
      marketValueMinor: 20_000_00n,
    }),
    buildInput: {
      portfolioId: 'portfolio_m18_qualify',
      asOf: NOW,
      reportingCurrency: 'USD',
      instruments: M18_FIXTURE_INSTRUMENTS,
      economicRelationships: buildEconomicRelationshipGraph({ asOf: NOW }),
    },
  });

  const closedGraph = buildGraph([
    fixturePosition({ positionId: 'pos_open', instrumentId: 'SECURITY:US:SPY:ARCX', marketValueMinor: 10_000_00n, venueId: 'ARCX', assetClass: 'ETF' }),
    closePosition(
      fixturePosition({ positionId: 'pos_closed', instrumentId: 'SECURITY:US:QQQ:XNAS', marketValueMinor: 5_000_00n, venueId: 'XNAS', assetClass: 'ETF' }),
      NOW,
    ),
  ]);

  const partialGraph = buildGraph([
    mergePartialFill(
      fixturePosition({ positionId: 'pos_partial', instrumentId: 'SECURITY:US:NVDA:XNAS', marketValueMinor: 10_000_00n, venueId: 'XNAS', assetClass: 'EQUITY', quantityUnits: 10n }),
      5n,
      5_000_00n,
    ),
  ]);

  const oilGraph = buildGraph([
    fixturePosition({ positionId: 'pos_wti', instrumentId: 'COMMODITY:GLOBAL:WTI:XNYM', marketValueMinor: 6_000_00n, venueId: 'XNYM', assetClass: 'COMMODITY' }),
  ]);

  const store = new InMemoryHeliosPortfolioExposureGraphStore();
  store.save(single);
  const restored = new InMemoryHeliosPortfolioExposureGraphStore();
  restored.restore(store.snapshot());

  return Object.freeze({
    singlePositionExposure: queryTotalExposureMinor(single, 'INSTRUMENT_EXPOSURE', 'SECURITY:US:SPY:ARCX').gross === 10_000_00n,
    correlatedEquitiesCluster: queryTopCorrelatedCluster(correlated) !== null,
    mixedEquityCrypto:
      queryCryptoExposureMinor(mixed) === 5_000_00n && queryTechnologyGrowthExposureMinor(mixed) === 10_000_00n,
    goldHedgeLikePosition: queryGoldExposureMinor(gold) === 8_000_00n,
    longShortPair: longShort.totalNetExposureMinor === 15_000_00n,
    fxExposure: queryUsdExposureMinor(fx) === 12_000_00n,
    venueConcentration: (queryVenueConcentration(concentration).find((row) => row.bucketKey === 'XNAS')?.concentrationBps ?? 0) === 10_000,
    strategyConcentration: concentration.aggregates.STRATEGY_CONCENTRATION?.[0]?.concentrationBps === 10_000,
    preTradeSimulation:
      simulation.before.totalGrossExposureMinor === 10_000_00n &&
      simulation.after.totalGrossExposureMinor === 30_000_00n &&
      simulation.proposedChange.length > 0,
    closedPositionRemoval: closedGraph.totalGrossExposureMinor === 10_000_00n,
    partialFillUpdates: partialGraph.totalGrossExposureMinor === 15_000_00n,
    persistenceRestart: restored.latestForPortfolio('portfolio_m18_qualify')?.graphId === 'peg_m18_qualify',
    provenancePreserved: single.contributions.every((row) => row.sourceRefs.length > 0),
    noFabricatedFactors:
      single.aggregates.DURATION === undefined &&
      queryOilExposureMinor(oilGraph) === 6_000_00n,
    riskEngineAuthoritative: single.simulationOnly === true,
  });
}

function main(): void {
  const checks = runChecks();
  const result = evaluateMultiAssetM18Qualification(checks);
  console.log(JSON.stringify({ command: 'helios:m18:qualify', checks, ...result }, null, 2));
  process.exit(result.marker === HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED ? 0 : 1);
}

main();
