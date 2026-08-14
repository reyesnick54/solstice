import { applyRational, Money, type Rational } from '@solstice/domain';
import { canonicalJson, sha256Hex } from '@solstice/kernel';
import type { SimulatedFxQuote } from '../fx/quotes.ts';
import type { PaymentRail, RailId, RailInstruction, RailQuote } from '../rails/types.ts';

export const ROUTE_SCORE_VERSION = 'ROUTE_SCORE_V1' as const;

export type RegulatoryVerdict = 'PERMITTED' | 'EXCLUDED';

export type RouteCandidate = {
  readonly railId: RailId;
  readonly railQuote: RailQuote;
  readonly fxQuote: SimulatedFxQuote | undefined;
  readonly regulatory: RegulatoryVerdict;
  readonly exclusionReason?: string;
};

export type ScoredRoute = {
  readonly railId: RailId;
  readonly score: bigint;
  readonly breakdown: {
    readonly cost: bigint;
    readonly exchangeRate: bigint;
    readonly speed: bigint;
    readonly liquidity: bigint;
    readonly counterparty: bigint;
    readonly reliability: bigint;
  };
  readonly railQuote: RailQuote;
  readonly fxQuote: SimulatedFxQuote | undefined;
  readonly totalFeeSource: Money;
};

export type RoutingDecision = {
  readonly version: typeof ROUTE_SCORE_VERSION;
  readonly chosen: ScoredRoute | undefined;
  readonly ranked: readonly ScoredRoute[];
  readonly excluded: readonly RouteCandidate[];
};

const W_COST = 30n;
const W_FX = 25n;
const W_SPEED = 15n;
const W_LIQ = 10n;
const W_CP = 10n;
const W_REL = 10n;
const W_SUM = W_COST + W_FX + W_SPEED + W_LIQ + W_CP + W_REL;

const LIQ_SCORE = { HIGH: 10_000n, MEDIUM: 5_000n, LOW: 0n } as const;
const CP_SCORE: Record<RailId, bigint> = {
  domestic: 9_000n,
  sepa_like: 8_500n,
  instant: 8_000n,
  swift_like: 4_000n,
};
const REL_SCORE: Record<RailId, bigint> = {
  domestic: 8_000n,
  sepa_like: 8_500n,
  instant: 7_500n,
  swift_like: 7_000n,
};

function feeInSource(
  railFee: Money,
  sourceCurrency: string,
  fxQuote: SimulatedFxQuote | undefined,
): Money {
  if (railFee.currency === sourceCurrency) {
    return railFee;
  }
  if (!fxQuote || fxQuote.to !== railFee.currency || fxQuote.from !== sourceCurrency) {
    return Money.of(railFee.minorUnits, sourceCurrency);
  }
  const sourceMinor = applyRational(railFee.minorUnits, {
    numerator: fxQuote.rate.denominator,
    denominator: fxQuote.rate.numerator,
  });
  return Money.of(sourceMinor, sourceCurrency);
}

function normalize(value: bigint, min: bigint, max: bigint, higherIsBetter: boolean): bigint {
  if (max === min) {
    return 10_000n;
  }
  const clamped = value < min ? min : value > max ? max : value;
  const span = max - min;
  const pos = higherIsBetter ? clamped - min : max - clamped;
  return (pos * 10_000n) / span;
}

function fxScore(quote: SimulatedFxQuote | undefined, pool: readonly SimulatedFxQuote[]): bigint {
  if (!quote || pool.length === 0) {
    return 10_000n;
  }
  const rates = pool.map((item) => (item.rate.numerator * 1_000_000n) / item.rate.denominator);
  const min = rates.reduce((a, b) => (a < b ? a : b));
  const max = rates.reduce((a, b) => (a > b ? a : b));
  const current = (quote.rate.numerator * 1_000_000n) / quote.rate.denominator;
  return normalize(current, min, max, true);
}

/**
 * Regulatory compatibility is a FILTER: non-permitted routes are excluded
 * and never scored. Scoring runs only on the permitted set.
 */
