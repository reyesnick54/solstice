import type { UtcInstant } from '@solstice/domain';

import type {
  BytexEngineEventKind,
  BytexOrderEventKind,
  BytexOrderStatus,
  BytexPortfolioEventKind,
  BytexRuntimeEnvironment,
  BytexStrategyLifecyclePhase,
} from './taxonomy.ts';

export type BytexTimeEvent = {
  readonly name: string;
  readonly eventTimeNs: bigint;
};

export type BytexTimerHandler = {
  readonly event: BytexTimeEvent;
  readonly handle: () => void;
};

export type BytexMarketDataElement = {
  readonly elementId: string;
  readonly createdTimeNs: bigint;
  readonly insertionIndex: number;
  readonly kind: 'QUOTE' | 'TRADE' | 'BAR' | 'BOOK';
  readonly instrumentId: string;
  readonly payloadDigest: string;
};

export type BytexOrderRecord = {
  readonly clientOrderId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly status: BytexOrderStatus;
  readonly quantityMinor: bigint;
  readonly filledQuantityMinor: bigint;
};

export type BytexOrderLifecycleEvent = {
  readonly sequence: number;
  readonly atNs: bigint;
  readonly clientOrderId: string;
  readonly kind: BytexOrderEventKind;
  readonly fromStatus: BytexOrderStatus;
  readonly toStatus: BytexOrderStatus;
};

export type BytexPortfolioEvent = {
  readonly sequence: number;
  readonly atNs: bigint;
  readonly kind: BytexPortfolioEventKind;
  readonly instrumentId: string;
  readonly quantityMinor: bigint;
  readonly cashDeltaMinor: bigint;
};

export type BytexEngineEvent = {
  readonly sequence: number;
  readonly atNs: bigint;
  readonly kind: BytexEngineEventKind;
  readonly detail: string;
  readonly payloadDigest: string;
};

export type BytexStrategyRuntimeState = {
  readonly strategyId: string;
  readonly phase: BytexStrategyLifecyclePhase;
  readonly capsuleContentHash: string;
  readonly lastEventSequence: number;
};

export type BytexRuntimeCheckpoint = {
  readonly checkpointId: string;
  readonly savedAtNs: bigint;
  readonly clockNs: bigint;
  readonly environment: BytexRuntimeEnvironment;
  readonly randomSeed: string;
  readonly dispatchedMarketCount: number;
  readonly lastDispatchedKey: { readonly timeNs: bigint; readonly insertionIndex: number } | null;
  readonly strategy: BytexStrategyRuntimeState;
  readonly orders: readonly BytexOrderRecord[];
  readonly eventLogDigest: string;
};

export type BytexDeterministicRunInput = {
  readonly runId: string;
  readonly environment: BytexRuntimeEnvironment;
  readonly randomSeed: string;
  readonly capsuleContentHash: string;
  readonly executionAssumptionsDigest: string;
  readonly startAt: UtcInstant;
  readonly marketData: readonly Omit<BytexMarketDataElement, 'insertionIndex'>[];
};

export type BytexDeterministicRunOutcome = {
  readonly runId: string;
  readonly environment: BytexRuntimeEnvironment;
  readonly outcomeDigest: string;
  readonly eventCount: number;
  readonly orderEvents: readonly BytexOrderLifecycleEvent[];
  readonly portfolioEvents: readonly BytexPortfolioEvent[];
  readonly engineEvents: readonly BytexEngineEvent[];
  readonly finalStrategyPhase: BytexStrategyLifecyclePhase;
};

export type BytexClockMode = 'SIMULATION' | 'LIVE';
