import { Money } from '../../../money/src/money.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { isDeterministicEffect } from './effects.ts';
import type { GrowthActionCandidate } from './types.ts';
import { PLANNING_PRIORITY_VERSION } from './taxonomy.ts';

const RISK_RANK = { LOW: 0, MODERATE: 1, HIGH: 2, UNCERTAIN_MARKET: 3 } as const;
const COMPLEXITY: Record<GrowthActionCandidate['action'], number> = {
  REVIEW_SUBSCRIPTION: 1,
  REDUCE_FEE: 2,
  OPTIMIZE_PAYMENT_TIMING: 3,
  CAPTURE_REWARD: 3,
  ALLOCATE_TO_EMERGENCY_RESERVE: 4,
  REDUCE_DEBT: 5,
  MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS: 6,
  REVIEW_INVESTMENT_OPPORTUNITY_FUTURE: 9,
  INVESTMENT_ACCOUNT_AVAILABLE: 8,
  PAPER_INVESTMENT_REVIEW_AVAILABLE: 8,
  REBALANCE_PORTFOLIO_PROPOSAL: 7,
  DIVERSIFY_CONCENTRATION_PROPOSAL: 7,
  DEPLOY_INVESTMENT_CASH_PROPOSAL: 7,
};

function userPriority(candidate: GrowthActionCandidate, mandate: CompiledEconomicMandate): number {
  let best = 99;
  for (const goalId of candidate.supportingGoalIds) {
    const goal = mandate.goals.find((item) => item.goalId === goalId);
    if (goal && goal.priority < best) {
      best = goal.priority;
    }
  }
  return best;
}

function deterministicBenefit(candidate: GrowthActionCandidate): bigint {
  if (isDeterministicEffect(candidate.expectedEffect)) {
    return BigInt(candidate.expectedEffect.amount.minorUnits);
  }
  return 0n;
}

function uncertainBenefit(candidate: GrowthActionCandidate): bigint {
  if (candidate.expectedEffect.kind === 'ESTIMATED_EFFECT') {
    const low = Money.fromMinorUnitsString(
      candidate.expectedEffect.low.minorUnits,
      candidate.expectedEffect.low.currency,
    );
    const high = Money.fromMinorUnitsString(
      candidate.expectedEffect.high.minorUnits,
      candidate.expectedEffect.high.currency,
    );
    return (low.minorUnits + high.minorUnits) / 2n;
  }
  if (candidate.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME') {
    return 0n;
  }
  return 0n;
}

function liquidityFirst(candidate: GrowthActionCandidate): number {
  if (
    candidate.action === 'ALLOCATE_TO_EMERGENCY_RESERVE' ||
    candidate.action === 'REVIEW_SUBSCRIPTION' ||
    candidate.action === 'REDUCE_FEE'
  ) {
    return 0;
  }
  if (candidate.action === 'REDUCE_DEBT' || candidate.action === 'OPTIMIZE_PAYMENT_TIMING') {
    return 1;
  }
  return 2;
}

function policyRank(candidate: GrowthActionCandidate): number {
  if (candidate.executionCapability === 'PROHIBITED') {
    return 9;
  }
  if (candidate.executionCapability === 'HUMAN_REVIEW_REQUIRED') {
    return 5;
  }
  if (candidate.executionCapability === 'DEPENDENCY_NOT_IMPLEMENTED') {
    return 4;
  }
  return 0;
}

/**
 * Versioned multi-objective ordering. Soft preferences may only break ties
 * after hard mandate, policy, and liquidity ranks.
 */
export function rankCandidates(
  candidates: readonly GrowthActionCandidate[],
  mandate: CompiledEconomicMandate,
  peve?: { readonly resiliencePoints?: string; readonly mayExecute: false },
): readonly GrowthActionCandidate[] {
  const preferFees = mandate.softPreferences.some((item) => item.kind === 'PREFER_LOWER_FEES');
  const preferDebt = mandate.softPreferences.some((item) => item.kind === 'PREFER_DEBT_REDUCTION');
  const preferSimple = mandate.softPreferences.some((item) => item.kind === 'PREFER_SIMPLER_PLAN');
  const sorted = [...candidates].sort((left, right) => {
    const policy = policyRank(left) - policyRank(right);
    if (policy !== 0) {
      return policy;
    }
    const liquidity = liquidityFirst(left) - liquidityFirst(right);
    if (liquidity !== 0) {
      return liquidity;
    }
    const resilience = BigInt(peve?.resiliencePoints ?? '10000');
    if (resilience < 4000n) {
      const leftReserve = left.action === 'ALLOCATE_TO_EMERGENCY_RESERVE' ? 1 : 0;
      const rightReserve = right.action === 'ALLOCATE_TO_EMERGENCY_RESERVE' ? 1 : 0;
      if (leftReserve !== rightReserve) {
        return rightReserve - leftReserve;
      }
    }
    const priority = userPriority(left, mandate) - userPriority(right, mandate);
    if (priority !== 0) {
      return priority;
    }
    const det = deterministicBenefit(right) - deterministicBenefit(left);
    if (det !== 0n) {
      return det > 0n ? 1 : -1;
    }
    const uncertain = uncertainBenefit(right) - uncertainBenefit(left);
    if (uncertain !== 0n) {
      return uncertain > 0n ? 1 : -1;
    }
    const risk = RISK_RANK[left.riskClass] - RISK_RANK[right.riskClass];
    if (risk !== 0) {
      return risk;
    }
    let complexity = COMPLEXITY[left.action] - COMPLEXITY[right.action];
    if (preferSimple && complexity !== 0) {
      return complexity;
    }
    if (preferFees && left.action === 'REVIEW_SUBSCRIPTION' && right.action !== 'REVIEW_SUBSCRIPTION') {
      return -1;
    }
    if (preferDebt && left.action === 'REDUCE_DEBT' && right.action !== 'REDUCE_DEBT') {
      return -1;
    }
    if (complexity !== 0) {
      return complexity;
    }
    return left.actionId.localeCompare(right.actionId);
  });
  return Object.freeze(sorted);
}

export function planningPriorityVersion(): typeof PLANNING_PRIORITY_VERSION {
  return PLANNING_PRIORITY_VERSION;
}
