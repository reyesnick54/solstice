import type { UtcInstant } from '../../../domain/src/time.ts';
import type { HumanEconomicIdentityId, IdentityRevocationId } from './ids.ts';
import { identityRevocationIdFor } from './ids.ts';
import type { HumanEconomicIdentityStatus, IdentityRevocationRecord } from './types.ts';

export function isIdentityOperational(status: HumanEconomicIdentityStatus): boolean {
  return status === 'ACTIVE' || status === 'RECOVERED';
}

export function futureActionsBlocked(status: HumanEconomicIdentityStatus): boolean {
  return status === 'SUSPENDED' || status === 'REVOKED' || status === 'COMPROMISED';
}

export function createRevocationRecord(input: {
  readonly humanActorId: HumanEconomicIdentityId;
  readonly status: 'SUSPENDED' | 'REVOKED' | 'COMPROMISED';
  readonly reasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly effectiveFrom: UtcInstant;
}): IdentityRevocationRecord {
  return Object.freeze({
    revocationId: identityRevocationIdFor(`${input.humanActorId}:${input.status}:${input.effectiveFrom}`),
    humanActorId: input.humanActorId,
    status: input.status,
    reasonCode: input.reasonCode,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    effectiveFrom: input.effectiveFrom,
    futureActionsBlocked: true,
    rewritesHistoricalChain: false,
    createdAt: input.effectiveFrom,
  });
}

export function statusFromRevocation(
  revocation: IdentityRevocationRecord,
): HumanEconomicIdentityStatus {
  return revocation.status;
}

export function markRecoveredStatus(
  priorStatus: HumanEconomicIdentityStatus,
): HumanEconomicIdentityStatus {
  if (priorStatus === 'REVOKED') {
    return 'RECOVERED';
  }
  return 'ACTIVE';
}

export function revocationBlocksFutureOnly(revocation: IdentityRevocationRecord): boolean {
  return revocation.rewritesHistoricalChain === false && revocation.futureActionsBlocked === true;
}

export type IdentityRevocationIndex = Map<IdentityRevocationId, IdentityRevocationRecord>;
