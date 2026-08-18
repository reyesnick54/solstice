import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeAccountId } from '../ids.ts';
import type { NativeClearingEngine } from '../native-clearing/engine.ts';
import type { ConsumerExchangePolicy } from './policy.ts';
import type { ConsumerEnvironment, ValueSourceKind } from './taxonomy.ts';
import type {
  ConsumerCostBasisAnalytics,
  ConsumerHoldingProjection,
  ConsumerOrderStatus,
  ConsumerPerformanceAnalytics,
  ConsumerPortfolioProjection,
  ConsumerSettlementProjection,
  ConsumerTradeReceipt,
} from './types.ts';

export function projectHolding(input: {
  readonly engine: NativeClearingEngine;
  readonly accountId: ExchangeAccountId;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly referenceUnits: bigint | null;
  readonly valueSource: ValueSourceKind;
  readonly now: UtcInstant;
}): ConsumerHoldingProjection {
  const position = input.engine.position(input.accountId, input.assetId);
  const informationalMarketValue =
    input.referenceUnits === null
      ? null
      : input.assetId === 'SUNREY_COIN'
        ? position.available * input.referenceUnits
        : position.available;
  return Object.freeze({
    assetId: input.assetId,
    quantity: position.available,
    source: 'CHAIN',
    reserved: position.reserved,
    pendingSettlement: position.pendingSettlement,
    informationalMarketValue,
    valueSource: input.valueSource,
    valueTimestamp: input.referenceUnits === null ? null : input.now,
    redemptionValueGuaranteed: false,
  });
}

export function projectPortfolio(input: {
  readonly engine: NativeClearingEngine;
  readonly accountId: ExchangeAccountId;
  readonly environment: ConsumerEnvironment;
  readonly referenceUnits: bigint | null;
  readonly valueSource: ValueSourceKind;
  readonly openOrders: readonly ConsumerOrderStatus[];
  readonly fills: ConsumerTradeReceipt['fills'];
  readonly pendingSettlement: readonly ConsumerSettlementProjection[];
  readonly now: UtcInstant;
  readonly includeCostBasis: boolean;
}): ConsumerPortfolioProjection {
  const sunrey = projectHolding({
    engine: input.engine,
    accountId: input.accountId,
    assetId: 'SUNREY_COIN',
    referenceUnits: input.referenceUnits,
    valueSource: input.valueSource,
    now: input.now,
  });
  const moonrey = projectHolding({
    engine: input.engine,
    accountId: input.accountId,
    assetId: 'MOONREY_COIN',
    referenceUnits: input.referenceUnits,
    valueSource: input.valueSource,
    now: input.now,
  });
  let spent = 0n;
  let received = 0n;
  for (const fill of input.fills) {
    spent += fill.quantity * fill.priceUnits;
    received += fill.quantity;
  }
  const costBasis: ConsumerCostBasisAnalytics | null = input.includeCostBasis
    ? Object.freeze({
        informational: true,
        jurisdictionDependent: true,
        taxCorrectnessClaimed: false,
        quantity: spent,
        assumption: 'DETERMINISTIC_FILL_HISTORY',
      })
    : null;
  const performance: ConsumerPerformanceAnalytics | null = input.includeCostBasis
    ? Object.freeze({
        informationalQuantityChange: received,
        calculationAssumption: 'DETERMINISTIC_TRANSACTION_HISTORY',
        investmentPromise: false,
      })
    : null;
  return Object.freeze({
    accountId: input.accountId,
    environment: input.environment,
    productionLabel: input.environment === 'SANDBOX' ? 'NON_PRODUCTION' : 'SIMULATION',
    holdings: Object.freeze([sunrey, moonrey]),
    openOrders: input.openOrders,
    recentTrades: input.fills,
    pendingSettlement: input.pendingSettlement,
    costBasis,
    performance,
    createdIndependentStore: false,
    asOf: input.now,
  });
}

export function fiatHoldingIfExposed(quantity: bigint, now: UtcInstant): ConsumerHoldingProjection {
  return Object.freeze({
    assetId: 'APPLICATION_FIAT',
    quantity,
    source: 'APPLICATION_FIAT_PRODUCT',
    reserved: 0n,
    pendingSettlement: 0n,
    informationalMarketValue: quantity,
    valueSource: 'UNAVAILABLE',
    valueTimestamp: now,
    redemptionValueGuaranteed: false,
  });
}

export function emptyPortfolioDoesNotCreateQuantity(): { readonly createdIndependentStore: false } {
  return Object.freeze({ createdIndependentStore: false });
}

export function consumerPolicyDoesNotInventFees(policy: ConsumerExchangePolicy): boolean {
  return policy.simulationExchangeFee >= 0n && policy.productionActivated === false;
}
