import type { CustomerId, UtcInstant } from '@solstice/domain';
import { cashEffectFromFill, resolveAssetClass } from './settlement-semantics.ts';
import type { MultiAssetCashAvailability, MultiAssetFillRecord, MultiAssetOrderRecord } from './types.ts';

export type CashAvailabilityInput = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly currency: string;
  readonly ledgerSettledMinor: string;
  readonly reservedMinor: string;
  readonly positionMarketValueMinor: string;
  readonly positionCostBasisMinor: string;
  readonly realizedPnlMinor: string;
  readonly orders: readonly MultiAssetOrderRecord[];
  readonly fills: readonly MultiAssetFillRecord[];
  readonly reconciliationBlocks: boolean;
  readonly asOf: UtcInstant;
};

export function computeMultiAssetCashAvailability(input: CashAvailabilityInput): MultiAssetCashAvailability {
  let unsettledCashMinor = 0n;
  for (const order of input.orders) {
    if (order.accountId !== input.accountId) continue;
    const orderFills = input.fills.filter((fill) => fill.orderId === order.orderId);
    const fillNotional = orderFills.reduce(
      (sum, fill) => sum + BigInt(fill.quantityUnits) * BigInt(fill.priceMinorUnits),
      0n,
    );
    const fillFees = orderFills.reduce((sum, fill) => sum + BigInt(fill.feeMinorUnits), 0n);
    const assetClass = resolveAssetClass(order.instrumentId);
    const cashEffect = cashEffectFromFill(
      assetClass,
      order.currentState === 'SETTLEMENT_PENDING'
        ? 'SETTLEMENT_PENDING'
        : order.currentState === 'SETTLED' || order.currentState === 'RECONCILED' || order.currentState === 'AVAILABLE'
          ? 'SETTLED'
          : order.currentState === 'FILLED' || order.currentState === 'PARTIALLY_FILLED'
            ? 'FILLED'
            : 'FILLED',
    );
    if (cashEffect === 'UNSETTLED' && fillNotional > 0n) {
      unsettledCashMinor += order.side === 'BUY' ? fillNotional + fillFees : fillNotional - fillFees;
    }
  }

  const settledCash = BigInt(input.ledgerSettledMinor);
  const reserved = BigInt(input.reservedMinor);
  const positionValue = BigInt(input.positionMarketValueMinor);
  const costBasis = BigInt(input.positionCostBasisMinor);
  const unrealized = positionValue > costBasis ? positionValue - costBasis : costBasis - positionValue;
  const realized = BigInt(input.realizedPnlMinor);
  const totalEquity = settledCash + positionValue;

  let availableBase = settledCash - reserved - unsettledCashMinor;
  if (input.reconciliationBlocks) {
    availableBase = 0n;
  }
  const available = availableBase > 0n ? availableBase : 0n;
  const withdrawable = available;

  return Object.freeze({
    customerId: input.customerId,
    accountId: input.accountId,
    currency: input.currency,
    totalAccountEquityMinor: totalEquity.toString(),
    unrealizedPnlMinor: unrealized.toString(),
    realizedPnlMinor: realized.toString(),
    unsettledCashMinor: unsettledCashMinor.toString(),
    settledCashMinor: settledCash.toString(),
    reservedCapitalMinor: reserved.toString(),
    availableCapitalMinor: available.toString(),
    withdrawableCashMinor: withdrawable.toString(),
    asOf: input.asOf,
    serverCalculated: true,
  });
}
