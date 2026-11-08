import { ALPHA12_IMPACT_MODEL_VERSION } from './taxonomy.ts';
import type { Alpha12CapacityEngineInput, Alpha12ImpactModelConfig } from './types.ts';

export const DEFAULT_ALPHA12_IMPACT_MODEL: Alpha12ImpactModelConfig = Object.freeze({
  version: ALPHA12_IMPACT_MODEL_VERSION,
  sqrtImpactCoeffBps: 45,
  temporaryImpactDecay: 0.85,
  permanentImpactCoeffBps: 12,
  maxImpactBps: 2_500,
});

/** Thin micro-cap — viable at 1x, breaks before 10x. */
export function fixtureAlpha12MicroCapacityInput(): Alpha12CapacityEngineInput {
  return Object.freeze({
    strategyId: 'fixture-micro-mean-revert',
    campaignShadowCapitalMinor: '1000000',
    currency: 'USD',
    baselineGrossAlphaBps: 320,
    annualTurnoverRatio: 6,
    executionDurationHours: 2.5,
    commissionBpsPerSide: 0.5,
    impactModel: Object.freeze({
      ...DEFAULT_ALPHA12_IMPACT_MODEL,
      sqrtImpactCoeffBps: 120,
    }),
    legs: Object.freeze([
      Object.freeze({
        legId: 'leg-1',
        instrumentId: 'MICRO_EQ_1',
        venueId: 'SIM_VENUE_A',
        weightBps: 10_000,
        advNotionalMinor: '80000000',
        marketDepthNotionalMinor: '12000000',
        spreadBps: 18,
        maxParticipationRateBps: 800,
        venueAdvNotionalMinor: '120000000',
      }),
    ]),
  });
}

/** Diversified mid-liquidity — scales further but still hits ceiling below 50x. */
export function fixtureAlpha12MidCapacityInput(): Alpha12CapacityEngineInput {
  return Object.freeze({
    strategyId: 'fixture-mid-stat-arb',
    campaignShadowCapitalMinor: '500000000',
    currency: 'USD',
    baselineGrossAlphaBps: 95,
    annualTurnoverRatio: 6,
    executionDurationHours: 4,
    commissionBpsPerSide: 0.35,
    impactModel: DEFAULT_ALPHA12_IMPACT_MODEL,
    legs: Object.freeze([
      Object.freeze({
        legId: 'leg-a',
        instrumentId: 'LARGE_EQ_A',
        venueId: 'SIM_VENUE_NYSE',
        weightBps: 3500,
        advNotionalMinor: '250000000000',
        marketDepthNotionalMinor: '15000000000',
        spreadBps: 4,
        maxParticipationRateBps: 1_000,
        venueAdvNotionalMinor: '900000000000',
      }),
      Object.freeze({
        legId: 'leg-b',
        instrumentId: 'LARGE_EQ_B',
        venueId: 'SIM_VENUE_NYSE',
        weightBps: 3500,
        advNotionalMinor: '180000000000',
        marketDepthNotionalMinor: '12000000000',
        spreadBps: 5,
        maxParticipationRateBps: 1_000,
        venueAdvNotionalMinor: '900000000000',
      }),
      Object.freeze({
        legId: 'leg-c',
        instrumentId: 'LARGE_EQ_C',
        venueId: 'SIM_VENUE_NASDAQ',
        weightBps: 3000,
        advNotionalMinor: '95000000000',
        marketDepthNotionalMinor: '8000000000',
        spreadBps: 6,
        maxParticipationRateBps: 900,
        venueAdvNotionalMinor: '400000000000',
      }),
    ]),
  });
}
