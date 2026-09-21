/**
 * HELIOS Multi-Asset Expansion M17 — Dynamic Cross-Asset Correlation Engine tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  DynamicCrossAssetCorrelationEngine,
  ELEVATED_CORRELATION_THRESHOLD_BPS,
  HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED,
  InMemoryCrossAssetOpportunityGraphStore,
  M17_DEFAULT_AS_OF,
  M17_INSTRUMENT_METADATA,
  M17_QQQ,
  M17_SPY,
  M17_USO,
  M17_GLD,
  M17_BTC,
  evaluateMultiAssetM17Qualification,
  queryPortfolioCorrelation,
  syntheticChangingCorrelationSeries,
  syntheticFutureLeakBar,
  syntheticHighCorrelationSpyQqqSeries,
  syntheticInsufficientHistorySeries,
  syntheticNegativeCorrelationSeries,
  syntheticStaleObservationSeries,
  syntheticStaleAsOf,
  syntheticUnrelatedPairSeries,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = M17_DEFAULT_AS_OF;

function buildEngine() {
  const graph = new InMemoryCrossAssetOpportunityGraphStore();
  const engine = new DynamicCrossAssetCorrelationEngine({
    opportunityGraph: graph,
    instrumentMetadata: M17_INSTRUMENT_METADATA,
  });
  return { engine, graph };
}

describe('HELIOS Multi-Asset M17 — Dynamic Cross-Asset Correlation Engine', () => {
  it('computes high SPY/QQQ correlation on medium horizon', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    const artifact = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.ok(artifact.correlationBps !== null);
    assert.ok(artifact.correlationBps >= ELEVATED_CORRELATION_THRESHOLD_BPS);
    assert.equal(artifact.relationshipState, 'ELEVATED_CORRELATION');
    assert.equal(artifact.methodology, 'PEARSON_SIMPLE_RETURN_BPS');
    assert.ok(artifact.sampleSize >= 12);
    assert.ok(artifact.sourceBars.length > 0);
  });

  it('reports low correlation for unrelated synthetic pair', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticUnrelatedPairSeries());
    const artifact = engine.computePair({
      instrumentA: M17_GLD,
      instrumentB: M17_BTC,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.ok(artifact.correlationBps !== null);
    assert.ok(Math.abs(artifact.correlationBps) < 4_000);
  });

  it('detects negative correlation', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticNegativeCorrelationSeries());
    const artifact = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_USO,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.ok(artifact.correlationBps !== null);
    assert.ok(artifact.correlationBps < -5_000);
  });

  it('detects insufficient history', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticInsufficientHistorySeries());
    const artifact = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.equal(artifact.relationshipState, 'INSUFFICIENT_HISTORY');
    assert.equal(artifact.dataQuality, 'UNUSABLE');
  });

  it('detects stale observations', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticStaleObservationSeries());
    const artifact = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: syntheticStaleAsOf(),
      horizon: 'SHORT',
    });
    assert.equal(artifact.relationshipState, 'STALE_OBSERVATIONS');
  });

  it('supports different lookback windows', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    const short = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'SHORT',
    });
    const medium = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    const long = engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'LONG',
    });
    assert.ok(short.lookback < medium.lookback);
    assert.ok(medium.lookback < long.lookback);
    assert.notEqual(short.artifactId, medium.artifactId);
  });

  it('generates correlation matrix', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    const matrix = engine.computeMatrix({
      instrumentIds: [M17_SPY, M17_QQQ],
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.equal(matrix.cells.length, 3);
    const diagonal = matrix.cells.find(
      (cell) => cell.instrumentA === M17_SPY && cell.instrumentB === M17_SPY,
    );
    assert.equal(diagonal?.correlationBps, 10_000);
  });

  it('generates correlation clusters', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    const clusters = engine.computeClusters({
      instrumentIds: [M17_SPY, M17_QQQ],
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.equal(clusters.length, 1);
    assert.deepEqual([...clusters[0]!.instrumentIds].sort(), [M17_QQQ, M17_SPY].sort());
  });

  it('detects changing correlation and records change events', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticChangingCorrelationSeries());
    const early = asUtcInstant('2026-05-01T16:00:00.000Z');
    engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: early,
      horizon: 'MEDIUM',
    });
    engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    const changes = engine.store.changes(NOW);
    assert.ok(changes.length >= 1);
  });

  it('enforces no look-ahead via knowableAt filtering', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    engine.ingestBar(syntheticFutureLeakBar(NOW));
    const earlyBars = engine.barsFor(M17_SPY, NOW);
    const futureBar = earlyBars.find((bar) => bar.closeMinor === 999_00n);
    assert.equal(futureBar, undefined);
  });

  it('restarts reproducibly from snapshot', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    const snapshot = engine.store.snapshot(NOW);

    const restarted = new DynamicCrossAssetCorrelationEngine({
      store: engine.store,
      instrumentMetadata: M17_INSTRUMENT_METADATA,
    });
    restarted.store.restore(snapshot);
    const restored = restarted.store.latestPairArtifact({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      horizon: 'MEDIUM',
      asOf: NOW,
    });
    assert.ok(restored);
    assert.equal(restored?.correlationBps, snapshot.artifacts[0]?.correlationBps);
  });

  it('updates M15 opportunity graph evidence', () => {
    const { engine, graph } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    engine.computePair({
      instrumentA: M17_SPY,
      instrumentB: M17_QQQ,
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    const snapshot = graph.snapshot(NOW);
    assert.ok(snapshot.nodes.length >= 2);
    assert.ok(snapshot.edges.length >= 1);
    const edge = graph.edgeFor(M17_SPY, M17_QQQ, 'CORRELATION');
    assert.ok(edge);
    assert.ok(edge!.evidence.some((row) => row.kind === 'CORRELATION_ARTIFACT'));
  });

  it('portfolio query is research-only and does not approve orders', () => {
    const { engine } = buildEngine();
    engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());
    const lookup = queryPortfolioCorrelation({
      engine,
      store: engine.store,
      proposedInstrumentId: M17_QQQ,
      positions: [
        Object.freeze({
          instrumentId: M17_SPY,
          assetClass: 'etf',
          notionalMinor: 100_000_00n,
        }),
      ],
      asOf: NOW,
      horizon: 'MEDIUM',
    });
    assert.equal(lookup.researchOnly, true);
    assert.ok(lookup.maxCorrelationBps !== null);
    assert.ok(!('approved' in (lookup as Record<string, unknown>)));
    assert.ok(!('rejected' in (lookup as Record<string, unknown>)));
  });

  it('emits HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED when all scenarios pass', () => {
    const checks = runQualificationScenarios();
    const qualification = evaluateMultiAssetM17Qualification(checks);
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED, qualification.blockers.join('; '));
  });

  it('passes HELIOS architectural boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const m17Findings = findings.filter((row) => row.file.includes('multi-asset/correlation'));
    assert.deepEqual(m17Findings, []);
  });
});

function runQualificationScenarios() {
  const { engine, graph } = buildEngine();
  engine.ingestBars(syntheticHighCorrelationSpyQqqSeries());

  const high = engine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    asOf: NOW,
    horizon: 'MEDIUM',
  });

  const unrelatedEngine = buildEngine().engine;
  unrelatedEngine.ingestBars(syntheticUnrelatedPairSeries());
  const unrelated = unrelatedEngine.computePair({
    instrumentA: M17_GLD,
    instrumentB: M17_BTC,
    asOf: NOW,
    horizon: 'MEDIUM',
  });

  const negativeEngine = buildEngine().engine;
  negativeEngine.ingestBars(syntheticNegativeCorrelationSeries());
  const negative = negativeEngine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_USO,
    asOf: NOW,
    horizon: 'MEDIUM',
  });

  const insufficientEngine = buildEngine().engine;
  insufficientEngine.ingestBars(syntheticInsufficientHistorySeries());
  const insufficient = insufficientEngine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    asOf: NOW,
    horizon: 'MEDIUM',
  });

  const staleEngine = buildEngine().engine;
  staleEngine.ingestBars(syntheticStaleObservationSeries());
  const stale = staleEngine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    asOf: syntheticStaleAsOf(),
    horizon: 'SHORT',
  });

  const changeEngine = buildEngine().engine;
  changeEngine.ingestBars(syntheticChangingCorrelationSeries());
  const early = asUtcInstant('2026-05-01T16:00:00.000Z');
  changeEngine.computePair({ instrumentA: M17_SPY, instrumentB: M17_QQQ, asOf: early, horizon: 'MEDIUM' });
  changeEngine.computePair({ instrumentA: M17_SPY, instrumentB: M17_QQQ, asOf: NOW, horizon: 'MEDIUM' });
  const changes = changeEngine.store.changes(NOW);

  engine.ingestBar(syntheticFutureLeakBar(NOW));
  const noLookAhead = engine.barsFor(M17_SPY, NOW).every(
    (bar) => Date.parse(bar.knowableAt) <= Date.parse(NOW),
  );

  const short = engine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    asOf: NOW,
    horizon: 'SHORT',
  });
  const long = engine.computePair({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    asOf: NOW,
    horizon: 'LONG',
  });

  const matrix = engine.computeMatrix({
    instrumentIds: [M17_SPY, M17_QQQ],
    asOf: NOW,
    horizon: 'MEDIUM',
  });
  const clusters = engine.computeClusters({
    instrumentIds: [M17_SPY, M17_QQQ],
    asOf: NOW,
    horizon: 'MEDIUM',
  });

  const snapshot = engine.store.snapshot(NOW);
  const restarted = new DynamicCrossAssetCorrelationEngine({
    instrumentMetadata: M17_INSTRUMENT_METADATA,
  });
  restarted.store.restore(snapshot);
  const restored = restarted.store.latestPairArtifact({
    instrumentA: M17_SPY,
    instrumentB: M17_QQQ,
    horizon: 'MEDIUM',
    asOf: NOW,
  });

  const lookup = queryPortfolioCorrelation({
    engine,
    store: engine.store,
    proposedInstrumentId: M17_QQQ,
    positions: [
      Object.freeze({ instrumentId: M17_SPY, assetClass: 'etf', notionalMinor: 50_000_00n }),
    ],
    asOf: NOW,
  });

  const graphSnapshot = graph.snapshot(NOW);

  return Object.freeze({
    spyQqqHighCorrelation:
      high.correlationBps !== null && high.correlationBps >= ELEVATED_CORRELATION_THRESHOLD_BPS,
    unrelatedPairLowCorrelation:
      unrelated.correlationBps !== null && Math.abs(unrelated.correlationBps) < 4_000,
    changingCorrelationDetected: changes.length >= 1,
    negativeCorrelationDetected: negative.correlationBps !== null && negative.correlationBps < -5_000,
    insufficientHistoryDetected: insufficient.relationshipState === 'INSUFFICIENT_HISTORY',
    staleObservationsDetected: stale.relationshipState === 'STALE_OBSERVATIONS',
    multipleLookbackWindows: short.lookback < long.lookback,
    matrixGeneration: matrix.cells.length === 3,
    clusterGeneration: clusters.length === 1,
    restartReproducible: restored?.correlationBps === high.correlationBps,
    noLookAhead,
    opportunityGraphEvidenceUpdated:
      graphSnapshot.edges.length > 0 &&
      graphSnapshot.edges.some((edge) => edge.evidence.some((ev) => ev.kind === 'CORRELATION_ARTIFACT')),
    portfolioQueryResearchOnly: lookup.researchOnly === true,
    doesNotApproveOrders: !('approved' in (lookup as Record<string, unknown>)),
  });
}
