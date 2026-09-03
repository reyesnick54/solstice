/**
 * Wave 6 — Post-finality correction records.
 *
 * Append-only challenge/correction state. Does NOT automatically seize or
 * burn user-held SunRey. Corrective monetary mechanisms require explicit
 * governed monetary policy.
 */

import { createHash } from 'node:crypto';

import type { PostFinalityCorrectionRecord } from './types.ts';

export type CorrectionRegistry = {
  readonly corrections: Map<string, PostFinalityCorrectionRecord>;
  readonly byClaimId: Map<string, readonly string[]>;
};

export function emptyCorrectionRegistry(): CorrectionRegistry {
  return {
    corrections: new Map(),
    byClaimId: new Map(),
  };
}

export function appendCorrectionRecord(
  registry: CorrectionRegistry,
  input: {
    readonly economicClaimId: string;
    readonly challengeId: string;
    readonly relatedTransactionId: string;
    readonly correctionKind: PostFinalityCorrectionRecord['correctionKind'];
    readonly recordedAtUtc: string;
  },
): PostFinalityCorrectionRecord {
  const correctionId = createHash('sha256')
    .update(`correction:${input.economicClaimId}:${input.challengeId}:${input.recordedAtUtc}`)
    .digest('hex');
  const record: PostFinalityCorrectionRecord = Object.freeze({
    correctionId,
    economicClaimId: input.economicClaimId,
    challengeId: input.challengeId,
    relatedTransactionId: input.relatedTransactionId,
    correctionKind: input.correctionKind,
    recordedAtUtc: input.recordedAtUtc,
    automaticSeizureForbidden: true,
    automaticBurnForbidden: true,
    requiresGovernedMonetaryPolicy: true,
    appendOnly: true,
  });
  registry.corrections.set(correctionId, record);
  const existing = registry.byClaimId.get(input.economicClaimId) ?? [];
  registry.byClaimId.set(input.economicClaimId, [...existing, correctionId]);
  return record;
}

export function getCorrectionsForClaim(
  registry: CorrectionRegistry,
  economicClaimId: string,
): readonly PostFinalityCorrectionRecord[] {
  const ids = registry.byClaimId.get(economicClaimId) ?? [];
  return ids
    .map((id) => registry.corrections.get(id))
    .filter((row): row is PostFinalityCorrectionRecord => row !== undefined);
}

export function automaticCorrectiveBurnForbidden(): true {
  return true;
}
