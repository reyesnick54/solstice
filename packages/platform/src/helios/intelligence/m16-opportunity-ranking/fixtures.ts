/**
 * HELIOS M16 test fixtures — multi-asset opportunity ranking scenarios.
 */

import { asCustomerId } from '../../../../../domain/src/customer.ts';
import { asUtcInstant } from '../../../../../domain/src/time.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../../market-observation/instrument-registry.ts';
import { workOrderIdFor } from '../../ids.ts';

/** M08-aligned WTI commodity reference id (inline to avoid energy module import chain). */
export const M16_WTI_COMMODITY_REFERENCE_ID = 'COMMODITY:wti:USD:barrel' as const;
import type { AssembledOpportunityCandidate } from '../m15-opportunity-assembly/types.ts';
import type { OpportunityRankingFactorInput } from './types.ts';
import type { StrategyFamilyId } from '../m13-regime/taxonomy.ts';

export const M16_FIXTURE_NOW = asUtcInstant('2026-09-21T10:00:00.000Z');
export const M16_CUSTOMER_ID = asCustomerId('cust_m16_ranking');
export const M16_WORK_ORDER_ID = workOrderIdFor('cust_m16_ranking', 'm16');

const BASE_EVIDENCE = Object.freeze(['ev_m16_base_qualification', 'ev_m16_market_state']);

function candidate(
  opportunityId: string,
  overrides: Partial<AssembledOpportunityCandidate> & {
    strategyFamily: StrategyFamilyId;
    instrumentIds: readonly string[];
  },
): AssembledOpportunityCandidate {
  return Object.freeze({
    opportunityId,
    candidateId: `cand_${opportunityId}`,
    workOrderId: M16_WORK_ORDER_ID,
    customerId: M16_CUSTOMER_ID,
    subjectId: 'subject_m16',
    source: 'STRATEGY_LAB_M09',
    strategyId: `strat_${opportunityId}`,
    strategyVersion: '1',
    assetClass: 'etf',
    sector: 'BROAD_MARKET',
    evidenceRefs: BASE_EVIDENCE,
    envelopeRef: 'env_m16_valid',
    discoveredAt: asUtcInstant('2026-09-21T08:00:00.000Z'),
    expiresAt: asUtcInstant('2026-09-24T10:00:00.000Z'),
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
    ...overrides,
  });
}

export const M16_SPY_MEAN_REVERSION = candidate('opp_spy_mean_reversion', {
  source: 'STRATEGY_LAB_M09',
  strategyFamily: 'INDEX_MEAN_REVERSION',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
  assetClass: 'etf',
  sector: 'BROAD_MARKET',
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_m09_qualification', 'ev_reward_spy:4200bps']),
});

export const M16_BTC_BREAKOUT = candidate('opp_btc_breakout', {
  source: 'STRATEGY_LAB_M10',
  strategyFamily: 'CRYPTO_MOMENTUM_BREAKOUT',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.BTC]),
  assetClass: 'crypto',
  sector: 'CRYPTO',
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_m10_qualification', 'ev_reward_btc:6800bps']),
});

export const M16_GOLD_TREND = candidate('opp_gold_trend', {
  source: 'COMMODITY_TREND',
  strategyFamily: 'COMMODITY_TREND',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.GOLD]),
  assetClass: 'commodity',
  sector: 'PRECIOUS_METALS',
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_gold_trend', 'ev_reward_gold:5100bps']),
});

export const M16_OIL_TREND = candidate('opp_oil_trend', {
  source: 'COMMODITY_TREND',
  strategyFamily: 'COMMODITY_TREND',
  instrumentIds: Object.freeze([M16_WTI_COMMODITY_REFERENCE_ID]),
  assetClass: 'commodity',
  sector: 'ENERGY',
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_oil_trend', 'ev_reward_oil:4900bps']),
});

export const M16_POOR_LIQUIDITY = candidate('opp_poor_liquidity', {
  strategyFamily: 'INDEX_MEAN_REVERSION',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_reward_spy:9500bps']),
});

export const M16_STALE = candidate('opp_stale_signal', {
  strategyFamily: 'CRYPTO_MOMENTUM_BREAKOUT',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.BTC]),
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_reward_btc:7200bps']),
});

export const M16_HIGH_CORRELATION = candidate('opp_high_correlation', {
  strategyFamily: 'INDEX_MEAN_REVERSION',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_reward_spy:7000bps']),
});

export const M16_PROVIDER_UNAVAILABLE = candidate('opp_provider_unavailable', {
  strategyFamily: 'COMMODITY_TREND',
  instrumentIds: Object.freeze([M16_WTI_COMMODITY_REFERENCE_ID]),
  evidenceRefs: Object.freeze([...BASE_EVIDENCE, 'ev_reward_oil:6000bps']),
});

export const M16_INSUFFICIENT_EVIDENCE = candidate('opp_insufficient_evidence', {
  strategyFamily: 'AGENTIC_RESEARCH',
  instrumentIds: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
  evidenceRefs: Object.freeze(['ev_agentic_research_only']),
  envelopeRef: null,
});

export function factorOverrides(): Readonly<
  Record<string, Partial<OpportunityRankingFactorInput>>
