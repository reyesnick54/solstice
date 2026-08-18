import { createHash } from 'node:crypto';

import type { HumanInformationNetworkPolicy } from './policy.ts';
import type { NetworkFailure } from './types.ts';

export type PrivacyBudget = {
  readonly version: string;
  readonly differentialPrivacyClaimed: false;
  readonly remainingQueries: number;
  readonly mechanism: 'NONE_CONFIGURED';
};

export function createPrivacyBudget(policy: HumanInformationNetworkPolicy): PrivacyBudget {
  return Object.freeze({
    version: policy.privacyBudgetVersion,
    differentialPrivacyClaimed: false,
    remainingQueries: policy.maxQueriesPerRequesterPurpose,
    mechanism: 'NONE_CONFIGURED',
  });
}

export function computationHash(input: {
  readonly codeVersion: string;
  readonly artifactDigest: string;
  readonly inputRightDescriptors: readonly string[];
  readonly privacyPolicyVersion: string;
  readonly outputPolicy: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        codeVersion: input.codeVersion,
        artifactDigest: input.artifactDigest,
        inputRightDescriptors: input.inputRightDescriptors,
        privacyPolicyVersion: input.privacyPolicyVersion,
        outputPolicy: input.outputPolicy,
      }),
    )
    .digest('hex');
}

export function queryFingerprint(requesterId: string, purpose: string, computationId: string): string {
  return createHash('sha256').update(`${requesterId}|${purpose}|${computationId}`).digest('hex');
}

export function enforceOutputBounds(
  policy: HumanInformationNetworkPolicy,
  outputRowCount: number,
): NetworkFailure | null {
  if (outputRowCount > policy.maxOutputRows) {
    return { code: 'OUTPUT_BOUNDS_EXCEEDED', message: 'requester-controlled row-level output is refused' };
  }
  return null;
}

export function enforceCohort(
  policy: HumanInformationNetworkPolicy,
  cohortSize: number,
  aggregate: boolean,
): NetworkFailure | null {
  if (aggregate && cohortSize < policy.minCohortSize) {
    return { code: 'MIN_COHORT_NOT_MET', message: `aggregate computation requires cohort >= ${policy.minCohortSize}` };
  }
  return null;
}

export function detectQueryAbuse(priorCount: number, policy: HumanInformationNetworkPolicy): NetworkFailure | null {
  if (priorCount >= policy.maxQueriesPerRequesterPurpose) {
    return { code: 'QUERY_ABUSE', message: 'repeated-query extraction is refused' };
  }
  return null;
}
