import type {
  FeasibilityAssessment,
  MetaAllocationCandidateInput,
  AccountStateReference,
  TradingCostAssumptions,
} from './types.ts';
import type { LiquidityState, MetaAllocatorReasonCode } from './taxonomy.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function estimateTotalCost(
  deploymentMinor: bigint,
  costs: TradingCostAssumptions,
): bigint {
  const spread = (deploymentMinor * BigInt(costs.spreadBps)) / 10000n;
  const slippage = (deploymentMinor * BigInt(costs.slippageBps)) / 10000n;
  return (
    parseMinor(costs.commissionMinor) +
    parseMinor(costs.inferenceCostMinor) +
    parseMinor(costs.dataCostMinor) +
    spread +
    slippage
  );
}

export function evaluateCandidateFeasibility(
  candidate: MetaAllocationCandidateInput,
  account: AccountStateReference,
  availableCashMinor: bigint,
): FeasibilityAssessment {
  const reasonCodes: MetaAllocatorReasonCode[] = [];
  const deployment = parseMinor(candidate.estimatedDeploymentMinor);
  const minOrder = parseMinor(candidate.costAssumptions.minimumOrderSizeMinor);
  const accountSize = parseMinor(account.accountSizeMinor);
  const totalCost = estimateTotalCost(deployment, candidate.costAssumptions);
  const edgeAfterCosts = deployment / 20n - totalCost;

  if (deployment < minOrder) {
    reasonCodes.push('ACCOUNT_TOO_SMALL');
  }
  if (accountSize < minOrder * 2n) {
    reasonCodes.push('ACCOUNT_TOO_SMALL');
  }
  if (availableCashMinor < deployment + totalCost) {
    reasonCodes.push('INFEASIBLE_DEPLOYMENT');
  }
  if (candidate.liquidityState === 'INSUFFICIENT' || candidate.liquidityState === 'THIN') {
    reasonCodes.push('INSUFFICIENT_LIQUIDITY');
  }
  if (edgeAfterCosts <= 0n) {
    reasonCodes.push('COSTS_CONSUME_EDGE');
  }

  const feasible =
    deployment >= minOrder &&
    accountSize >= minOrder * 2n &&
    availableCashMinor >= deployment + totalCost &&
    candidate.liquidityState !== 'INSUFFICIENT' &&
    edgeAfterCosts > 0n;

  if (feasible) {
    reasonCodes.push('FEASIBLE_DEPLOYMENT');
  } else {
    reasonCodes.push('INFEASIBLE_DEPLOYMENT');
  }

  return Object.freeze({
    feasible,
    minimumOrderSizeMinor: minOrder.toString(),
    estimatedDeploymentMinor: deployment.toString(),
    estimatedTotalCostMinor: totalCost.toString(),
    edgeAfterCostsMinor: edgeAfterCosts.toString(),
    liquidityState: candidate.liquidityState,
    concentrationImpactBps: 0,
    reasonCodes: Object.freeze(reasonCodes),
  });
}

export function liquidityBlocksCapital(liquidity: LiquidityState): boolean {
  return liquidity === 'INSUFFICIENT';
}
