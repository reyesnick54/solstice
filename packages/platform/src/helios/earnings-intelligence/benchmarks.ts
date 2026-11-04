import type { EarningsBenchmarkStrategy } from './taxonomy.ts';
import type { BenchmarkComparisonRow, EarningsForecast, ForecastMetrics, InvestmentResearchMetrics } from './types.ts';
import { computeForecastMetrics, computeInvestmentResearchMetrics } from './metrics.ts';

export type LabeledEarningsOutcome = {
  readonly epsActualMinor: bigint;
  readonly revenueActualMinor: bigint;
  readonly epsConsensusMinor: bigint;
  readonly revenueConsensusMinor: bigint;
  readonly beatObserved: boolean;
  readonly residualReturnBps: number;
  readonly fundamentalsSignalBps: number;
  readonly transcriptToneBps: number;
  readonly optionsImpliedBps: number;
  readonly seasonalEpsMinor: bigint;
  readonly lastQuarterEpsMinor: bigint;
};

export function runEarningsBenchmark(
  strategy: EarningsBenchmarkStrategy,
  rows: readonly LabeledEarningsOutcome[],
  heliosForecast?: EarningsForecast,
): BenchmarkComparisonRow {
  const epsPredicted: bigint[] = [];
  const revenuePredicted: bigint[] = [];
  const beatProbBps: number[] = [];
  const intervalLow: bigint[] = [];
  const intervalHigh: bigint[] = [];
  const scores: number[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    let forecast: EarningsForecast;
    switch (strategy) {
      case 'NAIVE_SEASONAL_EARNINGS':
        forecast = {
          epsMinor: row.seasonalEpsMinor,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_000,
          intervalLowEpsMinor: row.seasonalEpsMinor - 2n,
          intervalHighEpsMinor: row.seasonalEpsMinor + 2n,
        };
        break;
      case 'ROBUST_CONSENSUS':
        forecast = {
          epsMinor: row.epsConsensusMinor,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_100,
          intervalLowEpsMinor: row.epsConsensusMinor - 3n,
          intervalHighEpsMinor: row.epsConsensusMinor + 3n,
        };
        break;
      case 'LAST_QUARTER':
        forecast = {
          epsMinor: row.lastQuarterEpsMinor,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 4_900,
          intervalLowEpsMinor: row.lastQuarterEpsMinor - 2n,
          intervalHighEpsMinor: row.lastQuarterEpsMinor + 2n,
        };
        break;
      case 'CONSENSUS_ONLY':
        forecast = {
          epsMinor: row.epsConsensusMinor,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_000,
          intervalLowEpsMinor: row.epsConsensusMinor - 1n,
          intervalHighEpsMinor: row.epsConsensusMinor + 1n,
        };
        break;
      case 'FUNDAMENTALS_ONLY':
        forecast = {
          epsMinor: row.epsConsensusMinor + BigInt(Math.round(row.fundamentalsSignalBps / 100)),
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_000 + Math.round(row.fundamentalsSignalBps / 10),
          intervalLowEpsMinor: row.epsConsensusMinor - 4n,
          intervalHighEpsMinor: row.epsConsensusMinor + 4n,
        };
        break;
      case 'TRANSCRIPT_ONLY':
        forecast = {
          epsMinor: row.epsConsensusMinor + BigInt(Math.round((row.transcriptToneBps - 5_000) / 200)),
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: row.transcriptToneBps,
          intervalLowEpsMinor: row.epsConsensusMinor - 5n,
          intervalHighEpsMinor: row.epsConsensusMinor + 5n,
        };
        break;
      case 'OPTIONS_ONLY':
        forecast = {
          epsMinor: row.epsConsensusMinor,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_000 + Math.round(row.optionsImpliedBps / 5),
          intervalLowEpsMinor: row.epsConsensusMinor - BigInt(Math.round(row.optionsImpliedBps / 100)),
          intervalHighEpsMinor: row.epsConsensusMinor + BigInt(Math.round(row.optionsImpliedBps / 100)),
        };
        break;
      case 'FULL_ENSEMBLE':
        forecast = {
          epsMinor:
            (row.epsConsensusMinor +
              row.seasonalEpsMinor +
              row.lastQuarterEpsMinor +
              row.epsConsensusMinor +
              BigInt(Math.round(row.fundamentalsSignalBps / 100))) /
            5n,
          revenueMinor: row.revenueConsensusMinor,
          beatProbabilityBps: 5_050,
          intervalLowEpsMinor: row.epsConsensusMinor - 3n,
          intervalHighEpsMinor: row.epsConsensusMinor + 3n,
        };
        break;
      case 'HELIOS_FULL_STACK':
        if (!heliosForecast) {
          throw new Error('HELIOS_FULL_STACK requires heliosForecast');
        }
        forecast = heliosForecast;
        break;
      default: {
        const unknown: never = strategy;
        throw new Error(`unknown benchmark strategy: ${unknown}`);
      }
    }
    epsPredicted.push(forecast.epsMinor);
    revenuePredicted.push(forecast.revenueMinor);
    beatProbBps.push(forecast.beatProbabilityBps);
    intervalLow.push(forecast.intervalLowEpsMinor);
    intervalHigh.push(forecast.intervalHighEpsMinor);
    scores.push(forecast.beatProbabilityBps - 5_000);
  }

  const forecast = computeForecastMetrics({
    epsActual: rows.map((r) => r.epsActualMinor),
    epsPredicted,
    revenueActual: rows.map((r) => r.revenueActualMinor),
    revenuePredicted,
    beatProbBps,
    beatObserved: rows.map((r) => r.beatObserved),
    intervalLow,
    intervalHigh,
  });

  const investment = computeInvestmentResearchMetrics({
    predictedScores: scores,
    realizedResidualBps: rows.map((r) => r.residualReturnBps),
    turnoverBps: strategy === 'HELIOS_FULL_STACK' ? 1_200 : 800,
    transactionCostBps: 15,
    slippageBps: 12,
    capacityUtilizationBps: 3_500,
  });

  return Object.freeze({ strategy, forecast, investment });
}

export function compareAllBenchmarks(
  rows: readonly LabeledEarningsOutcome[],
  heliosForecast: EarningsForecast,
): readonly BenchmarkComparisonRow[] {
  const strategies: EarningsBenchmarkStrategy[] = [
    'NAIVE_SEASONAL_EARNINGS',
    'ROBUST_CONSENSUS',
    'LAST_QUARTER',
    'CONSENSUS_ONLY',
    'FUNDAMENTALS_ONLY',
    'TRANSCRIPT_ONLY',
    'OPTIONS_ONLY',
    'FULL_ENSEMBLE',
    'HELIOS_FULL_STACK',
  ];
  return Object.freeze(
    strategies.map((strategy) =>
      runEarningsBenchmark(strategy, rows, strategy === 'HELIOS_FULL_STACK' ? heliosForecast : undefined),
    ),
  );
}

export function epsMaeImprovementBps(
  helios: ForecastMetrics,
  baseline: ForecastMetrics,
): number {
  const baselineNum = Number(baseline.epsMaeMinor);
  const heliosNum = Number(helios.epsMaeMinor);
  if (baselineNum === 0) {
    return 0;
  }
  return Math.round(((baselineNum - heliosNum) * 10_000) / baselineNum);
}
