/**
 * Feature knowability — derived from contributing observations, never period-end alone.
 */

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import type { FeatureContributionInput, FeatureObservation } from './types.ts';

export function maxKnowableAt(contributions: readonly FeatureContributionInput[]): UtcInstant {
  if (contributions.length === 0) {
    throw new Error('contributions required to compute feature knowableAt');
  }
  let latest = contributions[0]!.informationTime.knowableAt;
  for (let i = 1; i < contributions.length; i += 1) {
    const candidate = contributions[i]!.informationTime.knowableAt;
    if (Date.parse(candidate) > Date.parse(latest)) {
      latest = candidate;
    }
  }
  return latest;
}

export function maxKnowableAtObservations(observations: readonly FeatureObservation[]): UtcInstant {
  if (observations.length === 0) {
    throw new Error('input observations required to compute derived knowableAt');
  }
  let latest = observations[0]!.knowableAt;
  for (let i = 1; i < observations.length; i += 1) {
    const candidate = observations[i]!.knowableAt;
    if (Date.parse(candidate) > Date.parse(latest)) {
      latest = candidate;
    }
  }
  return latest;
}

/** A feature is visible at T only when feature.knowableAt <= T. */
export function isFeatureVisibleAt(evaluationTimeUtc: UtcInstant, featureKnowableAt: UtcInstant): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(featureKnowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return evalMs >= knowableMs;
}

export function rejectFutureContribution(
  evaluationTimeUtc: UtcInstant,
  contribution: FeatureContributionInput,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (!isFeatureVisibleAt(evaluationTimeUtc, contribution.informationTime.knowableAt)) {
    return {
      ok: false,
      code: 'FUTURE_OBSERVATION',
      message: `observation ${contribution.observationId} not knowable at evaluation time`,
    };
  }
  return { ok: true };
}

export function rejectAnyFutureContribution(
  evaluationTimeUtc: UtcInstant,
  contributions: readonly FeatureContributionInput[],
): { readonly ok: false; readonly code: string; readonly message: string } | { readonly ok: true } {
  for (const contribution of contributions) {
    const check = rejectFutureContribution(evaluationTimeUtc, contribution);
    if (!check.ok) {
      return check;
    }
  }
  return { ok: true };
}

export function rejectFutureInputObservation(
  evaluationTimeUtc: UtcInstant,
  observation: FeatureObservation,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (!isFeatureVisibleAt(evaluationTimeUtc, observation.knowableAt)) {
    return {
      ok: false,
      code: 'FUTURE_INPUT_FEATURE',
      message: `input feature ${observation.featureId} not knowable at evaluation time`,
    };
  }
  return { ok: true };
}

export function assertDerivedKnowableNotBeforeInputs(
  derivedKnowableAt: UtcInstant,
  inputs: readonly FeatureObservation[],
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  const derivedMs = Date.parse(derivedKnowableAt);
  for (const input of inputs) {
    const inputMs = Date.parse(input.knowableAt);
    if (Number.isFinite(derivedMs) && Number.isFinite(inputMs) && derivedMs < inputMs) {
      return {
        ok: false,
        code: 'DERIVED_PREDATES_INPUT',
        message: `derived knowableAt precedes input ${input.featureId}`,
      };
    }
  }
  return { ok: true };
}

export function assertKnowableNotFromEventTimeAlone(input: {
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly hasPublicationOrAvailability: boolean;
}): void {
  if (input.hasPublicationOrAvailability) {
    return;
  }
  const eventMs = Date.parse(input.eventTime);
  const knowableMs = Date.parse(input.knowableAt);
  if (!Number.isFinite(eventMs) || !Number.isFinite(knowableMs)) {
    return;
  }
  if (knowableMs <= eventMs) {
    throw new Error('knowableAt must not be derived from economic period-end alone');
  }
}

export function parseFeatureEvaluationTime(value: string): UtcInstant {
  return asUtcInstant(value);
}
