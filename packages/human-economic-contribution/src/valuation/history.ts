import type { ContributionId } from '../ids.ts';
import type { ValuationId } from './ids.ts';
import type { HumanContributionValuationResult } from './types.ts';

/**
 * Append-only valuation history. A later policy never rewrites a sealed
 * historic result. Revaluation creates a new record that may reference
 * the prior valuation id.
 */
export class HumanContributionValuationHistory {
  private readonly byId = new Map<ValuationId, HumanContributionValuationResult>();
  private readonly byContribution = new Map<ContributionId, ValuationId[]>();

  append(result: HumanContributionValuationResult): HumanContributionValuationResult {
    const existing = this.byId.get(result.valuationId);
    if (existing) {
      return existing;
    }
    this.byId.set(result.valuationId, result);
    const chain = this.byContribution.get(result.contributionId) ?? [];
    chain.push(result.valuationId);
    this.byContribution.set(result.contributionId, chain);
    return result;
  }

  get(valuationId: ValuationId): HumanContributionValuationResult | undefined {
    return this.byId.get(valuationId);
  }

  listByContribution(contributionId: ContributionId): readonly HumanContributionValuationResult[] {
    const ids = this.byContribution.get(contributionId) ?? [];
    return Object.freeze(ids.map((id) => this.byId.get(id)).filter((item): item is HumanContributionValuationResult => item !== undefined));
  }

  latest(contributionId: ContributionId): HumanContributionValuationResult | undefined {
    const list = this.listByContribution(contributionId);
    return list[list.length - 1];
  }
}
