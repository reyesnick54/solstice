/**
 * HELIOS Multi-Asset M22 — intelligent order planning types.
 * Deterministic execution intelligence. Does not grant Execution Authority.
 */

import type { UtcInstant } from '@solstice/domain';
import type { DecisionValidityEnvelope } from '../../decision-validity/types.ts';
import type { MarketState } from '../market-state-types.ts';
import type { UniversalExecutionPlan } from '../m21/types.ts';
import type {
  CostCertaintyLevel,
  ExecutionOrderType,
  EXECUTION_TACTIC_METHODOLOGY_VERSION,
  ExecutionTacticType,
  ExecutionTimeInForce,
  TacticPlanningOutcome,
  TacticRefusalReason,
} from './taxonomy.ts';

export type CostEstimate = {
  readonly valueMinor: bigint | null;
  readonly valueBps: number | null;
  readonly certainty: CostCertaintyLevel;
  readonly explanation: string;
};

export type ProviderOrderCapabilities = {
  readonly providerId: string;
  readonly routeId: string;
  readonly supportedOrderTypes: readonly ExecutionOrderType[];
  readonly supportedTimeInForce: readonly ExecutionTimeInForce[];
  readonly supportsCancelReplace: boolean;
  readonly supportsPartialFill: boolean;
  readonly minimumQuantityUnits: bigint;
  readonly lotSizeUnits: bigint;
  readonly commissionMinor: bigint | null;
  readonly commissionCertainty: CostCertaintyLevel;
};

export type TransactionCostModel = {
  readonly spreadBps: number | null;
  readonly spreadCertainty: CostCertaintyLevel;
  readonly estimatedSlippageBps: number | null;
  readonly slippageCertainty: CostCertaintyLevel;
  readonly feeMinor: bigint | null;
  readonly feeCertainty: CostCertaintyLevel;
};

export type CustomerRiskConstraints = {
  readonly availableCapitalMinor: bigint;
  readonly maxNotionalMinor: bigint | null;
  readonly exitOnly: boolean;
  readonly blockNewEntries: boolean;
};

export type TacticScheduleSlice = {
  readonly sliceIndex: number;
  readonly executeAt: UtcInstant;
  readonly quantityUnits: bigint;
};

export type TacticCondition = {
  readonly kind: 'SPREAD_WIDENS' | 'STALE_DATA' | 'TIMEOUT' | 'PARTIAL_FILL' | 'SLIPPAGE_BREACH' | 'TACTIC_EXPIRY';
  readonly thresholdBps: number | null;
  readonly action: 'CANCEL' | 'REPLACE' | 'CONTINUE_REMAINING' | 'HALT';
  readonly explanation: string;
};

/** Advisory only — LLM/research output cannot directly create broker orders. */
export type ExecutionResearchRecommendation = {
  readonly recommendationId: string;
  readonly executionPlanId: string;
  readonly suggestedTacticType: ExecutionTacticType | null;
  readonly suggestedOrderType: ExecutionOrderType | null;
  readonly confidenceBps: number;
  readonly findings: readonly string[];
  readonly llmSourced: true;
  readonly advisoryOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ExecutionTactic = {
  readonly tacticId: string;
  readonly executionPlanId: string;
  readonly tacticType: ExecutionTacticType;
  readonly orderType: ExecutionOrderType;
  readonly timeInForce: ExecutionTimeInForce;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly remainingQuantityUnits: bigint;
  readonly limitPriceMinor: bigint | null;
  readonly stopPriceMinor: bigint | null;
  readonly numberOfSlices: number | null;
  readonly sliceQuantityUnits: bigint | null;
  readonly schedule: readonly TacticScheduleSlice[];
  readonly urgency: UniversalExecutionPlan['urgency'];
  readonly estimatedSpreadCost: CostEstimate;
  readonly estimatedSlippage: CostEstimate;
  readonly estimatedFees: CostEstimate;
  readonly timeoutAt: UtcInstant;
  readonly cancelConditions: readonly TacticCondition[];
  readonly replaceConditions: readonly TacticCondition[];
  readonly evidence: readonly string[];
  readonly methodologyVersion: typeof EXECUTION_TACTIC_METHODOLOGY_VERSION;
  readonly deterministic: true;
  readonly grantsExecutionAuthority: false;
  readonly computedAt: UtcInstant;
};

export type OrderPlanningInput = {
  readonly requestId: string;
  readonly now: UtcInstant;
  readonly executionPlan: UniversalExecutionPlan;
  readonly envelope: DecisionValidityEnvelope;
  readonly marketState: MarketState;
  readonly providerCapabilities: ProviderOrderCapabilities;
  readonly transactionCostModel: TransactionCostModel;
  readonly customerConstraints: CustomerRiskConstraints;
  readonly volumeProfileMinor: bigint | null;
  readonly volumeProfileCertainty: CostCertaintyLevel;
  readonly researchRecommendation: ExecutionResearchRecommendation | null;
  readonly partialFillRemainingUnits: bigint | null;
  readonly priorTacticId: string | null;
};

export type OrderPlanningResult = {
  readonly requestId: string;
  readonly outcome: TacticPlanningOutcome;
  readonly tactic: ExecutionTactic | null;
  readonly refusalReasons: readonly TacticRefusalReason[];
  readonly researchAccepted: boolean;
  readonly evidence: readonly string[];
  readonly computedAt: UtcInstant;
};

export type TransactionCostAnalysisInput = {
  readonly expectedPriceMinor: bigint;
  readonly arrivalPriceMinor: bigint;
  readonly executionPriceMinor: bigint | null;
  readonly spreadCostMinor: bigint | null;
  readonly estimatedSlippageMinor: bigint | null;
  readonly realizedSlippageMinor: bigint | null;
  readonly feesMinor: bigint | null;
  readonly quantityUnits: bigint;
};

export type TransactionCostAnalysis = {
  readonly analysisId: string;
  readonly expectedPriceMinor: bigint;
  readonly arrivalPriceMinor: bigint;
  readonly executionPriceMinor: bigint | null;
  readonly spreadCostMinor: bigint | null;
  readonly spreadCostBps: number | null;
  readonly estimatedSlippageMinor: bigint | null;
  readonly estimatedSlippageBps: number | null;
  readonly realizedSlippageMinor: bigint | null;
  readonly realizedSlippageBps: number | null;
  readonly feesMinor: bigint | null;
  readonly executionShortfallMinor: bigint | null;
  readonly executionShortfallBps: number | null;
  readonly dataComplete: boolean;
  readonly computedAt: UtcInstant;
};

export type OrderPlanningStoreSnapshot = {
  readonly tactics: readonly ExecutionTactic[];
  readonly planningResults: readonly OrderPlanningResult[];
};
