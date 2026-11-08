import type { ChronologicalMarketOpportunity, ChronologicalOpportunitySet } from './types.ts';
import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';

export function createChronologicalOpportunitySet(input: {
  readonly opportunitySetId: string;
  readonly opportunities: readonly ChronologicalMarketOpportunity[];
}): ChronologicalOpportunitySet {
  const sorted = [...input.opportunities].sort((a, b) => a.chronologicalIndex - b.chronologicalIndex);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i]!.chronologicalIndex !== i) {
      throw new Error('ALPHA20 opportunities must use dense chronological indices from zero');
    }
    if (i > 0 && sorted[i]!.decisionAt < sorted[i - 1]!.decisionAt) {
      throw new Error('ALPHA20 opportunity decisionAt must be non-decreasing');
    }
  }
  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    opportunitySetId: input.opportunitySetId,
    opportunities: Object.freeze(sorted),
    strictlyChronological: true,
  });
}

/**
 * Every cohort member receives the same opportunity ids in the same order when economically appropriate.
 */
export function sharedOpportunityIdsForCohort(set: ChronologicalOpportunitySet): readonly string[] {
  return Object.freeze(set.opportunities.map((o) => o.opportunityId));
}

export function assertMembersShareIdenticalOpportunityCalendar(
  memberOpportunityIds: Readonly<Record<string, readonly string[]>>,
  canonical: readonly string[],
): boolean {
  for (const [memberId, ids] of Object.entries(memberOpportunityIds)) {
    if (ids.length !== canonical.length) {
      throw new Error(`ALPHA20 calendar misalignment: member ${memberId} opportunity count differs`);
    }
    for (let i = 0; i < canonical.length; i += 1) {
      if (ids[i] !== canonical[i]) {
        throw new Error(
          `ALPHA20 calendar arbitrage blocked: member ${memberId} opportunity ${ids[i]} != ${canonical[i]}`,
        );
      }
    }
  }
  return true;
}

export function rejectUnequalOpportunitySets(
  memberA: string,
  memberB: string,
  idsA: readonly string[],
  idsB: readonly string[],
): void {
  if (idsA.length !== idsB.length) {
    throw new Error(`ALPHA20 unequal opportunity sets between ${memberA} and ${memberB}`);
  }
  for (let i = 0; i < idsA.length; i += 1) {
    if (idsA[i] !== idsB[i]) {
      throw new Error(
        `ALPHA20 comparing strategies on different days blocked (${memberA} vs ${memberB} at index ${i})`,
      );
    }
  }
}