> {
  return Object.freeze({
    [M16_SPY_MEAN_REVERSION.opportunityId]: Object.freeze({
      strategyConfidenceBps: 8200,
      expectedRewardEvidenceBps: 4200,
      expectedDownsideEvidenceBps: 1800,
      regimeCompatibility: Object.freeze({
        strategyFamily: 'INDEX_MEAN_REVERSION',
        regime: 'MEAN_REVERTING',
        compatible: true,
        score: 100,
        reason: 'regime MEAN_REVERTING compatible with INDEX_MEAN_REVERSION',
      }),
    }),
    [M16_BTC_BREAKOUT.opportunityId]: Object.freeze({
      strategyConfidenceBps: 7800,
      expectedRewardEvidenceBps: 6800,
      expectedDownsideEvidenceBps: 3200,
      regimeCompatibility: Object.freeze({
        strategyFamily: 'CRYPTO_MOMENTUM_BREAKOUT',
        regime: 'TRENDING_UP',
        compatible: true,
        score: 100,
        reason: 'regime TRENDING_UP compatible with CRYPTO_MOMENTUM_BREAKOUT',
      }),
    }),
    [M16_GOLD_TREND.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 5100,
      regimeCompatibility: Object.freeze({
        strategyFamily: 'COMMODITY_TREND',
        regime: 'TRENDING_UP',
        compatible: true,
        score: 100,
        reason: 'regime TRENDING_UP compatible with COMMODITY_TREND',
      }),
    }),
    [M16_OIL_TREND.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 4900,
      regimeCompatibility: Object.freeze({
        strategyFamily: 'COMMODITY_TREND',
        regime: 'HIGH_VOL',
        compatible: true,
        score: 100,
        reason: 'regime HIGH_VOL compatible with COMMODITY_TREND',
      }),
    }),
    [M16_POOR_LIQUIDITY.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 9500,
      liquidityScore: 5,
      spreadBps: 250,
      expectedDownsideEvidenceBps: 4500,
    }),
    [M16_STALE.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 7200,
      signalFreshnessScore: 10,
    }),
    [M16_HIGH_CORRELATION.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 7000,
      correlationPenaltyBps: 8500,
      correlationWarnings: Object.freeze([
        Object.freeze({
          candidateId: M16_HIGH_CORRELATION.candidateId,
          correlatedWith: Object.freeze([M02_REFERENCE_INSTRUMENT_IDS.SPY]),
          maxCorrelationBps: 8500,
          reason: 'correlation exceeds 7000 bps with existing exposure',
        }),
      ]),
    }),
    [M16_PROVIDER_UNAVAILABLE.opportunityId]: Object.freeze({
      expectedRewardEvidenceBps: 6000,
      providerAvailable: false,
      executionReady: false,
    }),
    [M16_INSUFFICIENT_EVIDENCE.opportunityId]: Object.freeze({
      strategyConfidenceBps: null,
      historicalQualificationState: 'NONE',
      expectedRewardEvidenceBps: null,
      expectedDownsideEvidenceBps: null,
      realizedVolatilityBps: null,
      liquidityScore: null,
      spreadBps: null,
      estimatedFeesBps: null,
      estimatedSlippageBps: null,
      dataQualityScore: null,
      evidenceQualityScore: 10,
      signalFreshnessScore: null,
    }),
  });
}

export const M16_CORRELATION_MATRIX = Object.freeze({
  [M02_REFERENCE_INSTRUMENT_IDS.SPY]: Object.freeze({
    [M02_REFERENCE_INSTRUMENT_IDS.SPY]: 10_000,
    [M02_REFERENCE_INSTRUMENT_IDS.BTC]: 2500,
    [M02_REFERENCE_INSTRUMENT_IDS.GOLD]: 1500,
    [M16_WTI_COMMODITY_REFERENCE_ID]: 1200,
  }),
  [M02_REFERENCE_INSTRUMENT_IDS.BTC]: Object.freeze({
    [M02_REFERENCE_INSTRUMENT_IDS.SPY]: 2500,
    [M02_REFERENCE_INSTRUMENT_IDS.BTC]: 10_000,
    [M02_REFERENCE_INSTRUMENT_IDS.GOLD]: 3000,
    [M16_WTI_COMMODITY_REFERENCE_ID]: 3500,
  }),
  [M02_REFERENCE_INSTRUMENT_IDS.GOLD]: Object.freeze({
    [M02_REFERENCE_INSTRUMENT_IDS.SPY]: 1500,
    [M02_REFERENCE_INSTRUMENT_IDS.BTC]: 3000,
    [M02_REFERENCE_INSTRUMENT_IDS.GOLD]: 10_000,
    [M16_WTI_COMMODITY_REFERENCE_ID]: 5500,
  }),
  [M16_WTI_COMMODITY_REFERENCE_ID]: Object.freeze({
    [M02_REFERENCE_INSTRUMENT_IDS.SPY]: 1200,
    [M02_REFERENCE_INSTRUMENT_IDS.BTC]: 3500,
    [M02_REFERENCE_INSTRUMENT_IDS.GOLD]: 5500,
    [M16_WTI_COMMODITY_REFERENCE_ID]: 10_000,
  }),
});
