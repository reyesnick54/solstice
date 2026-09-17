import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { StrategyFailure, TransactionCostAssumptions } from '../types.ts';
import type { ChronologicalObservation } from './manifest.ts';
import { FILL_MODEL_VERSION, type EvaluationFailure } from './types.ts';

export type RealisticFillInput = {
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly observation: ChronologicalObservation;
  readonly costs: TransactionCostAssumptions;
  readonly cashMinor: bigint;
  readonly ownedQuantity: bigint;
  readonly executionAt: UtcInstant;
};

export type RealisticFillResult = {
  readonly fillModelVersion: typeof FILL_MODEL_VERSION;
  readonly side: 'BUY' | 'SELL';
  readonly requestedQuantity: bigint;
  readonly filledQuantity: bigint;
  readonly priceMinor: bigint;
  readonly feeMinor: bigint;
  readonly spreadCostMinor: bigint;
  readonly slippageCostMinor: bigint;
  readonly cashDeltaMinor: bigint;
  readonly partial: boolean;
  readonly filled: boolean;
  readonly reason: string;
  readonly bidAskUsed: boolean;
  readonly marketClosed: boolean;
};

function effectivePrice(input: RealisticFillInput): Result<{ readonly priceMinor: bigint; readonly bidAskUsed: boolean }, StrategyFailure> {
  const { observation, side, costs } = input;
  if (!observation.sessionOpen) {
    return err({ code: 'INVALID_OPERATOR', message: 'market session closed at execution time' });
  }
  if (!observation.available || observation.degraded) {
    return err({ code: 'INVALID_OPERATOR', message: 'market data unavailable or degraded at execution time' });
  }
  if (observation.bidMinor !== null && observation.askMinor !== null) {
    const base = side === 'BUY' ? observation.askMinor : observation.bidMinor;
    const slip = side === 'BUY' ? costs.slippageMinor : -costs.slippageMinor;
    const spreadAdj = side === 'BUY' ? costs.spreadMinor : -costs.spreadMinor;
    const price = base + slip + spreadAdj;
    if (price <= 0n) {
      return err({ code: 'INVALID_OPERATOR', message: 'realistic fill price is non-positive' });
    }
    if (side === 'BUY' && price < observation.askMinor) {
      return err({ code: 'INVALID_OPERATOR', message: 'BUY cannot fill below contemporaneous ask' });
    }
    if (side === 'SELL' && price > observation.bidMinor) {
      return err({ code: 'INVALID_OPERATOR', message: 'SELL cannot fill above contemporaneous bid' });
    }
    return ok(Object.freeze({ priceMinor: price, bidAskUsed: true }));
  }
  return err({
    code: 'INVALID_OPERATOR',
    message: 'bid/ask unavailable; order-book depth not invented for fill simulation',
  });
}

export function simulateRealisticFill(
  input: RealisticFillInput,
): Result<RealisticFillResult, StrategyFailure | EvaluationFailure> {
  if (input.quantity <= 0n) {
    return err({ code: 'INVALID_OPERATOR', message: 'order quantity must be positive' });
  }
  if (!input.observation.sessionOpen) {
    return ok(
      Object.freeze({
        fillModelVersion: FILL_MODEL_VERSION,
        side: input.side,
        requestedQuantity: input.quantity,
        filledQuantity: 0n,
        priceMinor: 0n,
        feeMinor: 0n,
        spreadCostMinor: 0n,
        slippageCostMinor: 0n,
        cashDeltaMinor: 0n,
        partial: false,
        filled: false,
        reason: 'market session closed — no fill',
        bidAskUsed: false,
        marketClosed: true,
      }),
    );
  }
  if (input.side === 'SELL' && input.quantity > input.ownedQuantity) {
    return err({
      code: 'SHORT_FORBIDDEN',
      message: `cannot sell ${input.quantity.toString()} of ${input.observation.instrumentId}`,
    });
  }
  const priced = effectivePrice(input);
  if (!priced.ok) {
    return priced;
  }
  const { priceMinor, bidAskUsed } = priced.value;
  const feeMinor = input.costs.commissionMinorPerShare * input.quantity + input.costs.otherCostMinor;
  const spreadCostMinor = input.costs.spreadMinor * input.quantity;
  const slippageCostMinor = input.costs.slippageMinor * input.quantity;
  const notional = priceMinor * input.quantity;

  if (input.side === 'BUY') {
    const required = notional + feeMinor;
    if (required > input.cashMinor) {
      const affordable = input.cashMinor > feeMinor ? (input.cashMinor - feeMinor) / priceMinor : 0n;
      if (affordable <= 0n) {
        return ok(
          Object.freeze({
            fillModelVersion: FILL_MODEL_VERSION,
            side: 'BUY',
            requestedQuantity: input.quantity,
            filledQuantity: 0n,
            priceMinor,
            feeMinor: 0n,
            spreadCostMinor: 0n,
            slippageCostMinor: 0n,
            cashDeltaMinor: 0n,
            partial: false,
            filled: false,
            reason: 'insufficient cash for realistic fill',
            bidAskUsed,
            marketClosed: false,
          }),
        );
      }
      const partialFee = input.costs.commissionMinorPerShare * affordable + input.costs.otherCostMinor;
      const partialNotional = priceMinor * affordable;
      return ok(
        Object.freeze({
          fillModelVersion: FILL_MODEL_VERSION,
          side: 'BUY',
          requestedQuantity: input.quantity,
          filledQuantity: affordable,
          priceMinor,
          feeMinor: partialFee,
          spreadCostMinor: input.costs.spreadMinor * affordable,
          slippageCostMinor: input.costs.slippageMinor * affordable,
          cashDeltaMinor: -(partialNotional + partialFee),
          partial: true,
          filled: true,
          reason: 'partial fill under realistic bid/ask and cash constraints',
          bidAskUsed,
          marketClosed: false,
        }),
      );
    }
    return ok(
      Object.freeze({
        fillModelVersion: FILL_MODEL_VERSION,
        side: 'BUY',
        requestedQuantity: input.quantity,
        filledQuantity: input.quantity,
        priceMinor,
        feeMinor,
        spreadCostMinor,
        slippageCostMinor,
        cashDeltaMinor: -(notional + feeMinor),
        partial: false,
        filled: true,
        reason: 'filled at ask-side realistic price with explicit costs',
        bidAskUsed,
        marketClosed: false,
      }),
    );
  }

  return ok(
    Object.freeze({
      fillModelVersion: FILL_MODEL_VERSION,
      side: 'SELL',
      requestedQuantity: input.quantity,
      filledQuantity: input.quantity,
      priceMinor,
      feeMinor,
      spreadCostMinor,
      slippageCostMinor,
      cashDeltaMinor: notional - feeMinor,
      partial: false,
      filled: true,
      reason: 'filled at bid-side realistic price with explicit costs',
      bidAskUsed,
      marketClosed: false,
    }),
  );
}
