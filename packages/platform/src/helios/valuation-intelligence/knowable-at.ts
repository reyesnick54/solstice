/**
 * VAL01 — point-in-time visibility for valuation intelligence (no leakage).
 */

import type { UtcInstant } from '@solstice/domain';

import type { MarketImpliedExpectation } from './distribution.ts';

export function isValuationArtifactKnowableAt<T extends { readonly knowableAt: UtcInstant }>(
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

export function filterKnowableValuationArtifacts<T extends { readonly knowableAt: UtcInstant }>(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly T[],
): readonly T[] {
  return Object.freeze(artifacts.filter((row) => isValuationArtifactKnowableAt(evaluationTimeUtc, row)));
}

/** Market-implied rows use `asOfKnowableAt` instead of inheriting `knowableAt` from the temporal envelope. */
export function filterKnowableMarketImpliedExpectations(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly MarketImpliedExpectation[],
): readonly MarketImpliedExpectation[] {
  const evalMs = Date.parse(evaluationTimeUtc);
  return Object.freeze(
    artifacts.filter((row) => {
      const knowableMs = Date.parse(row.asOfKnowableAt);
      return Number.isFinite(evalMs) && Number.isFinite(knowableMs) && evalMs >= knowableMs;
    }),
  );
}

export function assertNoMarketImpliedLeakage(
  evaluationTimeUtc: UtcInstant,
  artifacts: readonly MarketImpliedExpectation[],
): void {
  const evalMs = Date.parse(evaluationTimeUtc);
  for (const artifact of artifacts) {
    const knowableMs = Date.parse(artifact.asOfKnowableAt);
    if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs) || evalMs < knowableMs) {
      throw new Error(
        `market implied expectation ${artifact.expectationId} not knowable at ${evaluationTimeUtc}`,
      );
    }
  }
}

export function assertNoValuationLeakage<
  T extends {
    readonly knowableAt: UtcInstant;
    readonly snapshotId?: string;
    readonly assumptionId?: string;
    readonly scenarioId?: string;
    readonly distributionId?: string;
    readonly expectationId?: string;
  },
>(evaluationTimeUtc: UtcInstant, artifacts: readonly T[]): void {
  for (const artifact of artifacts) {
    if (!isValuationArtifactKnowableAt(evaluationTimeUtc, artifact)) {
      const ref =
        artifact.snapshotId ??
        artifact.assumptionId ??
        artifact.scenarioId ??
        artifact.distributionId ??
        artifact.expectationId ??
        'unknown';
      throw new Error(`valuation artifact ${ref} not knowable at ${evaluationTimeUtc}`);
    }
  }
}
