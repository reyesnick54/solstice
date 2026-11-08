import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA05_SCHEMA } from './taxonomy.ts';
import type { BenchmarkPortfolio, BenchmarkPriceObservation, ForwardBenchmark } from './types.ts';

export type BuildBenchmarkPortfolioInput = {
  readonly forwardBenchmark: ForwardBenchmark;
  readonly currency: string;
  readonly startingCapitalMinor: bigint;
  readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly observations: readonly BenchmarkPriceObservation[];
  /** Pre-built equity for INCUMBENT_CHAMPION / STRATEGY_FAMILY_BASELINE / RISK_MATCHED fixtures. */
  readonly suppliedEquity?: readonly { readonly at: UtcInstant; readonly totalMinor: bigint }[];
  readonly primaryInstrumentId?: string;
  readonly equalWeightInstrumentIds?: readonly string[];
  readonly riskMatchScaleNumerator?: bigint;
  readonly riskMatchScaleDenominator?: bigint;
};

function stampsInPeriod(
  observations: readonly BenchmarkPriceObservation[],
  period: { readonly start: UtcInstant; readonly end: UtcInstant },
): readonly UtcInstant[] {
  const set = new Set<string>();
  for (const row of observations) {
    if (row.at >= period.start && row.at <= period.end) {
      set.add(row.at);
    }
  }
  return Object.freeze([...set].sort((a, b) => Date.parse(a) - Date.parse(b)));
}

function closeAt(
  observations: readonly BenchmarkPriceObservation[],
  at: UtcInstant,
  instrumentId: string,
): bigint | null {
  const row = observations.find((obs) => obs.at === at && obs.instrumentId === instrumentId);
  return row?.closeMinor ?? null;
}

function buildCashPortfolio(
  input: BuildBenchmarkPortfolioInput,
  stamps: readonly UtcInstant[],
): BenchmarkPortfolio {
  const equity = stamps.map((at) => Object.freeze({ at, totalMinor: input.startingCapitalMinor }));
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    benchmarkId: input.forwardBenchmark.benchmarkId,
    campaignId: input.forwardBenchmark.campaignId,
    kind: input.forwardBenchmark.kind,
    currency: input.currency,
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: input.startingCapitalMinor,
    equity,
  });
}

function buildBuyAndHoldPortfolio(
  input: BuildBenchmarkPortfolioInput,
  stamps: readonly UtcInstant[],
  instrumentId: string,
): BenchmarkPortfolio | null {
  let cash = input.startingCapitalMinor;
  let qty = 0n;
  const equity: { at: UtcInstant; totalMinor: bigint }[] = [];
  for (const at of stamps) {
    const px = closeAt(input.observations, at, instrumentId);
    if (px == null || px <= 0n) {
      equity.push(Object.freeze({ at, totalMinor: cash + qty * 0n }));
      continue;
    }
    if (qty === 0n) {
      qty = cash / px;
      cash -= qty * px;
    }
    equity.push(Object.freeze({ at, totalMinor: cash + qty * px }));
  }
  if (equity.length === 0) {
    return null;
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    benchmarkId: input.forwardBenchmark.benchmarkId,
    campaignId: input.forwardBenchmark.campaignId,
    kind: input.forwardBenchmark.kind,
    currency: input.currency,
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
  });
}

function buildEqualWeightPortfolio(
  input: BuildBenchmarkPortfolioInput,
  stamps: readonly UtcInstant[],
  instrumentIds: readonly string[],
): BenchmarkPortfolio | null {
  if (instrumentIds.length === 0) {
    return null;
  }
  const slice = input.startingCapitalMinor / BigInt(instrumentIds.length);
  const qty = new Map<string, bigint>();
  for (const id of instrumentIds) {
    qty.set(id, 0n);
  }
  let cash = input.startingCapitalMinor;
  let initialized = false;
  const equity: { at: UtcInstant; totalMinor: bigint }[] = [];
  for (const at of stamps) {
    if (!initialized) {
      for (const id of instrumentIds) {
        const px = closeAt(input.observations, at, id);
        if (px != null && px > 0n) {
          const q = slice / px;
          qty.set(id, q);
          cash -= q * px;
        }
      }
      initialized = true;
    }
    let mark = cash;
    for (const id of instrumentIds) {
      const q = qty.get(id) ?? 0n;
      const px = closeAt(input.observations, at, id) ?? 0n;
      mark += q * px;
    }
    equity.push(Object.freeze({ at, totalMinor: mark }));
  }
  if (equity.length === 0) {
    return null;
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    benchmarkId: input.forwardBenchmark.benchmarkId,
    campaignId: input.forwardBenchmark.campaignId,
    kind: input.forwardBenchmark.kind,
    currency: input.currency,
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
  });
}

