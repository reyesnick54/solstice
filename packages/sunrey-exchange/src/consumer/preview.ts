import type { UtcInstant } from '../../../domain/src/time.ts';
import type { MarketState } from '../taxonomy.ts';
import { humanReadableTradeIntent } from './authorization.ts';
import { CONSUMER_RISK_DISCLOSURE_IDS, type ConsumerExchangePolicy } from './policy.ts';
import { simulationFeeDisclosure, walkBookEstimate } from './quotes.ts';
import type { ConsumerNativeAsset, ConsumerFlow, ConsumerOrderType, ConsumerSide } from './taxonomy.ts';
import type { ConsumerPriceProtection, ConsumerQuote, ConsumerTradePreview } from './types.ts';
import type { DigitalOrder } from '../types.ts';
import type { ValueSourceKind } from './taxonomy.ts';

export function conversionSide(fromAsset: ConsumerNativeAsset, toAsset: ConsumerNativeAsset): ConsumerSide {
  if (fromAsset === toAsset) {
    throw Object.assign(new Error('INVALID_CONVERSION'), { code: 'INVALID_CONVERSION' });
  }
  return fromAsset === 'SUNREY_COIN' ? 'SELL' : 'BUY';
}

export function assetsForFlow(flow: ConsumerFlow, side: ConsumerSide): {
  readonly spent: ConsumerNativeAsset;
  readonly received: ConsumerNativeAsset;
} {
  if (flow === 'CONVERT') {
    return side === 'SELL'
      ? { spent: 'SUNREY_COIN', received: 'MOONREY_COIN' }
      : { spent: 'MOONREY_COIN', received: 'SUNREY_COIN' };
  }
  return side === 'BUY'
    ? { spent: 'MOONREY_COIN', received: 'SUNREY_COIN' }
    : { spent: 'SUNREY_COIN', received: 'MOONREY_COIN' };
}

export function protectionForOrder(input: {
  readonly side: ConsumerSide;
  readonly orderType: ConsumerOrderType;
  readonly requestedBps: bigint | null;
  readonly referenceUnits: bigint | null;
  readonly referenceSource: ValueSourceKind;
  readonly policy: ConsumerExchangePolicy;
}): ConsumerPriceProtection | null {
  if (input.orderType === 'LIMIT') {
    return null;
  }
  if (input.referenceUnits === null) {
    return null;
  }
  const requested = input.requestedBps ?? input.policy.defaultProtectionBps;
  const maxAdverseBps = requested > input.policy.maxProtectionBps ? input.policy.maxProtectionBps : requested;
  const delta = (input.referenceUnits * maxAdverseBps) / 10_000n;
  const limitPriceUnits =
    input.side === 'BUY' ? input.referenceUnits + delta : input.referenceUnits > delta ? input.referenceUnits - delta : 1n;
  return Object.freeze({
    kind: 'MAX_ADVERSE_BPS',
    maxAdverseBps,
    referencePriceUnits: input.referenceUnits,
    referenceSource: input.referenceSource,
    limitPriceUnits,
    guaranteed: false,
  });
}

export function buildConsumerTradePreview(input: {
  readonly previewId: string;
  readonly flow: ConsumerFlow;
  readonly side: ConsumerSide;
  readonly orderType: ConsumerOrderType;
  readonly quantity: bigint;
  readonly protectionBps: bigint | null;
  readonly quote: ConsumerQuote | null;
  readonly orders: readonly DigitalOrder[];
  readonly policy: ConsumerExchangePolicy;
  readonly marketState: MarketState;
  readonly referenceUnits: bigint | null;
  readonly referenceSource: ValueSourceKind;
  readonly sequence: bigint;
  readonly now: UtcInstant;
}): ConsumerTradePreview {
  void input.now;
  const assets = assetsForFlow(input.flow, input.side);
  const estimate = walkBookEstimate({ side: input.side, quantity: input.quantity, orders: input.orders });
  const protection = protectionForOrder({
    side: input.side,
    orderType: input.orderType,
    requestedBps: input.protectionBps,
    referenceUnits: input.referenceUnits,
    referenceSource: input.referenceSource,
    policy: input.policy,
  });
  const intent = humanReadableTradeIntent({
    flow: input.flow,
    side: input.side,
    quantity: input.quantity,
    assetSpent: assets.spent,
    assetReceived: assets.received,
    estimatedPrice: estimate.estimatedPriceUnits,
    protectionBps: protection?.maxAdverseBps ?? null,
  });
  return Object.freeze({
    previewId: input.previewId,
    flow: input.flow,
    side: input.side,
    assetReceived: assets.received,
    assetSpent: assets.spent,
    quantity: input.quantity,
    estimatedExecutionPriceUnits: estimate.estimatedPriceUnits,
    priceProtection: protection,
    estimatedFee: simulationFeeDisclosure(input.policy),
    custodyWalletEffect: `Spend ${assets.spent} and receive ${assets.received} through canonical custody after DVP settlement.`,
    marketState: input.marketState,
    riskDisclosure: Object.freeze({
      disclosureIds: CONSUMER_RISK_DISCLOSURE_IDS,
      noGuaranteedPrice: true,
      noInvestmentPromise: true,
    }),
    humanReadableIntent: intent,
    quoteId: input.quote?.quoteId ?? null,
    marketDataSequence: input.sequence,
  });
}

export function protectionBreached(
  protection: ConsumerPriceProtection | null,
  estimatedPrice: bigint | null,
  side: ConsumerSide,
): boolean {
  if (!protection || estimatedPrice === null) {
    return false;
  }
  return side === 'BUY'
    ? estimatedPrice > protection.limitPriceUnits
    : estimatedPrice < protection.limitPriceUnits;
}
