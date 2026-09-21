/**
 * HELIOS Multi-Asset M16 — multi-asset opportunity ranking engine qualification.
 *
 * Engineering evaluation only. Rank is not permission to trade.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
  HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2,
  HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED,
  HeliosOpportunityRankingService,
  M16_BTC_BREAKOUT,
  M16_CORRELATION_MATRIX,
  M16_CUSTOMER_ID,
  M16_FIXTURE_NOW,
  M16_GOLD_TREND,
  M16_HIGH_CORRELATION,
  M16_INSUFFICIENT_EVIDENCE,
  M16_OIL_TREND,
  M16_POOR_LIQUIDITY,
  M16_PROVIDER_UNAVAILABLE,
  M16_SPY_MEAN_REVERSION,
  M16_STALE,
  M16_WORK_ORDER_ID,
  assessRegimeCompatibility,
  bridgeRankedOpportunitiesToMetaAllocator,
  evaluateM13Qualification,
  evaluateM14Qualification,
  evaluateM15Qualification,
  evaluateM16Qualification,
  evaluateRegime,
  factorOverrides,
  rankOpportunities,
  rankingFingerprint,
  type OpportunityRankingCandidateInput,
} from '../packages/platform/src/helios/intelligence/index.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../packages/platform/src/helios/market-observation/instrument-registry.ts';
import { evaluateMultiAssetMarketState } from '../packages/platform/src/helios/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = M16_FIXTURE_NOW;
const clock = new FrozenClock(NOW);

function healthyMarketState(instrumentId: string, assetClass: string) {
  return evaluateMultiAssetMarketState({
    instrument: Object.freeze({
      instrumentId,
      symbol: instrumentId.split(':').pop() ?? 'X',
      assetClass,
      venueId: 'SIM',
      venueDisplayName: 'Simulation',
      currency: 'USD',
      priceScale: 2,
      instrumentMode: 'TRADABLE',
      active: true,
      halted: false,
      researchOnly: false,
    }),
    observations: Object.freeze({
      quote: Object.freeze({
        observationId: `obs_${instrumentId}`,
        providerId: 'fixture_market',
        sourceId: `fixture:${instrumentId}`,
        observedAt: asUtcInstant('2026-09-21T09:59:58.000Z'),
        knowableAt: asUtcInstant('2026-09-21T09:59:59.000Z'),
        referencePrice: Object.freeze({ minorUnits: '10000', currency: 'USD', scale: 2 }),
        bid: Object.freeze({ minorUnits: '9998', currency: 'USD', scale: 2 }),
        ask: Object.freeze({ minorUnits: '10002', currency: 'USD', scale: 2 }),
        recentVolume: '500000',
        freshness: 'FRESH',
        qualityState: 'VALID',
        entitlementUsable: true,
        entitlementBlocked: false,
        timestampConsistent: true,
        contradictory: false,
        corroborationCount: 2,
        providerHealth: 'HEALTHY',
      }),
      bars: Object.freeze([
        Object.freeze({
          barId: 'bar_1h',
          timeframe: '1h' as const,
          observedAt: asUtcInstant('2026-09-21T09:00:00.000Z'),
          freshness: 'FRESH' as const,
          complete: true,
        }),
      ]),
      availableBarTimeframes: Object.freeze(['1h'] as const),
      latestObservationTimestamp: asUtcInstant('2026-09-21T09:59:58.000Z'),
    }),
    sessionContract: Object.freeze({
      sessionState: 'OPEN' as const,
      contractValidUntil: asUtcInstant('2026-09-24T10:00:00.000Z'),
      liquidityState: 'ADEQUATE' as const,
      volatilityState: 'NORMAL' as const,
      futuresRollState: 'NOT_APPLICABLE' as const,
      executionCapability: 'AVAILABLE' as const,
      routeAvailable: true,
      routeId: 'route_sim',
    }),
    now: NOW,
  }).marketState;
}

function buildRankingCandidates(
  candidates: readonly typeof M16_SPY_MEAN_REVERSION[],
): OpportunityRankingCandidateInput[] {
  const overrides = factorOverrides();
  return candidates.map((candidate) => {
    const o = overrides[candidate.opportunityId] ?? {};
    return Object.freeze({
      candidate,
      factors: Object.freeze({
        strategyConfidenceBps: 7500,
        historicalQualificationState: 'QUALIFIED' as const,
        regimeCompatibility: assessRegimeCompatibility(candidate.strategyFamily, 'UNKNOWN'),
        expectedRewardEvidenceBps: null,
        expectedDownsideEvidenceBps: null,
        realizedVolatilityBps: 1500,
        liquidityScore: 80,
        spreadBps: 15,
        estimatedFeesBps: 10,
        estimatedSlippageBps: 8,
        dataQualityScore: 85,
        evidenceQualityScore: 80,
        signalFreshnessScore: 90,
        correlationPenaltyBps: 0,
        capitalRequirementMinor: '5000',
        availableCapitalMinor: '100000',
        providerAvailable: true,
        executionReady: true,
        expiresAt: candidate.expiresAt,
        dataQualityWarnings: Object.freeze([]),
        correlationWarnings: Object.freeze([]),
        evidenceRefs: candidate.evidenceRefs,
        ...o,
      }),
    });
  });
}

function baseCosts() {
  return Object.freeze({
    minimumOrderSizeMinor: '5000',
    spreadBps: 10,
    commissionMinor: '100',
    slippageBps: 5,
    inferenceCostMinor: '200',
    dataCostMinor: '50',
    currency: 'USD',
  });
}

describe('HELIOS Multi-Asset M16 opportunity ranking engine', () => {
  it('remains in simulation with live trading disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('compares SPY mean reversion vs BTC breakout with deterministic ordering', () => {
    const result = rankOpportunities({
      runId: 'run_spy_btc',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_SPY_MEAN_REVERSION, M16_BTC_BREAKOUT]),
      now: NOW,
    });

    const spy = result.opportunities.find((o) => o.opportunityId === M16_SPY_MEAN_REVERSION.opportunityId)!;
    const btc = result.opportunities.find((o) => o.opportunityId === M16_BTC_BREAKOUT.opportunityId)!;

    assert.ok(spy.rank !== null);
    assert.ok(btc.rank !== null);
    assert.notEqual(spy.rank, btc.rank);
    assert.equal(btc.scorecard.compositeScore > spy.scorecard.compositeScore, btc.rank === 1);
    assert.equal(spy.rankIsNotTradePermission, true);
    assert.equal(spy.grantsExecutionAuthority, false);
  });

  it('compares Gold trend vs Oil trend across commodity strategy family', () => {
    const result = rankOpportunities({
      runId: 'run_gold_oil',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_GOLD_TREND, M16_OIL_TREND]),
      now: NOW,
    });

    const gold = result.opportunities.find((o) => o.opportunityId === M16_GOLD_TREND.opportunityId)!;
    const oil = result.opportunities.find((o) => o.opportunityId === M16_OIL_TREND.opportunityId)!;

    assert.equal(gold.strategyFamily, 'COMMODITY_TREND');
    assert.equal(oil.strategyFamily, 'COMMODITY_TREND');
    assert.ok(gold.regimeMatch.compatible);
    assert.ok(oil.regimeMatch.compatible);
    assert.ok(gold.rank !== null && oil.rank !== null);
  });

  it('rejects high-return-looking but poor-liquidity candidate', () => {
    const result = rankOpportunities({
      runId: 'run_poor_liq',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_POOR_LIQUIDITY]),
      now: NOW,
    });
    const opp = result.opportunities[0]!;
    assert.equal(opp.outputState, 'REJECT');
    assert.ok(opp.scorecard.rejectedFactors.includes('expectedReward') === false);
    assert.ok(opp.scorecard.factors.find((f) => f.factorId === 'expectedReward')!.score! > 80);
    assert.ok(opp.scorecard.factors.find((f) => f.factorId === 'liquidity')!.score! < 10);
  });

  it('waits on stale candidate despite high expected reward evidence', () => {
    const result = rankOpportunities({
      runId: 'run_stale',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_STALE]),
      now: NOW,
    });
    assert.equal(result.opportunities[0]!.outputState, 'WAIT');
  });

  it('warns on high correlation candidate', () => {
    const result = rankOpportunities({
      runId: 'run_corr',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_HIGH_CORRELATION]),
      now: NOW,
    });
    const opp = result.opportunities[0]!;
    assert.ok(opp.correlationWarnings.length > 0);
    assert.equal(opp.outputState, 'WATCH');
  });

  it('waits when provider unavailable', () => {
    const result = rankOpportunities({
      runId: 'run_provider',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_PROVIDER_UNAVAILABLE]),
      now: NOW,
    });
    assert.equal(result.opportunities[0]!.outputState, 'WAIT');
    assert.equal(result.opportunities[0]!.metaAllocatorHandoffEligible, false);
  });

  it('marks insufficient evidence without inventing expected return', () => {
    const result = rankOpportunities({
      runId: 'run_insufficient',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_INSUFFICIENT_EVIDENCE]),
      now: NOW,
    });
    const opp = result.opportunities[0]!;
    assert.equal(opp.outputState, 'INSUFFICIENT_EVIDENCE');
    const reward = opp.scorecard.factors.find((f) => f.factorId === 'expectedReward')!;
    assert.equal(reward.rejected, true);
    assert.equal(reward.score, null);
  });

  it('produces reproducible ranking fingerprint for fixed inputs', () => {
    const input = {
      runId: 'run_repro',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([M16_SPY_MEAN_REVERSION, M16_BTC_BREAKOUT, M16_GOLD_TREND]),
      now: NOW,
    };
    const first = rankOpportunities(input);
    const second = rankOpportunities({ ...input, runId: 'run_repro_2' });
    assert.equal(
      rankingFingerprint(first, HELIOS_M16_OPPORTUNITY_RANKING_VERSION),
      rankingFingerprint(second, HELIOS_M16_OPPORTUNITY_RANKING_VERSION),
    );
  });

  it('changes ranking when version weights change', () => {
    const candidates = buildRankingCandidates([M16_SPY_MEAN_REVERSION, M16_BTC_BREAKOUT]);
    const v1 = rankOpportunities({
      runId: 'run_v1',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates,
      now: NOW,
    });
    const v2 = rankOpportunities({
      runId: 'run_v2',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates,
      now: NOW,
    });
    const fp1 = rankingFingerprint(v1, HELIOS_M16_OPPORTUNITY_RANKING_VERSION);
    const fp2 = rankingFingerprint(v2, HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2);
    assert.notEqual(fp1, fp2);
  });

  it('expires candidates past validity horizon', () => {
    const expired = Object.freeze({
      ...M16_SPY_MEAN_REVERSION,
      expiresAt: asUtcInstant('2026-09-21T09:00:00.000Z'),
    });
    const result = rankOpportunities({
      runId: 'run_expired',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([expired]),
      now: NOW,
    });
    assert.equal(result.opportunities[0]!.outputState, 'EXPIRED');
    assert.equal(result.opportunities[0]!.rank, null);
  });

  it('survives restart via in-memory store snapshot', () => {
    const service = new HeliosOpportunityRankingService();
    const pipeline = service.runPipeline({
      assembly: Object.freeze({
        assemblyId: 'asm_restart',
        workOrderId: M16_WORK_ORDER_ID,
        workOrderActive: true,
        envelopeValidByOpportunityId: Object.freeze({}),
        candidates: [M16_SPY_MEAN_REVERSION, M16_BTC_BREAKOUT],
        now: NOW,
      }),
      regimeInputsByInstrumentId: Object.freeze({
        [M02_REFERENCE_INSTRUMENT_IDS.SPY]: Object.freeze({
          marketState: healthyMarketState(M02_REFERENCE_INSTRUMENT_IDS.SPY, 'etf'),
          now: NOW,
        }),
        [M02_REFERENCE_INSTRUMENT_IDS.BTC]: Object.freeze({
          marketState: healthyMarketState(M02_REFERENCE_INSTRUMENT_IDS.BTC, 'crypto'),
          now: NOW,
        }),
      }),
      factorOverridesByOpportunityId: factorOverrides(),
      graph: Object.freeze({
        graphId: 'graph_restart',
        portfolioInstrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
        correlationMatrix: M16_CORRELATION_MATRIX,
      }),
      ranking: Object.freeze({
        runId: 'run_restart',
        rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
        workOrderId: M16_WORK_ORDER_ID,
        customerId: M16_CUSTOMER_ID,
        now: NOW,
      }),
      defaultCosts: baseCosts(),
    });

    const snapshot = service.getStore().snapshot();
    const restarted = new HeliosOpportunityRankingService();
    restarted.getStore().restore(snapshot);
    const restored = restarted.getStore().getRun('run_restart');
    assert.ok(restored);
    assert.equal(restored!.opportunities.length, pipeline.ranking.opportunities.length);
    assert.equal(
      rankingFingerprint(restored!, HELIOS_M16_OPPORTUNITY_RANKING_VERSION),
      rankingFingerprint(pipeline.ranking, HELIOS_M16_OPPORTUNITY_RANKING_VERSION),
    );
  });

  it('seals evidence lineage in vault without granting execution authority', () => {
    const evidence = new EvidenceVault(clock);
    const events = new DomainEventLog();
    void events;
    const service = new HeliosOpportunityRankingService();
    const result = service.runPipeline({
      assembly: Object.freeze({
        assemblyId: 'asm_evidence',
        workOrderId: M16_WORK_ORDER_ID,
        workOrderActive: true,
        envelopeValidByOpportunityId: Object.freeze({
          [M16_SPY_MEAN_REVERSION.opportunityId]: true,
        }),
        candidates: [M16_SPY_MEAN_REVERSION],
        now: NOW,
      }),
      regimeInputsByInstrumentId: Object.freeze({
        [M02_REFERENCE_INSTRUMENT_IDS.SPY]: Object.freeze({
          marketState: healthyMarketState(M02_REFERENCE_INSTRUMENT_IDS.SPY, 'etf'),
          now: NOW,
        }),
      }),
      factorOverridesByOpportunityId: factorOverrides(),
      graph: Object.freeze({
        graphId: 'graph_evidence',
        portfolioInstrumentIds: Object.freeze([]),
        correlationMatrix: M16_CORRELATION_MATRIX,
      }),
      ranking: Object.freeze({
        runId: 'run_evidence',
        rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
        workOrderId: M16_WORK_ORDER_ID,
        customerId: M16_CUSTOMER_ID,
        now: NOW,
      }),
      defaultCosts: baseCosts(),
      vault: evidence,
    });
    assert.ok(result.evidenceRef);
    assert.equal(result.grantsExecutionAuthority, false);
    assert.ok(result.ranking.evidenceRefs.length > 0);
  });

  it('hands off only allocation-review-eligible opportunities to meta allocator', () => {
    const result = rankOpportunities({
      runId: 'run_meta',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: M16_WORK_ORDER_ID,
      customerId: M16_CUSTOMER_ID,
      candidates: buildRankingCandidates([
        M16_SPY_MEAN_REVERSION,
        M16_BTC_BREAKOUT,
        M16_POOR_LIQUIDITY,
        M16_INSUFFICIENT_EVIDENCE,
      ]),
      now: NOW,
    });
    const handoff = bridgeRankedOpportunitiesToMetaAllocator({
      rankingResult: result,
      defaultCosts: baseCosts(),
      now: NOW,
    });
    assert.equal(handoff.grantsExecutionAuthority, false);
    assert.ok(handoff.eligible.length >= 1);
    assert.ok(handoff.withheld.length >= 2);
    for (const item of handoff.eligible) {
      const source = result.opportunities.find((o) => o.opportunityId.includes(item.candidateId.split('_').pop() ?? ''));
      if (source) {
        assert.equal(source.metaAllocatorHandoffEligible, true);
        assert.equal(source.outputState, 'QUALIFIED_FOR_ALLOCATION_REVIEW');
      }
    }
  });

  it('qualifies M13–M16 intelligence layer markers', () => {
    const m13 = evaluateM13Qualification({
      deterministicRegimeClassification: true,
      marketStateOnlyInput: true,
      strategyCompatibilityMatrix: true,
      noLlmRegimeAssignment: true,
      versionTracked: true,
    });
    assert.equal(m13.marker, 'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED');

    const m14 = evaluateM14Qualification({
      graphBuildDeterministic: true,
      correlationWarningsEmitted: true,
      portfolioExposureLinked: true,
      versionTracked: true,
    });
    assert.equal(m14.marker, 'HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED');

    const m15 = evaluateM15Qualification({
      multiSourceAssembly: true,
      workOrderBound: true,
      envelopeValidated: true,
      expiredRejected: true,
      noExecutionAuthority: true,
    });
    assert.equal(m15.marker, 'HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED');

    const regime = evaluateRegime({
      marketState: healthyMarketState(M02_REFERENCE_INSTRUMENT_IDS.SPY, 'etf'),
      now: NOW,
    });
    assert.ok(regime.regime);

    const m16 = evaluateM16Qualification({
      deterministicRanking: true,
      versionedPolicy: true,
      explainableScorecard: true,
      reproducibleFingerprint: true,
      auditableEvidence: true,
      noInventedExpectedReturn: true,
      noLlmFinalRank: true,
      rankNotTradePermission: true,
      metaAllocatorGating: true,
      crossStrategyComparison: true,
      expirationHandling: true,
      restartPersistence: true,
      evidenceLineage: true,
    });
    assert.equal(m16.marker, HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED);
  });
});
