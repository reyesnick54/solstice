/**
 * Read-only Travel Agent evidence exposure.
 */

import type { TravelPlanningContext } from './types.ts';

export const TRAVEL_OBSERVATION_EVIDENCE_KIND = 'travel.observation.reference' as const;

export type TravelAgentEvidenceRef = {
  readonly kind: typeof TRAVEL_OBSERVATION_EVIDENCE_KIND;
  readonly destination: string;
  readonly hasEntryRequirements: boolean;
  readonly hasAirport: boolean;
  readonly hasEnvironmentalContext: boolean;
  readonly retrievedAt: string;
  readonly grantsExecutionAuthority: false;
  readonly grantsBookingAuthority: false;
  readonly referenceOnly: true;
};

export function toTravelAgentEvidence(context: TravelPlanningContext): TravelAgentEvidenceRef {
  return Object.freeze({
    kind: TRAVEL_OBSERVATION_EVIDENCE_KIND,
    destination: context.destination,
    hasEntryRequirements: context.entryRequirements.length > 0,
    hasAirport: context.destinationAirport !== null,
    hasEnvironmentalContext: context.environmentalContext !== null,
    retrievedAt: context.entryRequirements[0]?.retrievedAt ?? new Date().toISOString(),
    grantsExecutionAuthority: false,
    grantsBookingAuthority: false,
    referenceOnly: true,
  });
}
