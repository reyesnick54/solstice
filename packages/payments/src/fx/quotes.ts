import {
  asQuoteId,
  asRational,
  asUtcInstant,
  multiplyRational,
  type CurrencyCode,
  type QuoteId,
  type Rational,
  type UtcInstant,
  Money,
} from '@solstice/domain';
import { assertSimulationOnly, canonicalJson, LIVE_FLAGS, sha256Hex } from '@solstice/kernel';

export const QUOTE_SOURCES = ['SIM_REF', 'SIM_MKT', 'SIM_ECB'] as const;
export type QuoteSourceId = (typeof QUOTE_SOURCES)[number];

export type FxPair = {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
};

export type SimulatedFxQuote = {
  readonly id: QuoteId;
  readonly source: QuoteSourceId;
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  readonly rate: Rational;
  readonly mid: Rational;
  readonly fee: Money;
  readonly settlementMs: bigint;
  readonly timestamp: UtcInstant;
  readonly seed: string;
};

const MID_MARKET: Readonly<Record<string, Rational>> = {
  'USD/EUR': asRational(92n, 100n),
  'EUR/USD': asRational(100n, 92n),
  'USD/GBP': asRational(79n, 100n),
  'GBP/USD': asRational(100n, 79n),
  'EUR/GBP': asRational(86n, 100n),
  'GBP/EUR': asRational(100n, 86n),
};

const SOURCE_SPREAD_BP: Readonly<Record<QuoteSourceId, bigint>> = {
  SIM_ECB: 1n,
  SIM_REF: 4n,
  SIM_MKT: 12n,
};

const SOURCE_FEE_MINOR: Readonly<Record<QuoteSourceId, bigint>> = {
  SIM_ECB: 15n,
  SIM_REF: 25n,
  SIM_MKT: 8n,
};

const SOURCE_SETTLEMENT_MS: Readonly<Record<QuoteSourceId, bigint>> = {
  SIM_ECB: 86_400_000n,
  SIM_REF: 3_600_000n,
  SIM_MKT: 10_000n,
};

function pairKey(from: CurrencyCode, to: CurrencyCode): string {
  return `${from}/${to}`;
}

function midFor(from: CurrencyCode, to: CurrencyCode): Rational {
  if (from === to) {
    return asRational(1n, 1n);
  }
  const direct = MID_MARKET[pairKey(from, to)];
  if (direct) {
    return direct;
  }
  throw new Error(`No simulated mid-market rate for ${from}/${to}`);
}

function hashBumpBp(seed: string, source: QuoteSourceId, timestamp: UtcInstant, pair: string): bigint {
  const digest = sha256Hex(`${seed}|${source}|${timestamp}|${pair}`);
  const n = BigInt(`0x${digest.slice(0, 8)}`);
  return n % 5n;
}

/**
 * Deterministic, seeded quote sources. No network. Reproducible for a
 * given seed + pair + timestamp.
 */
export function quoteAllSources(
  pair: FxPair,
  seed: string,
  timestamp: UtcInstant,
): readonly SimulatedFxQuote[] {
  assertSimulationOnly();
  if (LIVE_FLAGS.LIVE_FX !== false) {
    throw new Error('LIVE_FX must stay false');
  }
  const mid = midFor(pair.from, pair.to);
  const quotes: SimulatedFxQuote[] = [];
  for (const source of QUOTE_SOURCES) {
    const spreadBp = SOURCE_SPREAD_BP[source] + hashBumpBp(seed, source, timestamp, pairKey(pair.from, pair.to));
    // offer = mid * (1 - spreadBp/10000) when converting FROM→TO (customer sells FROM)
    const spread = asRational(10000n - spreadBp, 10000n);
    const rate = multiplyRational(mid, spread);
    const feeCurrency = pair.from;
    quotes.push(
      Object.freeze({
        id: asQuoteId(`q_${source}_${sha256Hex(`${seed}|${source}|${timestamp}`).slice(0, 10)}`),
        source,
        from: pair.from,
        to: pair.to,
        rate,
        mid,
        fee: Money.of(SOURCE_FEE_MINOR[source], feeCurrency),
        settlementMs: SOURCE_SETTLEMENT_MS[source],
        timestamp: asUtcInstant(timestamp),
        seed,
      }),
    );
  }
  return Object.freeze(quotes);
}

export function quoteFingerprint(quotes: readonly SimulatedFxQuote[]): string {
  return sha256Hex(
    canonicalJson(
      quotes.map((quote) => ({
        source: quote.source,
        rate: `${quote.rate.numerator}/${quote.rate.denominator}`,
        fee: quote.fee.minorUnits.toString(),
        settlementMs: quote.settlementMs.toString(),
      })),
    ),
  );
}
