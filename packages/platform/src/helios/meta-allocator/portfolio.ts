import type { MetaAllocationCandidateInput, PortfolioContext } from './types.ts';
import type { MetaAllocatorReasonCode } from './taxonomy.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

export type PortfolioConstraintResult = {
  readonly allowed: boolean;
  readonly adjustedMaxCapitalMinor: string;
  readonly concentrationImpactBps: number;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
};

export function evaluatePortfolioConstraints(
  candidate: MetaAllocationCandidateInput,
  portfolio: PortfolioContext,
  availableCashMinor: bigint,
  maxSectorConcentrationBps: number,
  requestedDeploymentMinor: bigint,
): PortfolioConstraintResult {
  const reasonCodes: MetaAllocatorReasonCode[] = [];
  const sectorConc = portfolio.sectorConcentrationBps[candidate.sector] ?? 0;
  const deploymentBps =
    availableCashMinor > 0n
      ? Number((requestedDeploymentMinor * 10000n) / availableCashMinor)
      : 0;
  const projectedConc = sectorConc + deploymentBps;

  let adjusted = requestedDeploymentMinor;
  let allowed = true;

  if (projectedConc > maxSectorConcentrationBps) {
    reasonCodes.push('CONCENTRATION_LIMIT');
    const headroomBps = Math.max(0, maxSectorConcentrationBps - sectorConc);
    if (headroomBps <= 0) {
      allowed = false;
      adjusted = 0n;
    } else {
      adjusted = (availableCashMinor * BigInt(headroomBps)) / 10000n;
      const minOrder = parseMinor(candidate.costAssumptions.minimumOrderSizeMinor);
      if (adjusted <= 0n || adjusted < minOrder) {
        allowed = false;
        adjusted = 0n;
      }
    }
  }

  const currencyConc = portfolio.currencyConcentrationBps[candidate.currency] ?? 0;
  if (currencyConc + deploymentBps > 9500) {
    reasonCodes.push('CONCENTRATION_LIMIT');
    allowed = false;
    adjusted = 0n;
  }

  const liquidityReq = parseMinor(portfolio.liquidityRequirementMinor);
  if (availableCashMinor - requestedDeploymentMinor < liquidityReq) {
    reasonCodes.push('INFEASIBLE_DEPLOYMENT');
    allowed = false;
    adjusted = 0n;
  }

  return Object.freeze({
    allowed,
    adjustedMaxCapitalMinor: adjusted.toString(),
    concentrationImpactBps: deploymentBps,
    reasonCodes: Object.freeze(reasonCodes),
  });
}
