import type { UtcInstant } from '@solstice/domain';

export function isWorkforceArtifactKnowableAt<T extends { readonly knowableAt: UtcInstant }>(
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

export function filterKnowableWorkforceArtifacts<T extends { readonly knowableAt: UtcInstant }>(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly T[],
): readonly T[] {
  return Object.freeze(artifacts.filter((row) => isWorkforceArtifactKnowableAt(evaluationTimeUtc, row)));
}

export function assertNoWorkforceLeakage<T extends { readonly knowableAt: UtcInstant; readonly observationId?: string }>(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly T[],
): void {
  for (const artifact of artifacts) {
    if (!isWorkforceArtifactKnowableAt(evaluationTimeUtc, artifact)) {
      const ref = artifact.observationId ?? 'unknown';
      throw new Error(`workforce artifact ${ref} not knowable at ${evaluationTimeUtc}`);
    }
  }
}
