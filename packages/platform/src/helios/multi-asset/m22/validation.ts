import type { UtcInstant } from '@solstice/domain';
import type { DecisionValidityEnvelope } from '../../decision-validity/types.ts';
import type { MarketState } from '../market-state-types.ts';
import type { UniversalExecutionPlan } from '../m21/types.ts';
import type {
  ExecutionOrderType,
  ExecutionTacticType,
  ExecutionTimeInForce,
  TacticRefusalReason,
} from './taxonomy.ts';
import type {
  CustomerRiskConstraints,
  ExecutionTactic,
  OrderPlanningInput,
  ProviderOrderCapabilities,
} from './types.ts';

export function envelopePermitsPlanning(
  envelope: DecisionValidityEnvelope,
  now: UtcInstant,
): readonly TacticRefusalReason[] {
  const reasons: TacticRefusalReason[] = [];
  if (envelope.overallStatus !== 'VALID') {
    reasons.push('ENVELOPE_INVALID');
  }
  if (now >= envelope.validUntil) {
    reasons.push('ENVELOPE_EXPIRED');
  }
  return Object.freeze(reasons);
}

export function marketPermitsPlanning(marketState: MarketState): readonly TacticRefusalReason[] {
  const reasons: TacticRefusalReason[] = [];
  if (marketState.freshness === 'STALE' || marketState.dataQuality.state === 'UNUSABLE') {
    reasons.push('STALE_MARKET_DATA');
  }
  if (marketState.executionCapability === 'UNAVAILABLE') {
    reasons.push('EXECUTION_UNAVAILABLE');
  }
  return Object.freeze(reasons);
}

export function providerSupportsOrder(
  capabilities: ProviderOrderCapabilities,
  orderType: ExecutionOrderType,
  timeInForce: ExecutionTimeInForce,
): readonly TacticRefusalReason[] {
  const reasons: TacticRefusalReason[] = [];
  if (!capabilities.supportedOrderTypes.includes(orderType)) {
    reasons.push('PROVIDER_UNSUPPORTED_ORDER_TYPE');
  }
  if (!capabilities.supportedTimeInForce.includes(timeInForce)) {
    reasons.push('PROVIDER_UNSUPPORTED_TIME_IN_FORCE');
  }
  return Object.freeze(reasons);
}

export function planPermitsExecution(
  plan: UniversalExecutionPlan,
  now: UtcInstant,
): readonly TacticRefusalReason[] {
  const reasons: TacticRefusalReason[] = [];
  if (now >= plan.validUntil) {
    reasons.push('TACTIC_EXPIRED');
  }
  return Object.freeze(reasons);
}

export function customerPermitsPlanning(
  plan: UniversalExecutionPlan,
  constraints: CustomerRiskConstraints,
): readonly TacticRefusalReason[] {
  const reasons: TacticRefusalReason[] = [];
  if (constraints.blockNewEntries && plan.side === 'BUY') {
    reasons.push('CAPITAL_CONSTRAINT');
  }
  if (constraints.exitOnly && plan.side === 'BUY') {
    reasons.push('CAPITAL_CONSTRAINT');
  }
  if (constraints.availableCapitalMinor <= 0n && plan.side === 'BUY') {
    reasons.push('CAPITAL_CONSTRAINT');
  }
  return Object.freeze(reasons);
}

export function validateExecutionTactic(
  tactic: ExecutionTactic,
  input: OrderPlanningInput,
): readonly TacticRefusalReason[] {
  const reasons = [
    ...envelopePermitsPlanning(input.envelope, input.now),
    ...marketPermitsPlanning(input.marketState),
    ...planPermitsExecution(input.executionPlan, input.now),
    ...providerSupportsOrder(input.providerCapabilities, tactic.orderType, tactic.timeInForce),
    ...customerPermitsPlanning(input.executionPlan, input.customerConstraints),
  ];
  if (tactic.remainingQuantityUnits <= 0n) {
    return Object.freeze([...reasons, 'ZERO_REMAINING_QUANTITY']);
  }
  if (tactic.estimatedSlippage.valueBps != null && tactic.estimatedSlippage.valueBps > input.executionPlan.maxSlippageBps) {
    return Object.freeze([...reasons, 'MAX_SLIPPAGE_EXCEEDED']);
  }
  return Object.freeze([...new Set(reasons)]);
}

/** Whether the final tactic aligned with an advisory research suggestion. Never blocks planning. */
export function researchRecommendationAccepted(
  recommendation: OrderPlanningInput['researchRecommendation'],
  selectedTacticType: ExecutionTacticType,
): boolean {
  if (recommendation == null || recommendation.suggestedTacticType == null) {
    return false;
  }
  return recommendation.suggestedTacticType === selectedTacticType;
}

/** @deprecated Use researchRecommendationAccepted — advisory research must not refuse planning. */
export function researchRecommendationAdmissible(
  recommendation: OrderPlanningInput['researchRecommendation'],
  selectedTacticType: ExecutionTacticType,
): boolean {
  return researchRecommendationAccepted(recommendation, selectedTacticType);
}
