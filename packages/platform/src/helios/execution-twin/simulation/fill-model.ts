/**
 * HELIOS OS03 — partial fills, queue position, price improvement.
 */

import type { UtcInstant } from '@solstice/domain';

import { walkBookForSide, type MarketBook } from './market-book.ts';
import { applySlippageToPrice, type SlippageModelConfig } from './slippage-model.ts';
import type {
  BarExecutionMode,
  ExecutionFidelityLevel,
  LiquidityRole,
  MarketDataInputGranularity,
  OhlcPathSequence,
} from './taxonomy.ts';
import { FEE_MODEL_VERSION, FILL_MODEL_VERSION } from './taxonomy.ts';
import type { ObservationRef, SimulatedFillEvidence } from './types.ts';
import { computeFeeMinor, type FeeModelConfig } from './fee-model.ts';
import { slippageAssumptionLabel } from './slippage-model.ts';
import { latencyAssumptionLabel, type LatencyModelConfig } from './latency-model.ts';

export type FillModelConfig = {
  readonly queueAheadFraction: number;
  readonly enablePriceImprovement: boolean;
  readonly priceImprovementTicks: bigint;
};

export const DEFAULT_FILL_MODEL: FillModelConfig = Object.freeze({
  queueAheadFraction: 0.5,
  enablePriceImprovement: true,
  priceImprovementTicks: 1n,
});

export type ProposedFillSlice = {
  readonly priceMinorUnits: bigint;
  readonly quantityUnits: bigint;
  readonly liquidityRole: LiquidityRole;
};

export function availableAtLevelAfterQueue(levelSizeUnits: bigint, queueAheadFraction: number): bigint {
  const clamped = Math.min(1, Math.max(0, queueAheadFraction));
  const ahead = BigInt(Math.floor(Number(levelSizeUnits) * clamped));
  const available = levelSizeUnits - ahead;
  return available > 0n ? available : 0n;
}

export function matchAgainstBook(input: {
  readonly book: MarketBook;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly limitPriceMinorUnits: bigint | null;
  readonly asLiquidityRole: LiquidityRole;
  readonly fillModel: FillModelConfig;
  readonly slippageModel: SlippageModelConfig;
  readonly applyImpact: boolean;
}): { readonly slices: readonly ProposedFillSlice[]; readonly unfilledUnits: bigint } {
  const rawWalk = walkBookForSide(input.book, input.side, input.quantityUnits);
  const slices: ProposedFillSlice[] = [];
  let filled = 0n;
  for (const row of rawWalk) {
    let available = row.level.sizeUnits;
    if (input.asLiquidityRole === 'MAKER') {
      available = availableAtLevelAfterQueue(row.level.sizeUnits, input.fillModel.queueAheadFraction);
    } else {
      available = availableAtLevelAfterQueue(row.level.sizeUnits, 0);
    }
    const want = input.quantityUnits - filled;
    const take = want < available ? want : available;
    if (take <= 0n) {
      continue;
    }
    if (input.limitPriceMinorUnits != null) {
      if (input.side === 'BUY' && row.level.priceMinorUnits > input.limitPriceMinorUnits) {
        break;
      }
      if (input.side === 'SELL' && row.level.priceMinorUnits < input.limitPriceMinorUnits) {
        break;
      }
    }
    let price = row.level.priceMinorUnits;
    if (input.applyImpact && input.asLiquidityRole === 'TAKER') {
      price = applySlippageToPrice(input.side, price, take, input.slippageModel);
    }
    if (input.fillModel.enablePriceImprovement && input.asLiquidityRole === 'MAKER' && input.fillModel.priceImprovementTicks > 0n) {
      price =
        input.side === 'BUY'
          ? price + input.fillModel.priceImprovementTicks
          : price - input.fillModel.priceImprovementTicks;
    }
    slices.push(Object.freeze({ priceMinorUnits: price, quantityUnits: take, liquidityRole: input.asLiquidityRole }));
    filled += take;
    if (filled >= input.quantityUnits) {
      break;
    }
  }
  return Object.freeze({ slices: Object.freeze(slices), unfilledUnits: input.quantityUnits - filled });
}

export function buildFillEvidence(input: {
  readonly observationRefs: readonly ObservationRef[];
  readonly executionFidelityLevel: ExecutionFidelityLevel;
  readonly inputGranularity: MarketDataInputGranularity;
  readonly latencyModel: LatencyModelConfig;
  readonly slippageModel: SlippageModelConfig;
  readonly feeModel: FeeModelConfig;
  readonly evidenceRefs: readonly string[];
  readonly barExecutionMode: BarExecutionMode | null;
  readonly ohlcPathSequence: OhlcPathSequence | null;
}): SimulatedFillEvidence {
  return Object.freeze({
    schema: 'sunrey.helios.execution-twin.simulation.fill-evidence.v1',
    observationRefs: Object.freeze([...input.observationRefs]),
    executionFidelityLevel: input.executionFidelityLevel,
    fillModelVersion: FILL_MODEL_VERSION,
    feeModelVersion: FEE_MODEL_VERSION,
    latencyAssumption: latencyAssumptionLabel(input.latencyModel),
    slippageAssumption: slippageAssumptionLabel(input.slippageModel),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    barExecutionMode: input.barExecutionMode,
    ohlcPathSequence: input.ohlcPathSequence,
    inputGranularity: input.inputGranularity,
    simulationOnly: true,
    grantsExecutionAuthority: false,
  });
}

// Fix the feeModelVersion in buildFillEvidence - I made an error. Let me fix when writing matching-engine.

export function materializeFill(input: {
  readonly fillId: string;
  readonly orderId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly slice: ProposedFillSlice;
  readonly currency: string;
  readonly venueId: string;
  readonly filledAt: UtcInstant;
  readonly feeModel: FeeModelConfig;
  readonly evidence: SimulatedFillEvidence;
}) {
  const notional = input.slice.priceMinorUnits * input.slice.quantityUnits;
  return Object.freeze({
    fillId: input.fillId,
    orderId: input.orderId,
    instrumentId: input.instrumentId,
    side: input.side,
    quantityUnits: input.slice.quantityUnits,
    priceMinorUnits: input.slice.priceMinorUnits,
    notionalMinorUnits: notional,
    feeMinorUnits: computeFeeMinor(notional, input.slice.liquidityRole, input.feeModel),
    currency: input.currency,
    liquidityRole: input.slice.liquidityRole,
    venueId: input.venueId,
    filledAt: input.filledAt,
    evidence: input.evidence,
  });
}
