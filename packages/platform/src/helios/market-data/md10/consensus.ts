/**
 * DecentralizedMarketConsensusState — robust median / trimmed median over comparable observations only.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { assertLicensedSwapRate, filterCompatibleCommodity, filterCompatibleFx, filterCompatibleRates } from './compatibility.ts';
import { HELIOS_MD10_CONSENSUS_SCHEMA } from './taxonomy.ts';
import type {
  DecentralizedMarketConsensusState,
  MacroCommodityObservation,
  MacroFxObservation,
  MacroRateObservation,
  Md10Dispersion,
  RationalRate,
} from './types.ts';
import type { Md10ConsensusEstimator } from './taxonomy.ts';

function sortedBigint(values: readonly bigint[]): bigint[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function medianBigint(values: readonly bigint[]): bigint | null {
  if (values.length === 0) {
    return null;
  }
  const s = sortedBigint(values);
  const n = s.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return s[mid]!;
  }
  return (s[mid - 1]! + s[mid]!) / 2n;
}

function robustBigint(
  values: readonly bigint[],
  estimator: Md10ConsensusEstimator,
  trimCount: number,
): bigint | null {
  if (values.length === 0) {
    return null;
  }
  if (estimator === 'MEDIAN') {
    return medianBigint(values);
  }
  if (trimCount < 0 || !Number.isInteger(trimCount)) {
    return null;
  }
  const s = sortedBigint(values);
  if (s.length <= trimCount * 2) {
    return null;
  }
  return medianBigint(s.slice(trimCount, s.length - trimCount));
}

function medianRational(observations: readonly MacroFxObservation[], side: 'bid' | 'ask'): RationalRate | null {
  const numerators = observations.map((row) => (side === 'bid' ? row.bid.numerator : row.ask.numerator));
  const denominators = observations.map((row) => (side === 'bid' ? row.bid.denominator : row.ask.denominator));
  const denomSet = new Set(denominators.map((d) => d.toString()));
  if (denomSet.size !== 1) {
    return null;
  }
  const denominator = denominators[0]!;
  const scaled = numerators.map((n) => n);
  const est = medianBigint(scaled);
  if (est === null) {
    return null;
  }
  return Object.freeze({ numerator: est, denominator });
}

function trimmedRational(
  observations: readonly MacroFxObservation[],
  side: 'bid' | 'ask',
  trimCount: number,
): RationalRate | null {
  const numerators = observations.map((row) => (side === 'bid' ? row.bid.numerator : row.ask.numerator));
  const denominators = observations.map((row) => (side === 'bid' ? row.bid.denominator : row.ask.denominator));
  const denomSet = new Set(denominators.map((d) => d.toString()));
  if (denomSet.size !== 1) {
    return null;
  }
  const denominator = denominators[0]!;
  const est = robustBigint(numerators, 'TRIMMED_MEDIAN', trimCount);
  if (est === null) {
    return null;
  }
  return Object.freeze({ numerator: est, denominator });
}

function fxMidMinorUnits(observation: MacroFxObservation, priceScale: number): bigint {
  const bidScaled = (observation.bid.numerator * BigInt(10 ** priceScale)) / observation.bid.denominator;
  const askScaled = (observation.ask.numerator * BigInt(10 ** priceScale)) / observation.ask.denominator;
  return (bidScaled + askScaled) / 2n;
}

function dispersionFromMids(mids: readonly bigint[], priceScale: number): Md10Dispersion | null {
  if (mids.length < 2) {
    return null;
  }
  const ordered = sortedBigint(mids);
  const span = ordered[ordered.length - 1]! - ordered[0]!;
  return Object.freeze({
    spanMinorUnits: span,
    priceScale,
    sourceMidsUsed: mids.length,
  });
}

function defaultTrimCount(count: number): number {
  if (count >= 7) {
    return 1;
  }
  return 0;
}

function buildConsensusBase(input: {
  readonly consensusKey: string;
  readonly domain: DecentralizedMarketConsensusState['domain'];
  readonly status: DecentralizedMarketConsensusState['status'];
  readonly estimator: Md10ConsensusEstimator;
  readonly trimCount: number;
  readonly evaluatedAt: UtcInstant;
  readonly sourceCount: number;
  readonly contributingObservationIds: readonly string[];
}): DecentralizedMarketConsensusState {
  return Object.freeze({
    schema: HELIOS_MD10_CONSENSUS_SCHEMA,
    consensusKey: input.consensusKey,
    domain: input.domain,
    status: input.status,
    estimator: input.estimator,
    trimCount: input.trimCount,
    consolidatedBid: null,
    consolidatedAsk: null,
    consolidatedValueBps: null,
    consolidatedPriceMinorUnits: null,
    priceScale: null,
    dispersion: null,
    sourceCount: input.sourceCount,
    contributingObservationIds: input.contributingObservationIds,
    grantsSingleTruePrice: false,
    evaluatedAt: input.evaluatedAt,
  });
}

export function buildFxDecentralizedConsensus(input: {
  readonly seed: MacroFxObservation;
  readonly observations: readonly MacroFxObservation[];
  readonly evaluatedAt?: UtcInstant;
  readonly estimator?: Md10ConsensusEstimator;
  readonly trimCount?: number;
  readonly priceScale?: number;
}): DecentralizedMarketConsensusState {
  const evaluatedAt = input.evaluatedAt ?? asUtcInstant(new Date().toISOString());
  const compatible = filterCompatibleFx(input.seed, input.observations);
  const ids = Object.freeze(compatible.map((row) => row.provenance.observationId).sort());
  const consensusKey = `fx:${input.seed.baseCurrency}/${input.seed.quoteCurrency}:${input.seed.tenor}:${compatible[0] ? compatible[0].kind : input.seed.kind}`;

  if (compatible.length === 0) {
    return buildConsensusBase({
      consensusKey,
      domain: 'fx',
      status: 'INSUFFICIENT',
      estimator: input.estimator ?? 'MEDIAN',
      trimCount: input.trimCount ?? 0,
      evaluatedAt,
      sourceCount: 0,
      contributingObservationIds: Object.freeze([]),
    });
  }

  const estimator = input.estimator ?? (compatible.length >= 5 ? 'TRIMMED_MEDIAN' : 'MEDIAN');
  const trimCount = input.trimCount ?? defaultTrimCount(compatible.length);
  const priceScale = input.priceScale ?? 5;

  const consolidatedBid =
    estimator === 'TRIMMED_MEDIAN'
      ? trimmedRational(compatible, 'bid', trimCount)
      : medianRational(compatible, 'bid');
  const consolidatedAsk =
    estimator === 'TRIMMED_MEDIAN'
      ? trimmedRational(compatible, 'ask', trimCount)
      : medianRational(compatible, 'ask');

  if (consolidatedBid === null || consolidatedAsk === null) {
    return buildConsensusBase({
      consensusKey,
      domain: 'fx',
      status: 'INCOMPATIBLE',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    });
  }

  const mids = compatible.map((row) => fxMidMinorUnits(row, priceScale));
  const dispersion = dispersionFromMids(mids, priceScale);

  return Object.freeze({
    ...buildConsensusBase({
      consensusKey,
      domain: 'fx',
      status: 'CONSOLIDATED',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    }),
    consolidatedBid,
    consolidatedAsk,
    priceScale,
    dispersion,
  });
}

export function buildRateDecentralizedConsensus(input: {
  readonly seed: MacroRateObservation;
  readonly observations: readonly MacroRateObservation[];
  readonly evaluatedAt?: UtcInstant;
  readonly estimator?: Md10ConsensusEstimator;
  readonly trimCount?: number;
}): DecentralizedMarketConsensusState {
  const evaluatedAt = input.evaluatedAt ?? asUtcInstant(new Date().toISOString());
  const compatible = filterCompatibleRates(input.seed, input.observations).filter(assertLicensedSwapRate);
  const ids = Object.freeze(compatible.map((row) => row.provenance.observationId).sort());
  const consensusKey = `rates:${input.seed.kind}:${input.seed.jurisdiction}:${input.seed.currency}:${input.seed.tenorLabel}`;

  if (compatible.length === 0) {
    return buildConsensusBase({
      consensusKey,
      domain: 'rates',
      status: 'INSUFFICIENT',
      estimator: input.estimator ?? 'MEDIAN',
      trimCount: input.trimCount ?? 0,
      evaluatedAt,
      sourceCount: 0,
      contributingObservationIds: Object.freeze([]),
    });
  }

  const estimator = input.estimator ?? (compatible.length >= 5 ? 'TRIMMED_MEDIAN' : 'MEDIAN');
  const trimCount = input.trimCount ?? defaultTrimCount(compatible.length);
  const values = compatible.map((row) => BigInt(row.valueBps));
  const consolidated = robustBigint(values, estimator, trimCount);

  if (consolidated === null) {
    return buildConsensusBase({
      consensusKey,
      domain: 'rates',
      status: 'INCOMPATIBLE',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    });
  }

  const ordered = sortedBigint(values);
  const dispersion = Object.freeze({
    spanMinorUnits: ordered[ordered.length - 1]! - ordered[0]!,
    priceScale: 0,
    sourceMidsUsed: values.length,
  });

  return Object.freeze({
    ...buildConsensusBase({
      consensusKey,
      domain: 'rates',
      status: 'CONSOLIDATED',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    }),
    consolidatedValueBps: Number(consolidated),
    priceScale: 0,
    dispersion,
  });
}

export function buildCommodityDecentralizedConsensus(input: {
  readonly seed: MacroCommodityObservation;
  readonly observations: readonly MacroCommodityObservation[];
  readonly evaluatedAt?: UtcInstant;
  readonly estimator?: Md10ConsensusEstimator;
  readonly trimCount?: number;
}): DecentralizedMarketConsensusState {
  const evaluatedAt = input.evaluatedAt ?? asUtcInstant(new Date().toISOString());
  const compatible = filterCompatibleCommodity(input.seed, input.observations);
  const ids = Object.freeze(compatible.map((row) => row.provenance.observationId).sort());
  const consensusKey = `commodity:${input.seed.commodityCode}:${input.seed.kind}:${input.seed.contractMonth ?? 'spot'}`;

  if (compatible.length === 0) {
    return buildConsensusBase({
      consensusKey,
      domain: 'commodity',
      status: 'INSUFFICIENT',
      estimator: input.estimator ?? 'MEDIAN',
      trimCount: input.trimCount ?? 0,
      evaluatedAt,
      sourceCount: 0,
      contributingObservationIds: Object.freeze([]),
    });
  }

  const priceScale = compatible[0]!.priceScale;
  if (!compatible.every((row) => row.priceScale === priceScale)) {
    return buildConsensusBase({
      consensusKey,
      domain: 'commodity',
      status: 'INCOMPATIBLE',
      estimator: input.estimator ?? 'MEDIAN',
      trimCount: input.trimCount ?? 0,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    });
  }

  const estimator = input.estimator ?? (compatible.length >= 5 ? 'TRIMMED_MEDIAN' : 'MEDIAN');
  const trimCount = input.trimCount ?? defaultTrimCount(compatible.length);
  const values = compatible.map((row) => row.priceMinorUnits);
  const consolidated = robustBigint(values, estimator, trimCount);

  if (consolidated === null) {
    return buildConsensusBase({
      consensusKey,
      domain: 'commodity',
      status: 'INCOMPATIBLE',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    });
  }

  const ordered = sortedBigint(values);
  const dispersion = Object.freeze({
    spanMinorUnits: ordered[ordered.length - 1]! - ordered[0]!,
    priceScale,
    sourceMidsUsed: values.length,
  });

  return Object.freeze({
    ...buildConsensusBase({
      consensusKey,
      domain: 'commodity',
      status: 'CONSOLIDATED',
      estimator,
      trimCount,
      evaluatedAt,
      sourceCount: compatible.length,
      contributingObservationIds: ids,
    }),
    consolidatedPriceMinorUnits: consolidated,
    priceScale,
    dispersion,
  });
}
