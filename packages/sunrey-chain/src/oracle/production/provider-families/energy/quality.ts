/**
 * Energy-specific engineering quality checks.
 *
 * The source provider cannot select its own final quality factor.
 */

import { twoEndpointsOneUpstreamAreNotAutomaticallyIndependent } from '../../independence.ts';
import { scoreQuality } from '../../quality.ts';
import type { EnergyObservationInput, EnergyQualityReport, EnergyTimeWindow } from './types.ts';

export function evaluateEnergyQuality(input: {
  readonly observation: EnergyObservationInput;
  readonly time: EnergyTimeWindow;
  readonly schemaValid: boolean;
  readonly related?: readonly EnergyObservationInput[];
}): EnergyQualityReport {
  const related = input.related ?? input.observation.relatedObservations ?? [];
  const independence = evaluateIndependence(input.observation, related);
  const continuityOk = input.observation.meterSemantics !== 'CUMULATIVE_REGISTER' || input.observation.prior !== null;
  const missingIntervals = input.observation.meterSemantics === 'INTERVAL_ENERGY' && relatedHasGap(input.observation, related);
  const timestampRegular = input.time.measurementEndUnix > input.time.measurementStartUnix;
  const calibrationReferenced = Boolean(input.observation.calibrationRecordRef || input.observation.deviceProvenance?.calibrationRecord);
  const sourceFresh = input.time.collectionTimestampUnix - input.time.sourceTimestampUnix <= 3_600n;
  const conflict = related.some((row) => row.sourceObservationId === input.observation.sourceObservationId && row.quantity !== input.observation.quantity);
  const scored = scoreQuality({
    sourceId: input.observation.meterRef,
    freshnessBps: sourceFresh ? 10_000 : 2_000,
    availabilityBps: 9_000,
    historicalConflictRateBps: conflict ? 8_000 : 0,
    schemaValidityBps: input.schemaValid ? 10_000 : 0,
    sourceIndependenceBps: independence ? 10_000 : 0,
    attestationLevelBps: input.observation.deviceProvenance?.hardwareAttestation ? 8_000 : 2_000,
    qualityClass: 'ENGINEERING',
  });
  return Object.freeze({
    formulaVersion: 'energy.quality.profile.v1',
    engineeringGoverned: true,
    providerSelectedQuality: false,
    schemaValid: input.schemaValid,
    continuityOk,
    missingIntervals,
    timestampRegular,
    calibrationReferenced,
    sourceFresh,
    sourceIndependent: independence,
    observationConflict: conflict,
    scoreBps: scored.scoreBps,
    details: Object.freeze([
      independence ? 'independent controller' : 'shared controller or upstream',
      sourceFresh ? 'fresh' : 'stale-adjacent',
      calibrationReferenced ? 'calibration referenced' : 'calibration absent',
    ]),
  });
}

export function evaluateIndependence(primary: EnergyObservationInput, related: readonly EnergyObservationInput[]): boolean {
  if (related.length === 0) {
    return true;
  }
  return related.every((row) =>
    twoEndpointsOneUpstreamAreNotAutomaticallyIndependent(
      {
        schemaVersion: 1,
        sourceId: primary.meterRef,
        controllerId: primary.independence.controllerId,
        upstreamOrganizationId: primary.independence.upstreamOrganizationId,
        infrastructureRegion: primary.geography.region,
        sharedControlGroup: primary.independence.sharedControlGroup,
      },
      {
        schemaVersion: 1,
        sourceId: row.meterRef,
        controllerId: row.independence.controllerId,
        upstreamOrganizationId: row.independence.upstreamOrganizationId,
        infrastructureRegion: row.geography.region,
        sharedControlGroup: row.independence.sharedControlGroup,
      },
      true,
    ),
  );
}

export function sameControllerFakeQuorum(primary: EnergyObservationInput, related: readonly EnergyObservationInput[]): boolean {
  return related.some(
    (row) =>
      row.independence.controllerId === primary.independence.controllerId ||
      row.independence.upstreamOrganizationId === primary.independence.upstreamOrganizationId ||
      (row.independence.sharedControlGroup !== null &&
        row.independence.sharedControlGroup === primary.independence.sharedControlGroup),
  );
}

function relatedHasGap(primary: EnergyObservationInput, related: readonly EnergyObservationInput[]): boolean {
  return related.some((row) => row.meterRef === primary.meterRef && row.schemaId !== primary.schemaId);
}
