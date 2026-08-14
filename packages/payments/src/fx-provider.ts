import type { Clock } from '../../config/src/clock.ts';
import { addMs } from '../../config/src/clock.ts';
import { assertSimulationOnly } from '../../config/src/flags.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { Money, RoundingMode } from '../../money/src/money.ts';
import { convertExact, type FxRate } from './fx-rate.ts';
import { freezeQuote, type FxQuote } from './fx-quote.ts';
import { asCorridorId, asQuoteId, type CorridorId, type QuoteId } from './ids.ts';

export const SIMULATION_PRICING_VERSION = 'sim-fx-pricing-v1';
export const SIMULATION_RATE_SOURCE = 'SIMULATION_REF_NOT_LIVE_MARKET';
export const QUOTE_TTL_MS = 60_000n;

export type QuoteRequest = {
  readonly quoteId: QuoteId;
  readonly baseCurrency: CurrencyCode;
  readonly quoteCurrency: CurrencyCode;
  readonly sourceAmount?: Money;
  readonly destinationAmount?: Money;
  readonly corridorId: CorridorId;
  readonly legalEntityId: LegalEntityId;
  readonly now: UtcInstant;
};

export type FxLiquidityProvider = {
  quote(request: QuoteRequest): FxQuote;
};

type PairKey = `${string}/${string}`;

/**
 * Deterministic simulation book. These integers are engineering fixtures.
 * They are not live market data and must not be presented as such.
 */
const MARKET: Readonly<Record<PairKey, { readonly numerator: bigint; readonly denominator: bigint }>> = {
  'USD/SAR': { numerator: 15n, denominator: 4n },
  'SAR/USD': { numerator: 4n, denominator: 15n },
  'USD/GBP': { numerator: 79n, denominator: 100n },
  'GBP/USD': { numerator: 100n, denominator: 79n },
  'USD/EUR': { numerator: 92n, denominator: 100n },
  'EUR/USD': { numerator: 100n, denominator: 92n },
  'USD/AED': { numerator: 367n, denominator: 100n },
  'AED/USD': { numerator: 100n, denominator: 367n },
};

const PROVIDER: Readonly<Record<PairKey, { readonly numerator: bigint; readonly denominator: bigint }>> = {
  'USD/SAR': { numerator: 3748n, denominator: 1000n },
  'SAR/USD': { numerator: 1000n, denominator: 3748n },
  'USD/GBP': { numerator: 788n, denominator: 1000n },
  'GBP/USD': { numerator: 1000n, denominator: 788n },
  'USD/EUR': { numerator: 918n, denominator: 1000n },
  'EUR/USD': { numerator: 1000n, denominator: 918n },
  'USD/AED': { numerator: 3665n, denominator: 1000n },
  'AED/USD': { numerator: 1000n, denominator: 3665n },
};

const CUSTOMER: Readonly<Record<PairKey, { readonly numerator: bigint; readonly denominator: bigint }>> = {
  'USD/SAR': { numerator: 3745n, denominator: 1000n },
  'SAR/USD': { numerator: 1000n, denominator: 3745n },
  'USD/GBP': { numerator: 786n, denominator: 1000n },
  'GBP/USD': { numerator: 1000n, denominator: 786n },
  'USD/EUR': { numerator: 916n, denominator: 1000n },
  'EUR/USD': { numerator: 1000n, denominator: 916n },
  'USD/AED': { numerator: 3660n, denominator: 1000n },
  'AED/USD': { numerator: 1000n, denominator: 3660n },
};

const FEE_MINOR: Readonly<Record<string, bigint>> = {
  USD: 1500n,
  SAR: 5000n,
  GBP: 1200n,
  EUR: 1400n,
  AED: 5500n,
};

export class SimulationFxProvider implements FxLiquidityProvider {
  constructor(private readonly clock: Clock) {}

  quote(request: QuoteRequest): FxQuote {
    assertSimulationOnly();
    const pair = `${request.baseCurrency}/${request.quoteCurrency}` as PairKey;
    const marketParts = MARKET[pair];
    const providerParts = PROVIDER[pair];
    const customerParts = CUSTOMER[pair];
    if (!marketParts || !providerParts || !customerParts) {
      throw new Error(`no simulation rate for ${pair}`);
    }
    const now = request.now;
    const market = rate(request.baseCurrency, request.quoteCurrency, marketParts, now, 'SIMULATION_MARKET');
    const provider = rate(request.baseCurrency, request.quoteCurrency, providerParts, now, 'SIMULATION_PROVIDER');
    const customer = rate(request.baseCurrency, request.quoteCurrency, customerParts, now, 'SIMULATION_CUSTOMER');
    const fee = Money.fromMinorUnits(FEE_MINOR[request.baseCurrency] ?? 1500n, request.baseCurrency);
    const sourceAmount = resolveSource(request, customer);
    const destinationAmount = convertExact(sourceAmount, customer, RoundingMode.HALF_EVEN);
    return freezeQuote({
      quoteId: asQuoteId(request.quoteId),
      baseCurrency: request.baseCurrency,
      quoteCurrency: request.quoteCurrency,
      sourceAmount,
      destinationAmount,
      marketRate: market,
      providerRate: provider,
      customerRate: customer,
      fee,
      amountDebited: sourceAmount.plus(fee),
      amountCredited: destinationAmount,
      createdAt: now,
      expiresAt: asUtcInstant(addMs(now, QUOTE_TTL_MS)),
      rateSource: SIMULATION_RATE_SOURCE,
      pricingVersion: SIMULATION_PRICING_VERSION,
      corridorId: asCorridorId(request.corridorId),
      legalEntityId: request.legalEntityId,
      status: 'OPEN',
    });
  }
}

function rate(
  base: string,
  quote: string,
  parts: { readonly numerator: bigint; readonly denominator: bigint },
  timestamp: UtcInstant,
  source: string,
): FxRate {
  return Object.freeze({
    base,
    quote,
    numerator: parts.numerator,
    denominator: parts.denominator,
    timestamp,
    source,
  });
}

function resolveSource(request: QuoteRequest, customer: FxRate): Money {
  if (request.sourceAmount && request.destinationAmount) {
    throw new TypeError('quote must specify exactly one of source or destination amount');
  }
  if (request.sourceAmount) {
    if (request.sourceAmount.currency !== request.baseCurrency) {
      throw new TypeError('source amount currency must match base currency');
    }
    return request.sourceAmount;
  }
  if (!request.destinationAmount) {
    throw new TypeError('quote requires a source or destination amount');
  }
  if (request.destinationAmount.currency !== request.quoteCurrency) {
    throw new TypeError('destination amount currency must match quote currency');
  }
  return convertExact(request.destinationAmount, {
    base: customer.quote,
    quote: customer.base,
    numerator: customer.denominator,
    denominator: customer.numerator,
    timestamp: customer.timestamp,
    source: customer.source,
  });
}
