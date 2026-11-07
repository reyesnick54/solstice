/**
 * ALT01 knowability — decision-time PIT and backfill prohibition.
 * ALT05 digital-demand artifact visibility helpers.
 */

import type { UtcInstant } from '@solstice/domain';
import { isFeatureVisibleAt } from '../feature-fabric/knowable-at.ts';
import type { AlternativeDataObservation } from './types.ts';

/** Enforces alternativeData.knowableAt <= decisionTime. */
export function isAlternativeDataVisibleAtDecision(
  decisionTime: UtcInstant,
  observation: Pick<AlternativeDataObservation, 'knowableAt'>,
): boolean {
  return isFeatureVisibleAt(decisionTime, observation.knowableAt);
}

export function filterKnowableAlternativeDataObservations(
  observations: readonly AlternativeDataObservation[],
  decisionTime: UtcInstant,
): readonly AlternativeDataObservation[] {
  return Object.freeze(observations.filter((row) => isAlternativeDataVisibleAtDecision(decisionTime, row)));
}

/**
 * Backfilled provider data must not appear in historical research before its historical availability.
 * Rejects observations whose eventTime is before providerAvailableAt when knowableAt would allow
 * an impossible retrospective view.
 */
export function assertNoBackfillBeforeHistoricalAvailability(
  observation: AlternativeDataObservation,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (!observation.eventTime) {
    return { ok: true };
  }
  const eventMs = Date.parse(observation.eventTime);
  const availMs = Date.parse(observation.providerAvailableAt);
  const knowableMs = Date.parse(observation.knowableAt);
  if (!Number.isFinite(eventMs) || !Number.isFinite(availMs) || !Number.isFinite(knowableMs)) {
    return { ok: false, code: 'INVALID_TIMESTAMPS', message: 'alternative data observation has invalid timestamps' };
  }
  if (eventMs < availMs && knowableMs < availMs) {
    return {
      ok: false,
      code: 'BACKFILL_BEFORE_AVAILABILITY',
      message: 'backfilled observation cannot be knowable before provider historical availability',
    };
  }
  if (availMs > knowableMs) {
    return {
      ok: false,
      code: 'AVAILABILITY_AFTER_KNOWABLE',
      message: 'providerAvailableAt must not exceed knowableAt',
    };
  }
  return { ok: true };
}

export function assertAlternativeDataKnowableAtDecision(
  decisionTime: UtcInstant,
  observation: AlternativeDataObservation,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (!isAlternativeDataVisibleAtDecision(decisionTime, observation)) {
    return {
      ok: false,
      code: 'FUTURE_ALTERNATIVE_DATA',
      message: `observation ${observation.observationId} not knowable at decision time`,
    };
  }
  return assertNoBackfillBeforeHistoricalAvailability(observation);
}

export function isDigitalDemandArtifactKnowableAt<T extends { readonly envelope: { readonly knowableAt: UtcInstant } }>(
  evaluationTimeUtc: UtcInstant,
  artifact: T,
): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(artifact.envelope.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function filterKnowableDigitalDemandArtifacts<
  T extends { readonly envelope: { readonly knowableAt: UtcInstant } },
>(evaluationTimeUtc: UtcInstant, artifacts: readonly T[]): readonly T[] {
  return Object.freeze(artifacts.filter((row) => isDigitalDemandArtifactKnowableAt(evaluationTimeUtc, row)));
}

export function assertNoDigitalDemandLeakage<
  T extends { readonly observationId: string; readonly envelope: { readonly knowableAt: UtcInstant } },
>(evaluationTimeUtc: UtcInstant, artifacts: readonly T[]): void {
  for (const artifact of artifacts) {
    if (!isDigitalDemandArtifactKnowableAt(evaluationTimeUtc, artifact)) {
      throw new Error(`digital-demand observation ${artifact.observationId} not knowable at ${evaluationTimeUtc}`);
    }
  }
}