export function scoreRoutes(input: {
  readonly rails: readonly PaymentRail[];
  readonly instruction: RailInstruction;
  readonly sourceCurrency: string;
  readonly fxQuote: SimulatedFxQuote | undefined;
  readonly fxQuotes: readonly SimulatedFxQuote[];
  readonly corridorPermitted: boolean;
}): RoutingDecision {
  const candidates: RouteCandidate[] = [];
  for (const rail of input.rails) {
    const railQuote = rail.quote(input.instruction);
    if (!input.corridorPermitted) {
      candidates.push({
        railId: rail.id,
        railQuote,
        fxQuote: input.fxQuote,
        regulatory: 'EXCLUDED',
        exclusionReason: 'corridor is not permitted by policy',
      });
      continue;
    }
    if (!railQuote.available) {
      candidates.push({
        railId: rail.id,
        railQuote,
        fxQuote: input.fxQuote,
        regulatory: 'EXCLUDED',
        exclusionReason: railQuote.unavailabilityReason ?? 'rail not available',
      });
      continue;
    }
    candidates.push({
      railId: rail.id,
      railQuote,
      fxQuote: input.fxQuote,
      regulatory: 'PERMITTED',
    });
  }

  const excluded = candidates.filter((row) => row.regulatory === 'EXCLUDED');
  const permitted = candidates.filter((row) => row.regulatory === 'PERMITTED');

  const fees = permitted.map((row) =>
    feeInSource(row.railQuote.fee, input.sourceCurrency, input.fxQuote).add(
      input.fxQuote?.fee ?? Money.zero(input.sourceCurrency),
    ),
  );
  const feeMin = fees.reduce((a, b) => (a.minorUnits < b.minorUnits ? a : b), fees[0] ?? Money.zero(input.sourceCurrency));
  const feeMax = fees.reduce((a, b) => (a.minorUnits > b.minorUnits ? a : b), fees[0] ?? Money.zero(input.sourceCurrency));
  const speeds = permitted.map((row) => row.railQuote.settlementMs);
  const speedMin = speeds.reduce((a, b) => (a < b ? a : b), speeds[0] ?? 0n);
  const speedMax = speeds.reduce((a, b) => (a > b ? a : b), speeds[0] ?? 0n);

  const ranked: ScoredRoute[] = permitted.map((row, index) => {
    const totalFee = fees[index] ?? Money.zero(input.sourceCurrency);
    const cost = normalize(totalFee.minorUnits, feeMin.minorUnits, feeMax.minorUnits, false);
    const exchangeRate = fxScore(input.fxQuote, input.fxQuotes);
    const speed = normalize(row.railQuote.settlementMs, speedMin, speedMax, false);
    const liquidity = LIQ_SCORE[row.railQuote.liquidity];
    const counterparty = CP_SCORE[row.railId];
    const reliability = REL_SCORE[row.railId];
    const score =
      (cost * W_COST +
        exchangeRate * W_FX +
        speed * W_SPEED +
        liquidity * W_LIQ +
        counterparty * W_CP +
        reliability * W_REL) /
      W_SUM;
    return Object.freeze({
      railId: row.railId,
      score,
      breakdown: Object.freeze({
        cost,
        exchangeRate,
        speed,
        liquidity,
        counterparty,
        reliability,
      }),
      railQuote: row.railQuote,
      fxQuote: input.fxQuote,
      totalFeeSource: totalFee,
    });
  });

  ranked.sort((a, b) => {
    if (a.score !== b.score) return a.score > b.score ? -1 : 1;
    return a.railId < b.railId ? -1 : 1;
  });

  return Object.freeze({
    version: ROUTE_SCORE_VERSION,
    chosen: ranked[0],
    ranked: Object.freeze(ranked.slice()),
    excluded: Object.freeze(excluded.slice()),
  });
}

export function routingFingerprint(decision: RoutingDecision): string {
  return sha256Hex(
    canonicalJson({
      version: decision.version,
      chosen: decision.chosen?.railId,
      ranked: decision.ranked.map((row) => ({
        railId: row.railId,
        score: row.score.toString(),
      })),
      excluded: decision.excluded.map((row) => ({
        railId: row.railId,
        reason: row.exclusionReason,
      })),
    }),
  );
}

export type { Rational };
