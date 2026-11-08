import type { UtcInstant } from '@solstice/domain';

import type { ForwardAlphaReturnLane, ForwardStrategyType } from '../taxonomy.ts';
import type { ALPHA06_RULE_FLAGS } from './taxonomy.ts';
import type { Alpha06ExecutionAlgorithmKind, ALPHA06_SCHEMA } from './taxonomy.ts';
import type { RoutingDecision } from '../../execution-connectivity/exec05/types.ts';
import type { TransactionCostAnalysis } from '../../execution-connectivity/exec07/types.ts';
import type { SimulatedFill } from '../../execution-twin/simulation/types.ts';
import type { Level2Snapshot } from '../../execution-twin/simulation/types.ts';
import type { FundingEvent } from '../../execution-twin/simulation/types.ts';
import type { Alpha06PromotionOutcome } from '../taxonomy.ts';

export type Alpha06SignalLeg = {
  readonly side: 'BUY' | 'SELL';
  readonly signalPriceMinor: bigint;
  readonly quantityUnits: bigint;
  readonly at: UtcInstant;
};

export type Alpha06ForwardScenario = {
  readonly scenarioId: string;
  readonly strategyType: ForwardStrategyType;
  readonly instrumentId: string;
  readonly currency: string;
  readonly entry: Alpha06SignalLeg;
  readonly exit: Alpha06SignalLeg;
  readonly entryBook: Level2Snapshot;
  readonly exitBook: Level2Snapshot;
  readonly algorithmKind?: Alpha06ExecutionAlgorithmKind;
  readonly fundingEvents?: readonly FundingEvent[];
};

export type Alpha06LaneReturn = {
  readonly lane: ForwardAlphaReturnLane;
  readonly netPnlMinor: bigint;
  readonly returnBps: number | null;
  readonly quantityUsedUnits: bigint;
  readonly notionalMinor: bigint;
};

export type Alpha06ImplementableExecutionBundle = {
  readonly routing: RoutingDecision;
  readonly algorithmKind: Alpha06ExecutionAlgorithmKind;
  readonly algorithmChildSlices: number;
  readonly entryFills: readonly SimulatedFill[];
  readonly exitFills: readonly SimulatedFill[];
  readonly unfilledEntryUnits: bigint;
  readonly unfilledExitUnits: bigint;
  readonly explicitFeesMinor: bigint;
  readonly spreadPaidMinor: bigint;
  readonly slippageMinor: bigint;
  readonly fundingCostMinor: bigint;
  readonly borrowCostMinor: bigint;
  readonly rollCostMinor: bigint;
  readonly marketImpactMinor: bigint;
  readonly latencyAckMs: number;
  readonly usedMidPriceForFill: boolean;
  readonly transactionCost: TransactionCostAnalysis | null;
};

export type Alpha06ForwardExecutionResult = {
  readonly resultId: string;
  readonly schema: typeof ALPHA06_SCHEMA;
  readonly methodologyVersion: string;
  readonly scenarioId: string;
  readonly lanes: readonly Alpha06LaneReturn[];
  readonly signalToImplementationDecayBps: number | null;
  readonly implementable: Alpha06ImplementableExecutionBundle;
  readonly promotionOutcome: Alpha06PromotionOutcome;
  readonly promote: boolean;
  readonly rules: typeof ALPHA06_RULE_FLAGS;
  readonly computedAt: UtcInstant;
};
