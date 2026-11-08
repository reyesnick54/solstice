import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';
import type { OpportunityAssignmentMode } from './taxonomy.ts';
import type { CohortAllocationPolicy, ForwardExperimentId } from './types.ts';
import { mulberry32 } from './rng.ts';

export function buildCohortAllocationPolicy(input: {
  readonly policyId: string;
  readonly experimentId: ForwardExperimentId;
  readonly memberIds: readonly string[];
  readonly memberWeightBps?: Readonly<Record<string, number>>;
  readonly sharedPortfolioCapitalMinor: string;
  readonly opportunityAssignmentMode: OpportunityAssignmentMode;
  readonly assignmentSeed?: number | null;
}): CohortAllocationPolicy {
  if (BigInt(input.sharedPortfolioCapitalMinor) <= 0n) {
    throw new Error('ALPHA20 shared portfolio capital must be positive');
  }
  const weights: Record<string, number> = {};
  if (input.memberWeightBps) {
    for (const id of input.memberIds) {
      const w = input.memberWeightBps[id];
      if (w === undefined || w < 0) {
        throw new Error(`ALPHA20 missing weight for member ${id}`);
      }
      weights[id] = w;
    }
  } else {
    const each = Math.floor(10_000 / input.memberIds.length);
    let remainder = 10_000 - each * input.memberIds.length;
    for (const id of input.memberIds) {
      weights[id] = each + (remainder > 0 ? 1 : 0);
      if (remainder > 0) {
        remainder -= 1;
      }
    }
  }
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total !== 10_000) {
    throw new Error(`ALPHA20 member weights must sum to 10000 bps, got ${total}`);
  }

  const mode = input.opportunityAssignmentMode;
  let seed: number | null = null;
  if (mode === 'DETERMINISTIC_SEEDED_RANDOM') {
    if (input.assignmentSeed === undefined || input.assignmentSeed === null) {
      throw new Error('ALPHA20 DETERMINISTIC_SEEDED_RANDOM requires assignmentSeed');
    }
    seed = input.assignmentSeed >>> 0;
  }

  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    policyId: input.policyId,
    experimentId: input.experimentId,
    memberWeightBps: Object.freeze({ ...weights }),
    sharedPortfolioCapitalMinor: input.sharedPortfolioCapitalMinor,
    isolatedShadowAccounts: true,
    customerCapitalRandomized: false,
    opportunityAssignmentMode: mode,
    assignmentSeed: seed,
  });
}

/**
 * Research-only deterministic shuffle of opportunity ids for assignment audits (never customer capital).
 */
export function deterministicOpportunityPermutation(
  opportunityIds: readonly string[],
  seed: number,
): readonly string[] {
  const arr = [...opportunityIds];
  const rnd = mulberry32(seed >>> 0);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return Object.freeze(arr);
}

export function assertCustomerCapitalNeverRandomized(policy: CohortAllocationPolicy): void {
  if (policy.customerCapitalRandomized) {
    throw new Error('ALPHA20 customer capital randomization forbidden');
  }
}
