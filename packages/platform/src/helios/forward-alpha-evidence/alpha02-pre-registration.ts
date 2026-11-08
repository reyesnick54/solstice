/**
 * ALPHA02 — pre-registered statistical policy (frozen before forward observations).
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { PreRegisteredStatisticalPolicy } from './types.ts';

export const HELIOS_ALPHA02_PRE_REGISTRATION = 'HELIOS_ALPHA02_PRE_REGISTRATION' as const;

export function freezeStatisticalPolicy(input: {
  readonly policyId: string;
  readonly frozenAt: UtcInstant;
  readonly primaryEndpoint: PreRegisteredStatisticalPolicy['primaryEndpoint'];
  readonly alphaSpendLimit: number;
  readonly sequentialMethod: PreRegisteredStatisticalPolicy['sequentialMethod'];
}): PreRegisteredStatisticalPolicy {
  if (input.alphaSpendLimit <= 0 || input.alphaSpendLimit > 1) {
    throw new Error('alphaSpendLimit must be in (0, 1]');
  }
  const payload = JSON.stringify({
    policyId: input.policyId,
    primaryEndpoint: input.primaryEndpoint,
    alphaSpendLimit: input.alphaSpendLimit,
    sequentialMethod: input.sequentialMethod,
  });
  const contentHash = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({
    policyId: input.policyId,
    frozenAt: input.frozenAt,
    contentHash,
    primaryEndpoint: input.primaryEndpoint,
    alphaSpendLimit: input.alphaSpendLimit,
    sequentialMethod: input.sequentialMethod,
  });
}

export function policyMutationForbidden(
  before: PreRegisteredStatisticalPolicy,
  after: PreRegisteredStatisticalPolicy,
): boolean {
  return before.contentHash !== after.contentHash && before.policyId === after.policyId;
}
