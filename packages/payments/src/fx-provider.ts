import type { Clock } from '../../config/src/clock.ts';
import { addMs } from '../../config/src/clock.ts';
import { assertSimulationOnly } from '../../config/src/flags.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { Money, RoundingMode } from '../../money/src/money.ts';
import { convertExact, freezeRate, invertRate, type FxRate } from './fx-rate.ts';
import { freezeQuote, type FxQuote } from './fx-quote.ts';
import { asCorridorId, asQuoteId, type CorridorId, type QuoteId } from './ids.ts';
import {
  SIMULATION_PRICING_POLICY,
  applyFixedAndPercentageFee,
  resolvePairPricing,
  type FxPricingPolicy,
  type PricingContext,
} from './fx-pricing.ts';
import { freezeTrade, type FxExecutionMode, type FxTrade, type FxTradeId } from './fx-execution.ts';
import { currencyAllowsFx } from './fx-currency.ts';

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
  readonly pricingContext?: PricingContext;
};

export type ReferenceRateRequest = {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly at: UtcInstant;
};

export type ExecuteQuoteRequest = {
  readonly quote: FxQuote;
  readonly now: UtcInstant;
  readonly tradeId: FxTradeId;
};

export type FxProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Canonical provider-independent FX liquidity port.
 * Phase D adapters implement this. Vendor response models stay in adapters.
 */
export type FxLiquidityProvider = {
  getReferenceRate(request: ReferenceRateRequest): FxProviderResult<FxRate>;
  getQuote(request: QuoteRequest): FxProviderResult<FxQuote>;
  quote(request: QuoteRequest): FxQuote;
  executeQuote(request: ExecuteQuoteRequest): FxProviderResult<FxTrade>;
  getTradeStatus(tradeId: string): FxProviderResult<FxTrade>;
  cancel(tradeId: string): FxProviderResult<FxTrade>;
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
  'GBP/SAR': { numerator: 475n, denominator: 100n },
  'SAR/GBP': { numerator: 100n, denominator: 475n },
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
  'GBP/SAR': { numerator: 4744n, denominator: 1000n },
  'SAR/GBP': { numerator: 1000n, denominator: 4744n },
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
  'GBP/SAR': { numerator: 4740n, denominator: 1000n },
  'SAR/GBP': { numerator: 1000n, denominator: 4740n },
};

export class SimulationFxProvider implements FxLiquidityProvider {
  private readonly clock: Clock;
  private readonly pricing: FxPricingPolicy;
  private mode: FxExecutionMode = 'NORMAL';
  private readonly trades = new Map<string, FxTrade>();

  constructor(clock: Clock, pricing: FxPricingPolicy = SIMULATION_PRICING_POLICY) {
    this.clock = clock;
    this.pricing = pricing;
  }

  setMode(mode: FxExecutionMode): void {
    this.mode = mode;
  }

  getMode(): FxExecutionMode {
    return this.mode;
  }

