/**
 * Execution Twin — simulates CLOB order lifecycle without live Polymarket connectivity.
 */

import type { UtcInstant } from '@solstice/domain';
import { assessPredictionMarketRisk, DEFAULT_PREDICTION_RISK_LIMITS } from './risk.ts';
import { simulateClobFill } from './simulated-fill.ts';
import type {
  CloOrderBookSnapshot,
  ExecutionTwinOrder,
  PaperPositionRecord,
  SimulatedFillResult,
} from './types.ts';
import type { PredictionExecutionTwinMode, PredictionOutcomeSide } from './taxonomy.ts';
import { computeExposureMetrics } from './exposure.ts';
import { applyPaperFill } from './paper-position.ts';

export type SubmitTwinOrderInput = {
  readonly twinOrderId: string;
  readonly mode: PredictionExecutionTwinMode;
  readonly contractInstrumentId: string;
  readonly conditionId: string;
  readonly side: 'BUY' | 'SELL';
  readonly outcomeSide: PredictionOutcomeSide;
  readonly quantityContracts: bigint;
  readonly limitPriceMinor: bigint | null;
  readonly book: CloOrderBookSnapshot;
  readonly submittedAt: UtcInstant;
  readonly positions: readonly PaperPositionRecord[];
};

export type TwinSubmitResult = {
  readonly order: ExecutionTwinOrder;
  readonly positions: readonly PaperPositionRecord[];
  readonly fill: SimulatedFillResult | null;
};

export function submitExecutionTwinOrder(input: SubmitTwinOrderInput): TwinSubmitResult {
  const exposure = computeExposureMetrics(input.conditionId, input.positions);
  const risk = assessPredictionMarketRisk(exposure, DEFAULT_PREDICTION_RISK_LIMITS);
  if (!risk.permitted && input.side === 'BUY') {
    const rejected: ExecutionTwinOrder = Object.freeze({
      twinOrderId: input.twinOrderId,
      mode: input.mode,
      contractInstrumentId: input.contractInstrumentId,
      side: input.side,
      outcomeSide: input.outcomeSide,
      quantityContracts: input.quantityContracts,
      limitPriceMinor: input.limitPriceMinor,
      submittedAt: input.submittedAt,
      status: 'REJECTED',
      fill: null,
    });
    return Object.freeze({ order: rejected, positions: input.positions, fill: null });
  }

  const fill = simulateClobFill({
    contractInstrumentId: input.contractInstrumentId,
    side: input.side,
    orderSide: input.outcomeSide,
    quantityContracts: input.quantityContracts,
    book: input.book,
    asOf: input.submittedAt,
  });

  if (!fill.filled) {
    const rejected: ExecutionTwinOrder = Object.freeze({
      twinOrderId: input.twinOrderId,
      mode: input.mode,
      contractInstrumentId: input.contractInstrumentId,
      side: input.side,
      outcomeSide: input.outcomeSide,
      quantityContracts: input.quantityContracts,
      limitPriceMinor: input.limitPriceMinor,
      submittedAt: input.submittedAt,
      status: 'REJECTED',
      fill,
    });
    return Object.freeze({ order: rejected, positions: input.positions, fill });
  }

  if (input.limitPriceMinor !== null) {
    const limitBreached =
      input.side === 'BUY'
        ? fill.averagePriceMinor > input.limitPriceMinor
        : fill.averagePriceMinor < input.limitPriceMinor;
    if (limitBreached) {
      const rejected: ExecutionTwinOrder = Object.freeze({
        twinOrderId: input.twinOrderId,
        mode: input.mode,
        contractInstrumentId: input.contractInstrumentId,
        side: input.side,
        outcomeSide: input.outcomeSide,
        quantityContracts: input.quantityContracts,
        limitPriceMinor: input.limitPriceMinor,
        submittedAt: input.submittedAt,
        status: 'REJECTED',
        fill: Object.freeze({ ...fill, filled: false, reason: 'LIMIT_NOT_SATISFIED' }),
      });
      return Object.freeze({ order: rejected, positions: input.positions, fill: null });
    }
  }

  const positions = applyPaperFill({
    positions: input.positions,
    conditionId: input.conditionId,
    outcomeSide: input.outcomeSide,
    side: input.side,
    quantityContracts: fill.filledQuantity,
    priceMinor: fill.averagePriceMinor,
    asOf: input.submittedAt,
    positionIdPrefix: input.twinOrderId,
  });

  const order: ExecutionTwinOrder = Object.freeze({
    twinOrderId: input.twinOrderId,
    mode: input.mode,
    contractInstrumentId: input.contractInstrumentId,
    side: input.side,
    outcomeSide: input.outcomeSide,
    quantityContracts: input.quantityContracts,
    limitPriceMinor: input.limitPriceMinor,
    submittedAt: input.submittedAt,
    status: 'SIMULATED_FILL',
    fill,
  });

  return Object.freeze({ order, positions, fill });
}
