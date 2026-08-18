import type { UtcInstant } from '../../../domain/src/time.ts';
import { sortBook } from '../matching.ts';
import type { DigitalOrder } from '../types.ts';
import type { ConsumerExchangePolicy } from './policy.ts';
import type { ConsumerFeeDisclosure, ConsumerQuote } from './types.ts';
import type { ConsumerQuoteKind, ConsumerSide } from './taxonomy.ts';

export function simulationFeeDisclosure(policy: ConsumerExchangePolicy): ConsumerFeeDisclosure {
  return Object.freeze({
    exchangeFeeQuantity: policy.simulationExchangeFee,
    exchangeFeeAsset: 'MOONREY_COIN',
    exchangeFeeConfigured: true,
    networkFeeQuantity: policy.simulationNetworkFee,
    networkFeeApplicable: policy.simulationNetworkFee > 0n,
    otherKnownCharges: Object.freeze([]),
    productionRatesInvented: false,
    scheduleId: policy.simulationFeeScheduleId,
  });
}

export function walkBookEstimate(input: {
  readonly side: ConsumerSide;
  readonly quantity: bigint;
  readonly orders: readonly DigitalOrder[];
}): {
  readonly estimatedPriceUnits: bigint | null;
  readonly filledQuantity: bigint;
  readonly worstPriceUnits: bigint | null;
  readonly priceImpactBps: bigint | null;
} {
  const book = sortBook(input.orders);
  const levels = input.side === 'BUY' ? book.asks : book.bids;
  let remaining = input.quantity;
  let cost = 0n;
  let filled = 0n;
  let worst: bigint | null = null;
  const best = levels[0]?.limitPrice?.priceUnits ?? null;
  for (const order of levels) {
    if (!order.limitPrice || remaining <= 0n) {
      break;
    }
    const take = order.remaining.scaledUnits < remaining ? order.remaining.scaledUnits : remaining;
    cost += take * order.limitPrice.priceUnits;
    filled += take;
    remaining -= take;
    worst = order.limitPrice.priceUnits;
  }
  const estimated = filled > 0n ? cost / filled : null;
  const impact =
    best !== null && worst !== null && best > 0n
      ? ((worst > best ? worst - best : best - worst) * 10_000n) / best
      : null;
  return Object.freeze({
    estimatedPriceUnits: estimated,
    filledQuantity: filled,
    worstPriceUnits: worst,
    priceImpactBps: impact,
  });
}

export function buildConsumerQuote(input: {
  readonly quoteId: string;
  readonly marketId: ConsumerQuote['marketId'];
  readonly side: ConsumerSide;
  readonly quantity: bigint;
  readonly notional: bigint | null;
  readonly requestedKind: ConsumerQuoteKind;
  readonly orders: readonly DigitalOrder[];
  readonly policy: ConsumerExchangePolicy;
  readonly sequence: bigint;
  readonly now: UtcInstant;
}): ConsumerQuote {
  const estimate = walkBookEstimate({
    side: input.side,
    quantity: input.quantity,
    orders: input.orders,
  });
  const kind: ConsumerQuoteKind =
    input.requestedKind === 'EXECUTABLE' && input.policy.firmExecutableQuotesImplemented
      ? 'EXECUTABLE'
      : 'INDICATIVE';
  const expires = new Date(Date.parse(input.now) + input.policy.quoteTtlMs).toISOString() as UtcInstant;
  return Object.freeze({
    quoteId: input.quoteId,
    marketId: input.marketId,
    side: input.side,
    requestedQuantity: input.quantity,
    requestedNotional: input.notional,
    kind,
    informational: kind === 'INDICATIVE',
    guaranteedExecution: false,
    estimatedExecutionPriceUnits: estimate.estimatedPriceUnits,
    estimatedFilledQuantity: estimate.filledQuantity,
    estimatedPriceImpactBps: estimate.priceImpactBps,
    fees: simulationFeeDisclosure(input.policy),
    expiresAt: expires,
    marketDataSequence: input.sequence,
    marketDataReference: `seq:${input.sequence.toString()}`,
    createdAt: input.now,
  });
}

export function quoteIsStale(quote: ConsumerQuote, now: UtcInstant): boolean {
  return Date.parse(now) > Date.parse(quote.expiresAt);
}
