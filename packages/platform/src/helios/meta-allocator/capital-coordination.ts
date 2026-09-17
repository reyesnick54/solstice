import type { MetaAllocationCandidateInput, CapitalCoordinationClaim } from './types.ts';
import type { CapitalRecommendationId, MetaAllocationCandidateId } from './ids.ts';
import { asCapitalRecommendationId } from './ids.ts';
import { randomUUID } from 'node:crypto';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

export type RankedCandidate = {
  readonly candidate: MetaAllocationCandidateInput;
  readonly priorityScore: bigint;
  readonly requestedMinor: bigint;
  readonly recommendationId: CapitalRecommendationId;
};

export function rankCandidatesForCapital(
  candidates: readonly {
    readonly candidate: MetaAllocationCandidateInput;
    readonly requestedMinor: bigint;
    readonly propose: boolean;
  }[],
): readonly RankedCandidate[] {
  return Object.freeze(
    candidates
      .filter((row) => row.propose)
      .map((row) =>
        Object.freeze({
          candidate: row.candidate,
          priorityScore: parseMinor(row.candidate.researchValue.estimatedOpportunitySizeMinor),
          requestedMinor: row.requestedMinor,
          recommendationId: asCapitalRecommendationId(`mcr_${randomUUID()}`),
        }),
      )
      .sort((a, b) => (a.priorityScore === b.priorityScore ? 0 : a.priorityScore > b.priorityScore ? -1 : 1)),
  );
}

export function allocateCompetingCapital(input: {
  readonly ranked: readonly RankedCandidate[];
  readonly availableCashMinor: bigint;
  readonly existingClaims: readonly CapitalCoordinationClaim[];
  readonly currency: string;
}): {
  readonly claims: readonly CapitalCoordinationClaim[];
  readonly allocations: ReadonlyMap<MetaAllocationCandidateId, bigint>;
  readonly unallocatedCashMinor: string;
} {
  let remaining = input.availableCashMinor;
  for (const claim of input.existingClaims) {
    if (claim.currency === input.currency) {
      remaining -= parseMinor(claim.claimedCapitalMinor);
    }
  }

  const allocations = new Map<MetaAllocationCandidateId, bigint>();
  const claims: CapitalCoordinationClaim[] = [];

  for (const row of input.ranked) {
    if (remaining <= 0n) {
      break;
    }
    const minOrder = parseMinor(row.candidate.costAssumptions.minimumOrderSizeMinor);
    const alloc = row.requestedMinor <= remaining ? row.requestedMinor : remaining;
    if (alloc <= 0n || alloc < minOrder) {
      continue;
    }
    allocations.set(row.candidate.candidateId, alloc);
    claims.push(
      Object.freeze({
        candidateId: row.candidate.candidateId,
        claimedCapitalMinor: alloc.toString(),
        currency: input.currency,
        recommendationId: row.recommendationId,
      }),
    );
    remaining -= alloc;
  }

  return Object.freeze({
    claims: Object.freeze(claims),
    allocations,
    unallocatedCashMinor: remaining.toString(),
  });
}
