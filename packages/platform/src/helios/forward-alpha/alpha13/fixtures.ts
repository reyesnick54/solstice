import type { ForwardStrategyLeg } from './types.ts';

const SERIES_DIVERSIFIED_A: readonly number[] = Object.freeze([120, -40, 80, 60, 30, 50, 20]);
const SERIES_DIVERSIFIED_B: readonly number[] = Object.freeze([10, 25, -15, 40, 5, -10, 35]);
const SERIES_DIVERSIFIED_C: readonly number[] = Object.freeze([-5, 15, 20, -8, 12, 18, 6]);

/** Correlated pair both long AAPL — overlap and duplicate-edge stress. */
export const alpha13OverlappingAaplLegs = (): readonly ForwardStrategyLeg[] =>
  Object.freeze([
    Object.freeze({
      strategyId: 'strat_momentum_v3',
      strategyVersion: '3.1.0',
      periodReturnBps: 320,
      activeReturnBps: 280,
      standaloneAlphaBps: 300,
      returnSeriesBps: Object.freeze([100, 120, 90, 110, 105, 95, 115]),
      positions: Object.freeze([
        Object.freeze({ instrumentId: 'AAPL', weightBps: 4_500, sectorId: 'TECH' }),
        Object.freeze({ instrumentId: 'MSFT', weightBps: 1_500, sectorId: 'TECH' }),
      ]),
      factorExposureBps: Object.freeze({ MKT: 1_200, TECH: 3_500 }),
      maxDrawdownBps: 800,
      riskLimitUtilizationBps: 6_200,
    }),
    Object.freeze({
      strategyId: 'strat_quality_v2',
      strategyVersion: '2.4.0',
      periodReturnBps: 290,
      activeReturnBps: 250,
      standaloneAlphaBps: 270,
      returnSeriesBps: Object.freeze([98, 118, 88, 108, 103, 93, 113]),
      positions: Object.freeze([
        Object.freeze({ instrumentId: 'AAPL', weightBps: 3_800, sectorId: 'TECH' }),
        Object.freeze({ instrumentId: 'KO', weightBps: 1_200, sectorId: 'STAPLES' }),
      ]),
      factorExposureBps: Object.freeze({ MKT: 900, TECH: 2_800 }),
      maxDrawdownBps: 750,
      riskLimitUtilizationBps: 5_800,
    }),
  ]);

/** Diversified legs with offsetting and independent edges — should qualify. */
export const alpha13DiversifiedLegs = (): readonly ForwardStrategyLeg[] =>
  Object.freeze([
    Object.freeze({
      strategyId: 'strat_carry_v1',
      strategyVersion: '1.0.0',
      periodReturnBps: 180,
      activeReturnBps: 160,
      standaloneAlphaBps: 150,
      returnSeriesBps: SERIES_DIVERSIFIED_A,
      positions: Object.freeze([
        Object.freeze({ instrumentId: 'XOM', weightBps: 3_000, sectorId: 'ENERGY' }),
        Object.freeze({ instrumentId: 'CVX', weightBps: -1_000, sectorId: 'ENERGY' }),
      ]),
      factorExposureBps: Object.freeze({ MKT: 400, ENERGY: 2_200 }),
      maxDrawdownBps: 600,
      riskLimitUtilizationBps: 4_500,
    }),
    Object.freeze({
      strategyId: 'strat_reversion_v4',
      strategyVersion: '4.2.0',
      periodReturnBps: 140,
      activeReturnBps: 120,
      standaloneAlphaBps: 110,
      returnSeriesBps: SERIES_DIVERSIFIED_B,
      positions: Object.freeze([
        Object.freeze({ instrumentId: 'JNJ', weightBps: 2_500, sectorId: 'HEALTH' }),
        Object.freeze({ instrumentId: 'PG', weightBps: 1_500, sectorId: 'STAPLES' }),
      ]),
      factorExposureBps: Object.freeze({ MKT: 300, DEFENSIVE: 1_800 }),
      maxDrawdownBps: 450,
      riskLimitUtilizationBps: 3_800,
    }),
    Object.freeze({
      strategyId: 'strat_macro_v2',
      strategyVersion: '2.0.1',
      periodReturnBps: 130,
      activeReturnBps: 105,
      standaloneAlphaBps: 95,
      returnSeriesBps: SERIES_DIVERSIFIED_C,
      positions: Object.freeze([
        Object.freeze({ instrumentId: 'TLT', weightBps: 2_000, sectorId: 'RATES' }),
        Object.freeze({ instrumentId: 'GLD', weightBps: 1_000, sectorId: 'COMMODITIES' }),
        Object.freeze({ instrumentId: 'XOM', weightBps: -800, sectorId: 'ENERGY' }),
      ]),
      factorExposureBps: Object.freeze({ RATES: 2_500, COMMODITIES: 900 }),
      maxDrawdownBps: 500,
      riskLimitUtilizationBps: 3_200,
    }),
  ]);
