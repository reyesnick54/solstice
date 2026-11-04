import { asUtcInstant } from '@solstice/domain';

import type { EarningsForecast } from './types.ts';
import { createHeliosEarningsStateEstimatorService } from './state-estimator/service.ts';
import { DEFAULT_EXPERT_PRIMARY_TARGETS } from './state-estimator/expert-targets.ts';
import { earningsDecimalToNumber, parseEarningsDecimal } from './state-estimator/numeric.ts';
import type { EarningsExpertKind } from './state-estimator/taxonomy.ts';

export const EARN09_PROBABILISTIC_ESTIMATOR_MODULE =
  'packages/platform/src/helios/earnings-intelligence/state-estimator/index.ts' as const;

const SCALE = 1_000_000n;

function minorToDecimalString(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  const body = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return negative ? `-${body}` : body;
}

function decimalToMinor(value: string): bigint {
  const parsed = parseEarningsDecimal(value);
  if (!parsed.ok) return 0n;
  return parsed.scaled;
}

function expertSignal(
  expertKind: EarningsExpertKind,
  estimate: number,
  uncertainty: number,
  dataQuality: number,
): import('./state-estimator/types.ts').EarningsExpertSignal {
  return Object.freeze({
    expertKind,
    estimate,
    uncertainty,
    dataQuality,
    historicalCalibration: 0.75,
    applicableRegime: Object.freeze(['mid_cycle']),
    primaryTargets: DEFAULT_EXPERT_PRIMARY_TARGETS[expertKind],
    evaluatedAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
  });
}

/** Pipeline adapter — maps legacy bigint inputs into the full EARN09 mixture estimator. */
export function estimateEarningsDistribution(input: {
  readonly consensusEpsMinor: bigint;
  readonly consensusRevenueMinor: bigint;
  readonly surpriseHistoryBps: readonly number[];
  readonly toneBps: number;
  readonly qualityScoreBps: number;
}): EarningsForecast {
  const hist =
    input.surpriseHistoryBps.length === 0
      ? 0
      : input.surpriseHistoryBps.reduce((a, b) => a + b, 0) / input.surpriseHistoryBps.length;
  const tone = input.toneBps / 10_000;
  const quality = input.qualityScoreBps / 10_000;
  const beatHint = Math.min(0.95, Math.max(0.05, 0.5 + hist / 20_000 + (tone - 0.5) * 0.15));

  const epsDecimal = minorToDecimalString(input.consensusEpsMinor);
  const revenueDecimal = minorToDecimalString(input.consensusRevenueMinor);
  const epsLevel = earningsDecimalToNumber(decimalToMinor(epsDecimal));
  const revenueLevel = earningsDecimalToNumber(decimalToMinor(revenueDecimal));

  const service = createHeliosEarningsStateEstimatorService();
  const state = service.estimate({
    instrumentId: 'pipeline:fixture',
    fiscalPeriodKey: 'pipeline',
    asOf: asUtcInstant('2026-01-01T00:00:00.000Z'),
    gating: Object.freeze({
      sector: 'TECHNOLOGY',
      marketCapTier: 'LARGE',
      liquidityScore: 0.8,
      earningsRegime: 'mid_cycle',
      macroRegime: 'mid_cycle',
      dataCoverage: 0.85,
      forecastDispersion: 0.35,
      optionsAvailable: true,
    }),
    expertSignals: Object.freeze([
      expertSignal('StreetExpectationExpert', epsLevel, 0.12, 0.9),
      expertSignal('FundamentalTrendExpert', epsLevel * (1 + hist / 50_000), 0.18, 0.85),
      expertSignal('PeerReadThroughExpert', revenueLevel, 0.35, 0.78),
      expertSignal('EarningsQualityExpert', 1 - quality, 0.1, 0.8),
      expertSignal('TranscriptExpert', tone, 0.15, 0.7),
      expertSignal('OptionsExpert', beatHint, 0.08, 0.88),
      expertSignal('MacroExpert', 0.55, 0.12, 0.72),
      expertSignal('MarketReactionExpert', hist / 10_000, 0.025, 0.65),
    ]),
  });

  const epsMinor = decimalToMinor(state.nextQuarterEps.pointEstimate);
  const revenueMinor = decimalToMinor(state.nextQuarterRevenue.pointEstimate);
  const beatProbabilityBps = Math.round(state.beatProbability.probability * 10_000);
  const interval = state.nextQuarterEps.conformalInterval;
  const low =
    interval === null
      ? epsMinor - (epsMinor / 20n === 0n ? 1n : epsMinor / 20n)
      : decimalToMinor(String(interval.lower));
  const high =
    interval === null
      ? epsMinor + (epsMinor / 20n === 0n ? 1n : epsMinor / 20n)
      : decimalToMinor(String(interval.upper));

  return Object.freeze({
    epsMinor,
    revenueMinor,
    beatProbabilityBps,
    intervalLowEpsMinor: low,
    intervalHighEpsMinor: high,
  });
}