function scaleSuppliedEquity(
  input: BuildBenchmarkPortfolioInput,
  equity: readonly { readonly at: UtcInstant; readonly totalMinor: bigint }[],
): BenchmarkPortfolio | null {
  if (equity.length === 0) {
    return null;
  }
  const num = input.riskMatchScaleNumerator ?? 1n;
  const den = input.riskMatchScaleDenominator ?? 1n;
  if (den === 0n) {
    return null;
  }
  const scaled = equity.map((row, index) => {
    if (index === 0) {
      return Object.freeze({ at: row.at, totalMinor: input.startingCapitalMinor });
    }
    const base0 = equity[0]?.totalMinor ?? input.startingCapitalMinor;
    const delta = row.totalMinor - base0;
    const scaledTotal = input.startingCapitalMinor + (delta * num) / den;
    return Object.freeze({ at: row.at, totalMinor: scaledTotal });
  });
  const ending = scaled[scaled.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    benchmarkId: input.forwardBenchmark.benchmarkId,
    campaignId: input.forwardBenchmark.campaignId,
    kind: input.forwardBenchmark.kind,
    currency: input.currency,
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity: scaled,
  });
}

function fromSuppliedEquity(input: BuildBenchmarkPortfolioInput): BenchmarkPortfolio | null {
  const equity = input.suppliedEquity;
  if (!equity || equity.length === 0) {
    return null;
  }
  const ending = equity[equity.length - 1]?.totalMinor ?? input.startingCapitalMinor;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    benchmarkId: input.forwardBenchmark.benchmarkId,
    campaignId: input.forwardBenchmark.campaignId,
    kind: input.forwardBenchmark.kind,
    currency: input.currency,
    startingCapitalMinor: input.startingCapitalMinor,
    endingCapitalMinor: ending,
    equity,
  });
}

/**
 * Constructs a benchmark portfolio path for forward alpha comparison.
 * Index and naive-signal kinds reuse buy-and-hold or supplied equity fixtures.
 */
export function buildBenchmarkPortfolio(input: BuildBenchmarkPortfolioInput): BenchmarkPortfolio | null {
  const stamps = stampsInPeriod(input.observations, input.period);
  const kind = input.forwardBenchmark.kind;

  if (kind === 'CASH') {
    return buildCashPortfolio(input, stamps);
  }

  const primary = input.primaryInstrumentId ?? input.forwardBenchmark.referenceId ?? undefined;
  const indexKinds = new Set<ForwardBenchmark['kind']>([
    'BUY_AND_HOLD',
    'MARKET_INDEX',
    'SECTOR_INDEX',
    'ASSET_CLASS',
    'NAIVE_SIGNAL',
  ]);

  if (indexKinds.has(kind) && primary) {
    return buildBuyAndHoldPortfolio(input, stamps, primary);
  }

  if (kind === 'EQUAL_WEIGHT') {
    const ids = input.equalWeightInstrumentIds ?? (primary ? [primary] : []);
    return buildEqualWeightPortfolio(input, stamps, ids);
  }

  if (kind === 'RISK_MATCHED' && input.suppliedEquity) {
    return scaleSuppliedEquity(input, input.suppliedEquity);
  }

  const suppliedKinds = new Set<ForwardBenchmark['kind']>([
    'STRATEGY_FAMILY_BASELINE',
    'INCUMBENT_CHAMPION',
    'RISK_MATCHED',
  ]);
  if (suppliedKinds.has(kind)) {
    return fromSuppliedEquity(input);
  }

  if (primary) {
    return buildBuyAndHoldPortfolio(input, stamps, primary);
  }

  return null;
}
