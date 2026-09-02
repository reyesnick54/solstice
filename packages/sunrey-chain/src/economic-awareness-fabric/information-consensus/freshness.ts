/**
 * Policy-driven freshness evaluation.
 *
 * Stale observations must not silently support a current fact.
 */

import type { FreshnessStatus } from '../../../../provider-sdk/src/observation-types.ts';
import type { NormalizedEconomicObservation } from '../types.ts';
import type { FreshnessAssessment } from './types.ts';
import type { FreshnessPolicy } from './methodology.ts';

function ageMs(observedAt: string, evaluatedAt: string): number {
  return Math.max(0, Date.parse(evaluatedAt) - Date.parse(observedAt));
}

export function freshnessStatusForAge(age: number, maxAgeMs: number): FreshnessStatus {
  if (age > maxAgeMs) {
    return 'stale';
  }
  if (age > maxAgeMs * 0.75) {
    return 'aging';
  }
  return 'fresh';
}

export function assessFreshness(
  observations: readonly NormalizedEconomicObservation[],
  policy: FreshnessPolicy,
  evaluatedAt: string,
): FreshnessAssessment {
  const staleObservationIds: string[] = [];
  let oldestObservationAgeMs = 0;

  for (const observation of observations) {
    const age = ageMs(observation.observedAt, evaluatedAt);
    oldestObservationAgeMs = Math.max(oldestObservationAgeMs, age);
    if (age > policy.maxAgeMs) {
      staleObservationIds.push(observation.observationId);
    }
  }

  const status = freshnessStatusForAge(oldestObservationAgeMs, policy.maxAgeMs);

  return Object.freeze({
    status,
    policyWindowMs: policy.maxAgeMs,
    oldestObservationAgeMs,
    staleObservationIds: Object.freeze([...staleObservationIds].sort()),
  });
}

export function anyStaleSupportingCurrentFact(assessment: FreshnessAssessment): boolean {
  return assessment.staleObservationIds.length > 0 || assessment.status === 'stale';
}
