import { Money } from '../../../money/src/money.ts';
import type { ProductAllocationView } from './allocation-target.ts';
import type { RebalanceProposal } from './rebalance.ts';
import type { PortfolioRiskView } from './risk-metrics.ts';
import type { PerformanceReport } from './performance.ts';
import type { InvestmentPortfolio } from './portfolio.ts';

export type GrowthInvestmentOpportunityKind =
  | 'REBALANCE_PORTFOLIO_PROPOSAL'
  | 'DIVERSIFY_CONCENTRATION_PROPOSAL'
  | 'DEPLOY_INVESTMENT_CASH_PROPOSAL';

/**
 * Opportunities Growth Orchestrator may surface. None of these execute.
 */
export type GrowthInvestmentOpportunity = {
  readonly kind: GrowthInvestmentOpportunityKind;
  readonly title: string;
  readonly portfolioId: string;
  readonly detail: string;
  readonly amount: Money | null;
  readonly executionCapability: 'PROPOSAL_ONLY';
  readonly executes: false;
};

export function opportunitiesFromInvestmentState(input: {
  readonly portfolio: InvestmentPortfolio;
  readonly allocation: ProductAllocationView;
  readonly risk: PortfolioRiskView;
  readonly performance: PerformanceReport | null;
  readonly rebalance: RebalanceProposal;
}): readonly GrowthInvestmentOpportunity[] {
  const rows: GrowthInvestmentOpportunity[] = [];
  if (input.rebalance.trades.length > 0) {
    rows.push({
      kind: 'REBALANCE_PORTFOLIO_PROPOSAL',
      title: 'Rebalance toward the target allocation',
      portfolioId: input.portfolio.portfolioId,
      detail: `${input.rebalance.trades.length} candidate trade(s). User confirmation and Kernel are required.`,
      amount: null,
      executionCapability: 'PROPOSAL_ONLY',
      executes: false,
    });
  }
  if (input.risk.concentration.largestWeightBps >= 4_000n) {
    rows.push({
      kind: 'DIVERSIFY_CONCENTRATION_PROPOSAL',
      title: 'Review concentrated holding',
      portfolioId: input.portfolio.portfolioId,
      detail: `Largest instrument weight is ${input.risk.concentration.largestWeightBps.toString()} bps.`,
      amount: null,
      executionCapability: 'PROPOSAL_ONLY',
      executes: false,
    });
  }
  const cashTarget = input.allocation.total.allocate(1_000n, 10_000n, 'FLOOR');
  if (input.allocation.cash.cmp(cashTarget) > 0) {
    const deployable = input.allocation.cash.minus(cashTarget);
    rows.push({
      kind: 'DEPLOY_INVESTMENT_CASH_PROPOSAL',
      title: 'Deploy available investment cash',
      portfolioId: input.portfolio.portfolioId,
      detail: 'Idle brokerage cash is above the 10% cash sleeve. This is a proposal only.',
      amount: deployable,
      executionCapability: 'PROPOSAL_ONLY',
      executes: false,
    });
  }
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}
