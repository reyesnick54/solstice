import { ratioCmp, type Ratio } from '../arithmetic.ts';
import type {
  KillControlTrigger,
  MandateRiskPolicy,
  PortfolioRiskContext,
  PortfolioRiskState,
  RiskActionKind,
} from './types.ts';

const STATE_RANK: Record<PortfolioRiskState, number> = {
  NORMAL: 0,
  CAUTION: 1,
  REDUCED_RISK: 2,
  NEW_ENTRIES_BLOCKED: 3,
  EXIT_ONLY: 4,
  EMERGENCY_CLOSE_REQUIRED: 5,
  PAUSED: 6,
};

export function maxRiskState(left: PortfolioRiskState, right: PortfolioRiskState): PortfolioRiskState {
  return STATE_RANK[left] >= STATE_RANK[right] ? left : right;
}

export function stateFromDrawdown(drawdown: Ratio | null, policy: MandateRiskPolicy): PortfolioRiskState {
  if (!drawdown) {
    return 'NORMAL';
  }
  if (policy.emergencyClosePortfolioDrawdown && ratioCmp(drawdown, policy.emergencyClosePortfolioDrawdown) >= 0) {
    return 'EMERGENCY_CLOSE_REQUIRED';
  }
  if (policy.exitOnlyPortfolioDrawdown && ratioCmp(drawdown, policy.exitOnlyPortfolioDrawdown) >= 0) {
    return 'EXIT_ONLY';
  }
  if (policy.newEntriesBlockedPortfolioDrawdown && ratioCmp(drawdown, policy.newEntriesBlockedPortfolioDrawdown) >= 0) {
    return 'NEW_ENTRIES_BLOCKED';
  }
  if (policy.reducedRiskPortfolioDrawdown && ratioCmp(drawdown, policy.reducedRiskPortfolioDrawdown) >= 0) {
    return 'REDUCED_RISK';
  }
  if (policy.cautionPortfolioDrawdown && ratioCmp(drawdown, policy.cautionPortfolioDrawdown) >= 0) {
    return 'CAUTION';
  }
  return 'NORMAL';
}

export function stateFromTrigger(trigger: KillControlTrigger): PortfolioRiskState {
  switch (trigger) {
    case 'CUSTOMER_PAUSE':
    case 'COMPLIANCE_PAUSE':
      return 'PAUSED';
    case 'OPERATIONAL_EMERGENCY':
      return 'EMERGENCY_CLOSE_REQUIRED';
    case 'EXCESSIVE_PORTFOLIO_DRAWDOWN':
      return 'EXIT_ONLY';
    case 'LOSS_BUDGET_BREACH':
    case 'RECONCILIATION_FAILURE':
      return 'EXIT_ONLY';
    case 'STALE_MARKET_DATA':
    case 'PROVIDER_FAILURE':
    case 'REPEATED_EXECUTION_FAILURE':
      return 'NEW_ENTRIES_BLOCKED';
    case 'SEVERE_LIQUIDITY_DEGRADATION':
      return 'REDUCED_RISK';
    default:
      return 'CAUTION';
  }
}

export function actionsForState(state: PortfolioRiskState, policy: MandateRiskPolicy): readonly RiskActionKind[] {
  switch (state) {
    case 'NORMAL':
      return Object.freeze(['ALLOW_NEW_ENTRIES']);
    case 'CAUTION':
      return Object.freeze(['ALLOW_NEW_ENTRIES', 'REDUCE_EXPOSURE']);
    case 'REDUCED_RISK':
      return Object.freeze(['BLOCK_NEW_ENTRIES', 'REDUCE_EXPOSURE']);
    case 'NEW_ENTRIES_BLOCKED':
      return Object.freeze(['BLOCK_NEW_ENTRIES']);
    case 'EXIT_ONLY':
      return Object.freeze(['BLOCK_NEW_ENTRIES', 'EXIT_STRATEGY', 'EXIT_ASSET_CLASS']);
    case 'EMERGENCY_CLOSE_REQUIRED':
      return policy.emergencyClosePermitted
        ? Object.freeze(['BLOCK_NEW_ENTRIES', 'CLOSE_MANDATE'])
        : Object.freeze(['BLOCK_NEW_ENTRIES', 'EXIT_STRATEGY', 'EXIT_ASSET_CLASS']);
    case 'PAUSED':
      return Object.freeze(['BLOCK_NEW_ENTRIES']);
    default:
      return Object.freeze(['BLOCK_NEW_ENTRIES']);
  }
}

export function newEntriesPermitted(state: PortfolioRiskState): boolean {
  return state === 'NORMAL' || state === 'CAUTION';
}

export function emergencyClosePermitted(state: PortfolioRiskState, policy: MandateRiskPolicy): boolean {
  return state === 'EMERGENCY_CLOSE_REQUIRED' && policy.emergencyClosePermitted === true;
}

export function detectKillTriggers(input: {
  readonly context: PortfolioRiskContext;
  readonly policy: MandateRiskPolicy;
  readonly portfolioDrawdown: Ratio | null;
  readonly staleDataPresent: boolean;
}): readonly KillControlTrigger[] {
  const triggers: KillControlTrigger[] = [];
  const { context, policy } = input;

  if (context.customerPaused) {
    triggers.push('CUSTOMER_PAUSE');
  }
  if (context.compliancePaused) {
    triggers.push('COMPLIANCE_PAUSE');
  }
  if (!context.providerHealthy && policy.providerHealthBlocksNewEntries !== false) {
    triggers.push('PROVIDER_FAILURE');
  }
  if (input.staleDataPresent && policy.staleDataBlocksNewEntries !== false) {
    triggers.push('STALE_MARKET_DATA');
  }
  if (!context.reconciliationOk) {
    triggers.push('RECONCILIATION_FAILURE');
  }
  if (context.executionFailureCount >= 3) {
    triggers.push('REPEATED_EXECUTION_FAILURE');
  }
  if (
    policy.minimumLiquidityMinor !== undefined &&
    context.brokerageCashMinor < policy.minimumLiquidityMinor
  ) {
    triggers.push('SEVERE_LIQUIDITY_DEGRADATION');
  }
  if (
    policy.dailyRealizedLossLimitMinor !== undefined &&
    context.dailyLoss.realizedLossMinor > policy.dailyRealizedLossLimitMinor
  ) {
    triggers.push('LOSS_BUDGET_BREACH');
  }
  if (
    policy.dailyTotalLossThresholdMinor !== undefined &&
    policy.dailyTotalLossIncludesUnrealized === true &&
    context.dailyLoss.totalLossMinor > policy.dailyTotalLossThresholdMinor
  ) {
    triggers.push('LOSS_BUDGET_BREACH');
  }
  if (
    policy.maximumPortfolioDrawdown !== undefined &&
    input.portfolioDrawdown !== null &&
    ratioCmp(input.portfolioDrawdown, policy.maximumPortfolioDrawdown) > 0
  ) {
    triggers.push('EXCESSIVE_PORTFOLIO_DRAWDOWN');
  }

  return Object.freeze(triggers);
}

export function mergeTriggerStates(triggers: readonly KillControlTrigger[]): PortfolioRiskState {
  let state: PortfolioRiskState = 'NORMAL';
  for (const trigger of triggers) {
    state = maxRiskState(state, stateFromTrigger(trigger));
  }
  return state;
}
