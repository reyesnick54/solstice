import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthoritativeIdCommitment, CrossIdentityConflict, CrossIdentityConflictCode, HumanEconomicIdentityId } from './types.ts';

export type CrossIdentityIndex = Map<string, { readonly humanEconomicIdentityId: HumanEconomicIdentityId; readonly kind: string }>;

export function createCrossIdentityIndex(): CrossIdentityIndex {
  return new Map();
}

export function classifyCrossIdentityConflict(authoritativeKind: string): CrossIdentityConflictCode {
  if (authoritativeKind === 'credential' || authoritativeKind === 'receipt') {
    return 'FRAUD_SUSPECTED';
  }
  if (authoritativeKind === 'doi' || authoritativeKind === 'publication') {
    return 'MANUAL_REVIEW_REQUIRED';
  }
  return 'CONFLICT';
}

function kindFromCommitmentKey(key: string): string {
  return key.split(':')[0] ?? 'unknown';
}

/**
 * Detect the same authoritative contribution receipt/credential/event being
 * claimed by multiple HumanEconomicIdentities.
 */
export function detectCrossIdentityConflict(input: {
  readonly authoritativeIdCommitment: AuthoritativeIdCommitment;
  readonly authoritativeKind: string;
  readonly humanEconomicIdentityId: HumanEconomicIdentityId;
  readonly index: CrossIdentityIndex;
  readonly detectedAtUtc: UtcInstant;
}): CrossIdentityConflict | null {
  const key = String(input.authoritativeIdCommitment);
  const existing = input.index.get(key);
  if (!existing) {
    input.index.set(key, { humanEconomicIdentityId: input.humanEconomicIdentityId, kind: input.authoritativeKind });
    return null;
  }
  if (existing.humanEconomicIdentityId === input.humanEconomicIdentityId) {
    return null;
  }
  return Object.freeze({
    authoritativeIdCommitment: input.authoritativeIdCommitment,
    existingIdentityId: existing.humanEconomicIdentityId,
    conflictingIdentityId: input.humanEconomicIdentityId,
    code: classifyCrossIdentityConflict(existing.kind || input.authoritativeKind),
    detectedAtUtc: input.detectedAtUtc,
  });
}

export function registerAuthoritativeIdentity(
  authoritativeIds: readonly { readonly kind: string; readonly commitment: AuthoritativeIdCommitment }[],
  humanEconomicIdentityId: HumanEconomicIdentityId,
  index: CrossIdentityIndex,
  detectedAtUtc: UtcInstant,
): readonly CrossIdentityConflict[] {
  const conflicts: CrossIdentityConflict[] = [];
  for (const authoritative of authoritativeIds) {
    const conflict = detectCrossIdentityConflict({
      authoritativeIdCommitment: authoritative.commitment,
      authoritativeKind: authoritative.kind,
      humanEconomicIdentityId,
      index,
      detectedAtUtc,
    });
    if (conflict) {
      conflicts.push(conflict);
    }
  }
  return Object.freeze(conflicts);
}

export function commitmentKindFromObservation(input: {
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly receiptId?: string;
  readonly credentialCommitment?: string;
}): readonly { readonly kind: string; readonly commitment: AuthoritativeIdCommitment }[] {
  return input.authoritativeIdCommitments.map((commitment, index) => {
    if (input.credentialCommitment && index === 0) {
      return { kind: 'credential', commitment };
    }
    if (input.receiptId && index === 0) {
      return { kind: 'receipt', commitment };
    }
    const key = String(commitment);
    return { kind: kindFromCommitmentKey(key.includes(':') ? key : `doi:${key}`), commitment };
  });
}
