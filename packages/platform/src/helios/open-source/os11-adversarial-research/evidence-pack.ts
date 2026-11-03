import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { DebateEvidenceRef, FrozenEvidencePack } from './types.ts';

function stableEvidenceDigest(evidence: readonly DebateEvidenceRef[]): string {
  const rows = [...evidence]
    .map((row) =>
      [
        row.evidenceId,
        row.sourceKind,
        row.sourceRef,
        row.observedAt,
        row.freshnessOk ? '1' : '0',
        row.entitlementOk ? '1' : '0',
        row.provenanceRef,
      ].join('|'),
    )
    .sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

/**
 * Freezes an evidence pack for debate. Mutations after freeze are rejected by hash mismatch.
 */
export function freezeEvidencePack(input: {
  readonly packId: string;
  readonly evidence: readonly DebateEvidenceRef[];
  readonly frozenAt: UtcInstant;
}): FrozenEvidencePack {
  if (input.evidence.length === 0) {
    throw new Error('adversarial research requires a non-empty evidence pack');
  }
  const contentHash = stableEvidenceDigest(input.evidence);
  return Object.freeze({
    packId: input.packId,
    contentHash,
    frozenAt: input.frozenAt,
    evidence: Object.freeze([...input.evidence]),
  });
}

export function assertEvidencePackUnchanged(
  pack: FrozenEvidencePack,
  candidate: readonly DebateEvidenceRef[],
): void {
  const digest = stableEvidenceDigest(candidate);
  if (digest !== pack.contentHash) {
    throw new Error('evidence pack changed after freeze; debate aborted');
  }
}
