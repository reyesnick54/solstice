import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { TransactionCostAssumptions, StrategyFailure } from './types.ts';

export type SimulatedOrder = {
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly decisionAt: UtcInstant;
};

export type SimulatedFill = {
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly requestedQuantity: bigint;
  readonly filledQuantity: bigint;
  readonly priceMinor: bigint;
  readonly feeMinor: bigint;
  readonly spreadMinor: bigint;
  readonly slippageMinor: bigint;
  readonly cashDeltaMinor: bigint;
  readonly partial: boolean;
  readonly unavailable: boolean;
  readonly reason: string;
};

export type SimulatorMarket = {
  readonly closeMinor: bigint;
  readonly available: boolean;
};

/**
 * Deterministic historical order simulator.
 * Never assumes a free instant fill at last price unless ZERO_COST_SIMULATION
 * is explicitly named and the market is available.
 */
export function simulateFill(input: {
  readonly order: SimulatedOrder;
  readonly market: SimulatorMarket | undefined;
  readonly costs: TransactionCostAssumptions;
  readonly cashMinor: bigint;
  readonly ownedQuantity: bigint;
}): Result<SimulatedFill, StrategyFailure> {
  if (!input.market || !input.market.available) {
    return ok(
      Object.freeze({
        instrumentId: input.order.instrumentId,
        side: input.order.side,
        requestedQuantity: input.order.quantity,
        filledQuantity: 0n,
        priceMinor: 0n,
        feeMinor: 0n,
        spreadMinor: 0n,
        slippageMinor: 0n,
        cashDeltaMinor: 0n,
        partial: false,
        unavailable: true,
        reason: 'market unavailable at simulation timestamp',
      }),
    );
  }
  if (input.order.quantity <= 0n) {
    return err({ code: 'INVALID_OPERATOR', message: 'order quantity must be positive' });
  }
  if (input.order.side === 'SELL' && input.order.quantity > input.ownedQuantity) {
    return err({
      code: 'SHORT_FORBIDDEN',
      message: `cannot sell ${input.order.quantity.toString()} of ${input.order.instrumentId}; owned ${input.ownedQuantity.toString()}`,
    });
  }
  const signedSlip = input.order.side === 'BUY' ? input.costs.slippageMinor : -input.costs.slippageMinor;
  const signedSpread = input.order.side === 'BUY' ? input.costs.spreadMinor : -input.costs.spreadMinor;
  const price = input.market.closeMinor + signedSlip + signedSpread;
  if (price <= 0n) {
    return ok(
      Object.freeze({
        instrumentId: input.order.instrumentId,
        side: input.order.side,
        requestedQuantity: input.order.quantity,
        filledQuantity: 0n,
        priceMinor: 0n,
        feeMinor: 0n,
        spreadMinor: input.costs.spreadMinor,
        slippageMinor: input.costs.slippageMinor,
        cashDeltaMinor: 0n,
        partial: false,
        unavailable: true,
        reason: 'adjusted price is not available',
      }),
    );
  }
  const fee = input.costs.commissionMinorPerShare * input.order.quantity + input.costs.otherCostMinor;
  const notional = price * input.order.quantity;
  if (input.order.side === 'BUY') {
    const required = notional + fee;
    if (required > input.cashMinor) {
      if (input.cashMinor <= fee) {
        return err({
          code: 'NEGATIVE_CASH',
          message: 'strategy may not spend more simulation cash than available',
        });
      }
      const affordable = (input.cashMinor - fee) / price;
      if (affordable <= 0n) {
        return err({
          code: 'NEGATIVE_CASH',
          message: 'strategy may not spend more simulation cash than available',
        });
      }
      const partialFee = input.costs.commissionMinorPerShare * affordable + input.costs.otherCostMinor;
      const partialNotional = price * affordable;
      return ok(
        Object.freeze({
          instrumentId: input.order.instrumentId,
          side: 'BUY',
          requestedQuantity: input.order.quantity,
          filledQuantity: affordable,
          priceMinor: price,
          feeMinor: partialFee,
          spreadMinor: input.costs.spreadMinor,
          slippageMinor: input.costs.slippageMinor,
          cashDeltaMinor: -(partialNotional + partialFee),
          partial: true,
          unavailable: false,
          reason: 'partial fill to preserve non-negative cash',
        }),
      );
    }
    return ok(
      Object.freeze({
        instrumentId: input.order.instrumentId,
        side: 'BUY',
        requestedQuantity: input.order.quantity,
        filledQuantity: input.order.quantity,
        priceMinor: price,
        feeMinor: fee,
        spreadMinor: input.costs.spreadMinor,
        slippageMinor: input.costs.slippageMinor,
        cashDeltaMinor: -(notional + fee),
        partial: false,
        unavailable: false,
        reason: 'filled under explicit cost assumptions',
      }),
    );
  }
  return ok(
    Object.freeze({
      instrumentId: input.order.instrumentId,
      side: 'SELL',
      requestedQuantity: input.order.quantity,
      filledQuantity: input.order.quantity,
      priceMinor: price,
      feeMinor: fee,
      spreadMinor: input.costs.spreadMinor,
      slippageMinor: input.costs.slippageMinor,
      cashDeltaMinor: notional - fee,
      partial: false,
      unavailable: false,
      reason: 'filled under explicit cost assumptions',
    }),
  );
}

export function applySplit(quantity: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    return quantity;
  }
  return (quantity * numerator) / denominator;
}

export function applyDividend(quantity: bigint, cashMinorPerShare: bigint): bigint {
  return quantity * cashMinorPerShare;
}
