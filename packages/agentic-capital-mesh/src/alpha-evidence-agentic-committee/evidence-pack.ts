import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { AlphaEvidenceRef, FrozenAlphaEvidencePack } from './types.ts';

function stableEvidenceDigest(evidence: readonly AlphaEvidenceRef[]): string {
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

export function freezeAlphaEvidencePack(input: {
  readonly packId: string;
  readonly evidence: readonly AlphaEvidenceRef[];
  readonly frozenAt: UtcInstant;
}): FrozenAlphaEvidencePack {
  if (input.evidence.length === 0) {
    throw new Error('ALPHA14 committee requires a non-empty point-in-time evidence pack');
  }
  const contentHash = stableEvidenceDigest(input.evidence);
  return Object.freeze({
    packId: input.packId,
    contentHash,
    frozenAt: input.frozenAt,
    evidence: Object.freeze([...input.evidence]),
  });
}

export function assertAlphaEvidencePackUnchanged(
  pack: FrozenAlphaEvidencePack,
  candidate: readonly AlphaEvidenceRef[],
): void {
  const digest = stableEvidenceDigest(candidate);
  if (digest !== pack.contentHash) {
    throw new Error('evidence pack changed after freeze; ALPHA14 committee aborted');
  }
}
