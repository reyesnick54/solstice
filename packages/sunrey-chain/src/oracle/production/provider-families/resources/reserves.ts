import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { ClaimType } from '../../../../productive/types.ts';
import {
  RESERVE_EQUALS_EXTRACTION,
  type NormalizedResourceObservation,
  type ReserveEngineeringClass,
  type ResourceFabricPolicy,
  type ResourceRefusal,
  type ResourceSourceRecord,
} from './types.ts';

export type ReserveEstimateRecord = {
  readonly observationId: string;
  readonly engineeringClass: ReserveEngineeringClass;
  readonly methodologyReference: string;
  readonly attestationReference: string | null;
  readonly sourceOrganization: string | null;
  readonly effectiveDateUnix: bigint;
  readonly legalOrGeologicalCertificationInferred: false;
  readonly provesExtraction: false;
  readonly createsOutput: false;
  readonly moonReyEligible: false;
};

/**
 * A reserve estimate does not prove extraction, create OUTPUT, or
 * become MoonRey eligible. Existing RESERVE claim restrictions stay.
 */
export function materializeReserveEstimate(
  observation: NormalizedResourceObservation,
  record: ResourceSourceRecord,
): Result<ReserveEstimateRecord, ResourceRefusal> {
  if (observation.factType !== 'RESOURCE_RESERVE') {
    return err({
      code: 'WRONG_FACT_TYPE',
      detail: `reserve materialization requires RESOURCE_RESERVE, received ${observation.factType}`,
    });
  }
  if (observation.createsExtractionEvent || observation.canCreateOutputClaim) {
    return err({
      code: 'RESERVE_IS_NOT_EXTRACTION',
      detail: 'a reserve estimate cannot be treated as realized extraction',
    });
  }
  return ok(
    Object.freeze({
      observationId: observation.observationId,
      engineeringClass: record.reserveEngineeringClass ?? 'UNCLASSIFIED_ESTIMATE',
      methodologyReference: record.methodologyReference ?? 'unspecified.engineering.methodology',
      attestationReference: record.attestationReference,
      sourceOrganization: record.sourceOrganization,
      effectiveDateUnix: record.effectiveDateUnix ?? 0n,
      legalOrGeologicalCertificationInferred: false,
      provesExtraction: false,
      createsOutput: false,
      moonReyEligible: false,
    }),
  );
}

export function reserveCannotCreateOutput(claimType: ClaimType | null): Result<true, ResourceRefusal> {
  if (claimType === 'OUTPUT') {
    return err({
      code: 'RESERVE_CANNOT_CREATE_OUTPUT',
      detail: 'RESOURCE_RESERVE may only support a RESERVE claim; OUTPUT is refused',
    });
  }
  return ok(true);
}

/**
 * Geological reserve estimates can change for reasons beyond extraction.
 * Automatic `reserve - every extraction event` is forbidden unless the
 * reserve methodology explicitly supports that reconciliation.
 */
export function applyExtractionToReserve(input: {
  readonly policy: ResourceFabricPolicy;
  readonly reserveGrams: bigint;
  readonly extractionGrams: bigint;
}): Result<never, ResourceRefusal> | Result<{ readonly remainingGrams: bigint }, ResourceRefusal> {
  if (!input.policy.reserveMethodologySupportsExtractionReconciliation) {
    return err({
      code: 'AUTOMATIC_RESERVE_DEPLETION_FORBIDDEN',
      detail: 'reserve methodology does not support automatic extraction depletion',
    });
  }
  return ok(Object.freeze({ remainingGrams: input.reserveGrams - input.extractionGrams }));
}

export function reserveEqualsExtraction(): false {
  return RESERVE_EQUALS_EXTRACTION;
}

export function evaluateStaleReserve(input: {
  readonly nowUnix: bigint;
  readonly effectiveDateUnix: bigint | null;
  readonly policy: ResourceFabricPolicy;
}): Result<true, ResourceRefusal> {
  if (input.effectiveDateUnix === null) {
    return err({
      code: 'STALE_SURVEY',
      detail: 'reserve reference is missing an effective date',
    });
  }
  if (input.nowUnix < input.effectiveDateUnix) {
    return err({
      code: 'STALE_SURVEY',
      detail: 'reserve effective date is in the future relative to observation time',
    });
  }
  const age = input.nowUnix - input.effectiveDateUnix;
  if (age > BigInt(input.policy.maximumReserveAgeSeconds)) {
    return err({
      code: 'STALE_SURVEY',
      detail: `reserve reference age ${age.toString()}s exceeds ${input.policy.maximumReserveAgeSeconds}s`,
    });
  }
  return ok(true);
}
