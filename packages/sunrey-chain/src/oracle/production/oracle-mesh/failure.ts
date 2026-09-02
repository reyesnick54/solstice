/**
 * Source failure handling — operational availability vs economic sufficiency.
 *
 * One oracle failure does not necessarily fail the entire system, but
 * a claim must not be marked verified unless policy requirements remain satisfied.
 */

import type { OracleMeshExplanationCode, OracleMeshResult } from './types.ts';

export type SourceAvailability = {
  readonly providerId: string;
  readonly operationallyAvailable: boolean;
  readonly economicallySufficient: boolean;
};

export type FailureAssessment = {
  readonly availability: readonly SourceAvailability[];
  readonly operationalOutageCount: number;
  readonly economicSufficiencyMet: boolean;
  readonly explanationCodes: readonly OracleMeshExplanationCode[];
};

export function assessSourceFailures(input: {
  readonly providers: readonly { readonly providerId: string; readonly available: boolean }[];
  readonly independentSourceCount: number;
  readonly minimumIndependentSources: number;
}): FailureAssessment {
  const availability = input.providers.map((row) =>
    Object.freeze({
      providerId: row.providerId,
      operationallyAvailable: row.available,
      economicallySufficient: row.available,
    }),
  );
  const operationalOutageCount = availability.filter((row) => !row.operationallyAvailable).length;
  const economicSufficiencyMet = input.independentSourceCount >= input.minimumIndependentSources;
  const explanationCodes: OracleMeshExplanationCode[] = [];

  if (operationalOutageCount > 0) {
    explanationCodes.push('PROVIDER_OPERATIONALLY_UNAVAILABLE');
  }
  if (!economicSufficiencyMet) {
    explanationCodes.push('ECONOMIC_SUFFICIENCY_NOT_MET');
  }

  return Object.freeze({
    availability: Object.freeze(availability),
    operationalOutageCount,
    economicSufficiencyMet,
    explanationCodes: Object.freeze(explanationCodes),
  });
}

export function failureResult(
  assessment: FailureAssessment,
  hasAdmittedObservations: boolean,
): OracleMeshResult | null {
  if (!hasAdmittedObservations && assessment.operationalOutageCount > 0) {
    return 'PROVIDER_OUTAGE';
  }
  if (!assessment.economicSufficiencyMet) {
    return 'INSUFFICIENT_INDEPENDENT_SOURCES';
  }
  return null;
}

export function systemContinuesDespiteOutage(operationalOutageCount: number, admittedCount: number): boolean {
  return operationalOutageCount > 0 && admittedCount > 0;
}
