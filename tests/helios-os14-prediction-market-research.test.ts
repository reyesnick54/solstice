/**
 * HELIOS OS14 — prediction-market microstructure research qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED,
  OS14_UPSTREAM_REFERENCE_SHA,
  PredictionMarketResearchFabric,
  bookImbalancePpm,
  canonicalPredictionMarketInstrumentId,
  demoPrimaryMarketFixture,
  demoPredictionMarkets,
  evaluateOs14PredictionMarketQualification,
  resolvePredictionMarketEntity,
  toStrategyLabOs14MicrostructureInput,
} from '../packages/platform/src/helios/index.ts';
import {
  buildOs14StrategyLabResearchContext,
  os14ResearchLiquidityStress,
} from '../packages/strategy-lab/src/os14-prediction-market/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS OS14 prediction-market research', () => {
  it('normalizes paired YES/NO CLOB and microstructure metrics', () => {
    const { instrument, orderBook, volumeUsdcMinor } = demoPrimaryMarketFixture();
    const clock = new FrozenClock(orderBook.arrivalTimestamp);
    const vault = new EvidenceVault(clock);
    const fabric = new PredictionMarketResearchFabric({
      clock,
      evidence: vault,
      researchPriorPpmByInstrument: {
        [instrument.instrumentId]: 250_000n,
      },
    });

    const result = fabric.ingest({
      instrument,
      orderBook,
      volumeUsdcMinor,
      provenance: {
        providerId: 'os14_fixture',
        sourceId: 'os14.fixture.v1',
        observationId: 'obs_os14_btc_1',
        rawPayloadHash: 'hash_fixture_btc',
        upstreamSourceRef: 'fixture:btc-100k-by-eoy',
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.state.instrument.permitsLiveWagering, false);
    assert.equal(result.state.instrument.researchOnly, true);
    assert.ok(result.state.microstructure);
    assert.ok(result.state.microstructure!.bookImbalancePpm > 0n);
    assert.equal(result.state.microstructure!.crossOutcomeConsistency, 'COMPLEMENT_OK');
    assert.ok(result.features.impliedMarketMidPpm !== null);
    assert.ok(result.probabilityEdge);
    assert.notEqual(result.probabilityEdge!.researchPriorPpm, result.probabilityEdge!.impliedMarketMidPpm);
    assert.match(result.probabilityEdge!.detail, /implied market mid vs research prior/i);
    assert.ok(result.evidenceId);
  });

  it('resolves entity bindings and forbids live wagering ingest', () => {
    const binding = resolvePredictionMarketEntity({
      venueId: 'polymarket_simulation',
      marketSlug: 'btc-100k-by-eoy',
    });
    assert.equal(
      binding.canonicalInstrumentId,
      canonicalPredictionMarketInstrumentId({
        venueId: 'polymarket_simulation',
        marketSlug: 'btc-100k-by-eoy',
      }),
    );

    const row = demoPredictionMarkets()[0]!;
    const instrument = {
      ...demoPrimaryMarketFixture().instrument,
      permitsLiveWagering: true as never,
    };
    const clock = new FrozenClock(demoPrimaryMarketFixture().orderBook.arrivalTimestamp);
    const fabric = new PredictionMarketResearchFabric({ clock });
    const blocked = fabric.ingest({
      instrument,
      orderBook: demoPrimaryMarketFixture().orderBook,
      provenance: {
        providerId: 'os14_fixture',
        sourceId: 'os14.fixture.v1',
        observationId: 'obs_blocked',
        rawPayloadHash: 'hash_blocked',
        upstreamSourceRef: `fixture:${row.slug}`,
      },
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, 'LIVE_WAGERING_FORBIDDEN');
  });

  it('bridges feature fabric output into Strategy Lab research context', () => {
    const { instrument, orderBook, volumeUsdcMinor } = demoPrimaryMarketFixture();
    const clock = new FrozenClock(orderBook.arrivalTimestamp);
    const fabric = new PredictionMarketResearchFabric({ clock });
    const ingested = fabric.ingest({
      instrument,
      orderBook,
      volumeUsdcMinor,
      provenance: {
        providerId: 'os14_fixture',
        sourceId: 'os14.fixture.v1',
        observationId: 'obs_os14_bridge',
        rawPayloadHash: 'hash_bridge',
        upstreamSourceRef: 'fixture:bridge',
      },
    });
    assert.equal(ingested.ok, true);
    if (!ingested.ok) return;

    const dto = toStrategyLabOs14MicrostructureInput(ingested.features);
    assert.ok(dto);
    assert.equal(dto!.researchOnly, true);

    const labRow = {
      schema: dto!.schema,
      instrumentId: dto!.instrumentId,
      knowableAt: dto!.knowableAt,
      impliedMarketMidPpm: BigInt(dto!.impliedMarketMidPpm),
      yesSpreadPpm: BigInt(dto!.yesSpreadPpm),
      bookImbalancePpm: BigInt(dto!.bookImbalancePpm),
      feeAdjustedEdgePpm: dto!.feeAdjustedEdgePpm ? BigInt(dto!.feeAdjustedEdgePpm) : null,
      researchOnly: true as const,
    };
    const ctx = buildOs14StrategyLabResearchContext(labRow);
    assert.equal(ctx.permitsExecution, false);
    assert.equal(os14ResearchLiquidityStress(labRow), labRow.yesSpreadPpm >= 40_000n);
  });

  it('persists store snapshot round-trip', () => {
    const fixture = demoPrimaryMarketFixture();
    const clock = new FrozenClock(fixture.orderBook.arrivalTimestamp);
    const fabric = new PredictionMarketResearchFabric({ clock });
    fabric.ingest({
      instrument: fixture.instrument,
      orderBook: fixture.orderBook,
      volumeUsdcMinor: fixture.volumeUsdcMinor,
      provenance: {
        providerId: 'os14_fixture',
        sourceId: 'os14.fixture.v1',
        observationId: 'obs_persist',
        rawPayloadHash: 'hash_persist',
        upstreamSourceRef: 'fixture:persist',
      },
    });
    const snap = fabric.researchStore().snapshot();
    const restored = new PredictionMarketResearchFabric({ clock });
    restored.researchStore().restore(snap);
    assert.ok(restored.researchStore().getState(fixture.instrument.instrumentId));
  });

  it('emits HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED when checks pass', () => {
    const imbalance = bookImbalancePpm(10_000_000n, 2_000_000n);
    assert.ok(imbalance > 0n);

    const qualification = evaluateOs14PredictionMarketQualification({
      pairedYesNoBookNormalization: true,
      impliedMarketProbabilitySemantics: true,
      microstructureMetricsPresent: true,
      crossOutcomeConsistencyEvaluated: true,
      feeAdjustedEdgeResearch: true,
      observationFabricIntegration: true,
      featureFabricIntegration: true,
      entityResolutionBindings: true,
      evidenceVaultSealing: true,
      strategyLabBridge: true,
      noLiveWageringPath: true,
      upstreamAttributionRecorded: OS14_UPSTREAM_REFERENCE_SHA.length === 40,
      persistenceRoundTrip: true,
    });
    assert.equal(qualification.marker, HELIOS_OS14_PREDICTION_MARKET_RESEARCH_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });

  it('passes HELIOS boundary lint for OS14 module', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const os14Findings = findings.filter((f) => f.file.includes('os14-prediction-market'));
    assert.deepEqual(os14Findings, []);
  });
});
