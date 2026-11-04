/**
 * EARN01 — point-in-time visibility for earnings intelligence (no leakage).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export function isEarningsArtifactKnowableAt<T extends { readonly knowableAt: UtcInstant }>(
  evaluationTimeUtc: UtcInstant,
  artifact: T,
): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(artifact.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function filterKnowableEarningsArtifacts<T extends { readonly knowableAt: UtcInstant }>(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly T[],
): readonly T[] {
  return Object.freeze(artifacts.filter((row) => isEarningsArtifactKnowableAt(evaluationTimeUtc, row)));
}

export function assertNoEarningsLeakage<T extends { readonly knowableAt: UtcInstant; readonly observationId?: string; readonly snapshotId?: string; readonly eventId?: string }>(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly T[],
): void {
  for (const artifact of artifacts) {
    if (!isEarningsArtifactKnowableAt(evaluationTimeUtc, artifact)) {
      const ref =
        'observationId' in artifact && artifact.observationId
          ? artifact.observationId
          : 'snapshotId' in artifact && artifact.snapshotId
            ? artifact.snapshotId
            : 'eventId' in artifact
              ? String(artifact.eventId)
              : 'unknown';
      throw new Error(`earnings artifact ${ref} not knowable at ${evaluationTimeUtc}`);
    }
  }
}
