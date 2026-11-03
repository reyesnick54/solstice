/**
 * HELIOS OS03 — execution simulation core types.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  BarExecutionMode,
  ExecutionFidelityLevel,
  LiquidityRole,
  MarketDataInputGranularity,
  OhlcPathSequence,
  SimulatedOrderSide,
  SimulatedOrderStatus,
  SimulatedOrderType,
  SimulatedTimeInForce,
} from './taxonomy.ts';

export type ObservationRef = {
  readonly refId: string;
  readonly granularity: MarketDataInputGranularity;
  readonly observedAt: UtcInstant;
};

export type SimulatedFillEvidence = {
  readonly schema: 'sunrey.helios.execution-twin.simulation.fill-evidence.v1';
  readonly observationRefs: readonly ObservationRef[];
  readonly executionFidelityLevel: ExecutionFidelityLevel;
  readonly fillModelVersion: string;
  readonly feeModelVersion: string;
  readonly latencyAssumption: string;
  readonly slippageAssumption: string;
  readonly evidenceRefs: readonly string[];
  readonly barExecutionMode: BarExecutionMode | null;
  readonly ohlcPathSequence: OhlcPathSequence | null;
  readonly inputGranularity: MarketDataInputGranularity;
  readonly simulationOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type SimulatedFill = {
  readonly fillId: string;
  readonly orderId: string;
  readonly instrumentId: string;
  readonly side: SimulatedOrderSide;
  readonly quantityUnits: bigint;
  readonly priceMinorUnits: bigint;
  readonly notionalMinorUnits: bigint;
  readonly feeMinorUnits: bigint;
  readonly currency: string;
  readonly liquidityRole: LiquidityRole;
  readonly venueId: string;
  readonly filledAt: UtcInstant;
  readonly evidence: SimulatedFillEvidence;
};

export type SimulatedWorkingOrder = {
  readonly orderId: string;
  readonly clientOrderId: string;
  readonly instrumentId: string;
  readonly side: SimulatedOrderSide;
  readonly orderType: SimulatedOrderType;
  readonly timeInForce: SimulatedTimeInForce;
  readonly quantityUnits: bigint;
  readonly remainingQuantityUnits: bigint;
  readonly limitPriceMinorUnits: bigint | null;
  readonly stopPriceMinorUnits: bigint | null;
  readonly status: SimulatedOrderStatus;
  readonly stopTriggered: boolean;
  readonly submittedAt: UtcInstant;
  readonly activeAt: UtcInstant | null;
  readonly cancelRequestedAt: UtcInstant | null;
  readonly cancelEffectiveAt: UtcInstant | null;
  readonly currency: string;
  readonly fills: readonly SimulatedFill[];
};

export type BarObservation = {
  readonly barId: string;
  readonly instrumentId: string;
  readonly observedAt: UtcInstant;
  readonly openMinorUnits: bigint;
  readonly highMinorUnits: bigint;
  readonly lowMinorUnits: bigint;
  readonly closeMinorUnits: bigint;
  readonly volumeUnits: bigint;
  readonly currency: string;
};

export type QuoteObservation = {
  readonly quoteId: string;
  readonly instrumentId: string;
  readonly observedAt: UtcInstant;
  readonly bidMinorUnits: bigint;
  readonly askMinorUnits: bigint;
  readonly bidSizeUnits: bigint;
  readonly askSizeUnits: bigint;
  readonly currency: string;
};

export type TradeObservation = {
  readonly tradeId: string;
  readonly instrumentId: string;
  readonly observedAt: UtcInstant;
  readonly priceMinorUnits: bigint;
  readonly sizeUnits: bigint;
  readonly aggressorSide: SimulatedOrderSide | 'UNKNOWN';
  readonly currency: string;
};

export type Level2Snapshot = {
  readonly snapshotId: string;
  readonly instrumentId: string;
  readonly observedAt: UtcInstant;
  readonly currency: string;
  readonly bids: readonly { readonly priceMinorUnits: bigint; readonly sizeUnits: bigint }[];
  readonly asks: readonly { readonly priceMinorUnits: bigint; readonly sizeUnits: bigint }[];
};

export type MarketUpdate =
  | { readonly kind: 'LEVEL_2_BOOK'; readonly snapshot: Level2Snapshot }
  | { readonly kind: 'QUOTE'; readonly quote: QuoteObservation }
  | { readonly kind: 'TRADE'; readonly trade: TradeObservation }
  | { readonly kind: 'BAR'; readonly bar: BarObservation };

export type PerpetualInstrumentSpec = {
  readonly instrumentId: string;
  readonly contractMultiplierMinorUnits: bigint;
  readonly multiplierScale: number;
  readonly settlementCurrency: string;
  readonly maintenanceMarginRateBps: number;
  readonly initialMarginRateBps: number;
};

export type FundingEvent = {
  readonly eventId: string;
  readonly instrumentId: string;
  readonly effectiveAt: UtcInstant;
  readonly fundingRateBps: number;
  readonly indexPriceMinorUnits: bigint;
  readonly currency: string;
};

export type MarginAccountSnapshot = {
  readonly accountId: string;
  readonly collateralMinorUnits: bigint;
  readonly currency: string;
  readonly unrealizedPnlMinorUnits: bigint;
  readonly positionUnits: bigint;
  readonly entryPriceMinorUnits: bigint;
  readonly maintenanceMarginMinorUnits: bigint;
  readonly initialMarginMinorUnits: bigint;
};

export type LiquidationOutcome = {
  readonly liquidated: boolean;
  readonly reason: string | null;
  readonly closedQuantityUnits: bigint;
  readonly liquidationPriceMinorUnits: bigint | null;
  readonly evidenceRef: string;
};

export type SubmitOrderRequest = {
  readonly clientOrderId: string;
  readonly instrumentId: string;
  readonly side: SimulatedOrderSide;
  readonly orderType: SimulatedOrderType;
  readonly timeInForce: SimulatedTimeInForce;
  readonly quantityUnits: bigint;
  readonly limitPriceMinorUnits?: bigint | null;
  readonly stopPriceMinorUnits?: bigint | null;
  readonly currency: string;
};

export type SubmitOrderResult =
  | { readonly accepted: true; readonly order: SimulatedWorkingOrder }
  | { readonly accepted: false; readonly reason: string; readonly orderId: string | null };

export type CancelOrderResult =
  | { readonly status: 'CANCEL_PENDING' | 'CANCELLED' | 'CANCEL_REJECTED'; readonly order: SimulatedWorkingOrder }
  | { readonly status: 'NOT_FOUND'; readonly reason: string };