  getReferenceRate(request: ReferenceRateRequest): FxProviderResult<FxRate> {
    assertSimulationOnly();
    if (this.mode === 'PROVIDER_UNAVAILABLE') {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'simulated FX provider is unavailable' };
    }
    const pair = `${request.baseCurrency}/${request.quoteCurrency}` as PairKey;
    const parts = MARKET[pair];
    if (!parts) {
      return { ok: false, code: 'NO_REFERENCE_RATE', message: `no simulation reference rate for ${pair}` };
    }
    return {
      ok: true,
      value: rate(request.baseCurrency, request.quoteCurrency, parts, request.at, 'SIMULATION_MARKET', 'REFERENCE'),
    };
  }

  getQuote(request: QuoteRequest): FxProviderResult<FxQuote> {
    try {
      return { ok: true, value: this.quote(request) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'quote failed';
      const code = message.startsWith('no simulation rate') ? 'UNSUPPORTED_PAIR' : 'QUOTE_FAILED';
      return { ok: false, code, message };
    }
  }

  quote(request: QuoteRequest): FxQuote {
    assertSimulationOnly();
    if (this.mode === 'PROVIDER_UNAVAILABLE') {
      throw new Error('simulated FX provider is unavailable');
    }
    if (!currencyAllowsFx(request.baseCurrency) || !currencyAllowsFx(request.quoteCurrency)) {
      throw new Error('currency is not FX-enabled in the simulation catalog');
    }
    const pair = `${request.baseCurrency}/${request.quoteCurrency}` as PairKey;
    const marketParts = MARKET[pair];
    const providerParts = PROVIDER[pair];
    const customerParts = this.mode === 'RATE_MOVED'
      ? { numerator: (CUSTOMER[pair]?.numerator ?? 0n) - 5n, denominator: CUSTOMER[pair]?.denominator ?? 1n }
      : CUSTOMER[pair];
    if (!marketParts || !providerParts || !customerParts) {
      throw new Error(`no simulation rate for ${pair}`);
    }
    const now = request.now;
    const market = rate(request.baseCurrency, request.quoteCurrency, marketParts, now, 'SIMULATION_MARKET', 'REFERENCE');
    const provider = rate(request.baseCurrency, request.quoteCurrency, providerParts, now, 'SIMULATION_PROVIDER', 'PROVIDER');
    const customer = rate(request.baseCurrency, request.quoteCurrency, customerParts, now, 'SIMULATION_CUSTOMER', 'CUSTOMER');
    const pricing = resolvePairPricing(this.pricing, pair, request.pricingContext ?? {});
    const sourceAmount = resolveSource(request, customer);
    const fee = pricing
      ? applyFixedAndPercentageFee(
          sourceAmount,
          pricing,
          this.pricing.defaultFixedFeeByCurrency[request.baseCurrency] ?? 1500n,
        )
      : Money.fromMinorUnits(this.pricing.defaultFixedFeeByCurrency[request.baseCurrency] ?? 1500n, request.baseCurrency);
    const destinationAmount = convertExact(sourceAmount, customer, RoundingMode.HALF_EVEN);
    const expiresAt = this.mode === 'EXPIRED_QUOTE'
      ? asUtcInstant(addMs(now, -1n))
      : asUtcInstant(addMs(now, QUOTE_TTL_MS));
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
      expiresAt,
      rateSource: SIMULATION_RATE_SOURCE,
      pricingVersion: this.pricing.version,
      corridorId: asCorridorId(request.corridorId),
      legalEntityId: request.legalEntityId,
      status: this.mode === 'EXPIRED_QUOTE' ? 'EXPIRED' : 'OPEN',
    });
  }

  executeQuote(request: ExecuteQuoteRequest): FxProviderResult<FxTrade> {
    assertSimulationOnly();
    const existing = this.trades.get(request.tradeId);
    if (existing) {
      return { ok: true, value: existing };
    }
    if (this.mode === 'PROVIDER_UNAVAILABLE') {
      return { ok: false, code: 'PROVIDER_UNAVAILABLE', message: 'simulated FX provider is unavailable' };
    }
    if (this.mode === 'RATE_MOVED') {
      this.recordTrade(request, 'RATE_MOVED', 'RATE_MOVED');
      return { ok: false, code: 'RATE_MOVED', message: 'simulated provider rate moved before execution' };
    }
    if (this.mode === 'EXECUTION_FAILED') {
      this.recordTrade(request, 'FAILED', 'EXECUTION_FAILED');
      return { ok: false, code: 'EXECUTION_FAILED', message: 'simulated FX execution failed' };
    }
    const status = this.mode === 'EXECUTION_PENDING' ? 'PENDING' : 'SETTLED';
    const trade = this.recordTrade(request, status, null);
    return { ok: true, value: trade };
  }

  getTradeStatus(tradeId: string): FxProviderResult<FxTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      return { ok: false, code: 'TRADE_NOT_FOUND', message: 'simulated FX trade does not exist' };
    }
    return { ok: true, value: trade };
  }

  cancel(tradeId: string): FxProviderResult<FxTrade> {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      return { ok: false, code: 'TRADE_NOT_FOUND', message: 'simulated FX trade does not exist' };
    }
    if (trade.status === 'SETTLED') {
      return { ok: false, code: 'TRADE_ALREADY_SETTLED', message: 'settled simulated trade cannot cancel' };
    }
    const cancelled = freezeTrade({
      ...trade,
      status: 'CANCELLED',
      updatedAt: this.clock.now(),
    });
    this.trades.set(tradeId, cancelled);
    return { ok: true, value: cancelled };
  }

  private recordTrade(
    request: ExecuteQuoteRequest,
    status: FxTrade['status'],
    failureCode: string | null,
  ): FxTrade {
    const trade = freezeTrade({
      tradeId: request.tradeId,
      quoteId: request.quote.quoteId,
      status,
      simulation: true,
      live: false,
      providerState: 'SIMULATED',
      createdAt: request.now,
      updatedAt: request.now,
      reconciliationRef: status === 'SETTLED' ? `fxrec_${request.tradeId}` : null,
      failureCode,
    });
    this.trades.set(request.tradeId, trade);
    return trade;
  }
}

function rate(
  base: string,
  quote: string,
  parts: { readonly numerator: bigint; readonly denominator: bigint },
  timestamp: UtcInstant,
  source: string,
  kind: 'REFERENCE' | 'PROVIDER' | 'CUSTOMER',
): FxRate {
  return freezeRate({
    kind,
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
  return convertExact(request.destinationAmount, invertRate(customer));
}
