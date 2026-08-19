import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { createProductiveEconomicEvent, identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import { capacityCannotBecomeUsage } from './capacity.ts';
import { classifyRealEstateIndependence, profileFor } from './profiles.ts';
import { refusePersonLevelData } from './privacy.ts';
import { evaluateUseRights } from './rights.ts';
import { realEstateSchemaDrift } from './schemas.ts';
import {
  CAPACITY_CANNOT_AUTOMATICALLY_PRODUCE_GPUV,
  REAL_ESTATE_FABRIC_SCHEMA_VERSION,
  REAL_ESTATE_PRODUCTION_ACTIVE,
  REAL_ESTATE_REAL_PROVIDER_CONTACTED,
  defaultRealEstateFabricPolicy,
  isRealEstateFactType,
  isRealEstateSourceClass,
  isRealEstateUsageState,
  isRealizedUsageState,
  type NormalizedRealEstateObservation,
  type RealEstateEvidenceRecord,
  type RealEstateFabricPolicy,
  type RealEstateIdentityRefs,
  type RealEstateRefusal,
  type RealEstateSourceRecord,
} from './types.ts';
import { deriveAreaTime, parseIntegerMantissa } from './usage.ts';

export type RealEstateIngestResult = {
  readonly observation: NormalizedRealEstateObservation;
  readonly evidence: RealEstateEvidenceRecord;
};

function refuse(code: RealEstateRefusal['code'], detail: string): Result<never, RealEstateRefusal> {
  return err({ code, detail });
}

function observationIdOf(record: RealEstateSourceRecord): string {
  return `reobs_${createHash('sha256')
    .update(
      [
        record.identifier,
        record.sourceClass,
        record.factType,
        record.areaMantissa,
        record.measurementStartUnix,
        record.measurementEndUnix,
        record.identity.spaceId,
        record.identity.propertyId,
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;
}

function identityRefsOf(record: RealEstateSourceRecord): RealEstateIdentityRefs {
  return Object.freeze({
    spaceRef: identityRef('space', record.identity.spaceId),
    propertyRef: identityRef('property', record.identity.propertyId),
    facilityRef: record.identity.facilityId ? identityRef('facility', record.identity.facilityId) : null,
    rightsRef: record.rightsReferences[0]
      ? identityRef('right', record.rightsReferences[0].referenceId)
      : null,
  });
}

export function ingestRealEstateRecord(
  record: RealEstateSourceRecord,
  nowUnix: bigint,
  policy: RealEstateFabricPolicy = defaultRealEstateFabricPolicy(),
  related: readonly RealEstateSourceRecord[] = [],
): Result<RealEstateIngestResult, RealEstateRefusal> {
  if (policy.realNetworkCalls || policy.productionActive) {
    return refuse('PRODUCTION_ACTIVATION_FORBIDDEN', 'real-estate fabric stays simulation-only');
  }
  if (!isRealEstateSourceClass(record.sourceClass)) {
    return refuse('UNKNOWN_SOURCE_CLASS', `unknown source class ${record.sourceClass}`);
  }
  if (!isRealEstateUsageState(record.usageState)) {
    return refuse('UNKNOWN_USAGE_STATE', `unknown usage state ${record.usageState}`);
  }
  if (record.factType === 'ENERGY_PRODUCTION' || record.factType === 'WATER_PRODUCTION') {
    return refuse(
      record.factType === 'ENERGY_PRODUCTION' ? 'ENERGY_INPUT_CLAIMED_AS_OUTPUT' : 'WATER_INPUT_CLAIMED_AS_OUTPUT',
      'building operators cannot claim upstream energy or water production',
    );
  }
  if (!isRealEstateFactType(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `real-estate fabric does not ingest ${record.factType}`);
  }
  if (realEstateSchemaDrift(record)) {
    return refuse('SCHEMA_DRIFT', `schema ${record.schemaId}@${record.schemaVersion} does not match ${record.sourceClass}`);
  }
  const privacy = refusePersonLevelData(record);
  if (!privacy.ok) {
    return privacy;
  }
  if (!record.identity.spaceId) {
    return refuse('MISSING_SPACE_REF', 'realized space-use evidence requires spaceRef');
  }
  if (!record.identity.propertyId) {
    return refuse('MISSING_PROPERTY_REF', 'realized space-use evidence requires propertyRef');
  }
  const start = parseIntegerMantissa(record.measurementStartUnix, 'FLOAT_DURATION_FORBIDDEN');
  const end = parseIntegerMantissa(record.measurementEndUnix, 'FLOAT_DURATION_FORBIDDEN');
  if (!start.ok) {
    return start;
  }
  if (!end.ok) {
    return end;
  }
  if (end.value <= start.value) {
    return refuse('MISSING_MEASUREMENT_WINDOW', 'measurement end must be after start');
  }
  const observedAt = parseIntegerMantissa(record.sourceTimestampUnix);
  if (!observedAt.ok) {
    return observedAt;
  }
  if (nowUnix - observedAt.value > BigInt(policy.maximumObservationAgeSeconds)) {
    return refuse('STALE_UTILIZATION', 'utilization evidence is older than the governed freshness window');
  }
  const durationSeconds = end.value - start.value;
  const area = parseIntegerMantissa(record.areaMantissa);
  if (!area.ok) {
    return area;
  }
  const profile = profileFor(record.sourceClass);
  if (!profile.allowedFactTypes.includes(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `${record.sourceClass} cannot emit ${record.factType}`);
  }
  const capacityGate = capacityCannotBecomeUsage(record);
  if (!capacityGate.ok) {
    return capacityGate;
  }
  const rights = evaluateUseRights(record, policy);
  if (!rights.ok) {
    return rights;
  }

  const independence = classifyRealEstateIndependence({
    sourceClass: record.sourceClass,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    related: related.map((row) => ({
      controllerId: row.controllerId,
      upstreamOrganizationId: row.upstreamOrganizationId,
    })),
  });
  if (
    related.length > 0 &&
    independence !== 'INDEPENDENT_ORGANIZATION' &&
    related.some((row) => row.controllerId === record.controllerId) &&
    profile.mayBeIndependentOrganization
  ) {
    return refuse(
      'SAME_CONTROLLER_FAKE_QUORUM',
      'building management, booking, and access-control endpoints under one controller are not independent quorum',
    );
  }

  const createsUsageEvent = record.factType === 'REAL_ESTATE_USAGE' && isRealizedUsageState(record.usageState);
  const createsCapacityReference = record.factType === 'REAL_ESTATE_USE_CAPACITY';
  let sourceQuantity;
  let canonicalQuantity;
  let canonicalUnit: NormalizedRealEstateObservation['canonicalUnit'];
  if (createsUsageEvent) {
    if (record.unit === 'm2') {
      return refuse('M2_WITHOUT_DURATION', 'm2 without a derived duration cannot be stored as usage');
    }
    if (record.unit !== 'm2_hour') {
      return refuse('WRONG_UNIT', `realized usage must use m2_hour, not ${record.unit}`);
    }
    const derived = deriveAreaTime({ areaMantissa: area.value, durationSeconds });
    if (!derived.ok) {
      return derived;
    }
    const reported = parseIntegerMantissa(record.numericValue);
    if (!reported.ok) {
      return reported;
    }
    if (derived.value.mantissa !== reported.value || derived.value.denominator !== 1n) {
      return refuse(
        'AREA_TIME_DERIVATION_INEXACT',
        `reported ${record.numericValue} m2_hour does not equal ${area.value} m2 × ${durationSeconds}s`,
      );
    }
    sourceQuantity = derived.value;
    canonicalQuantity = derived.value;
    canonicalUnit = 'm2_hour';
  } else {
    if (record.unit !== 'm2') {
      return refuse('WRONG_UNIT', 'capacity remains m2 and is not area-time');
    }
    const quantity = exactQuantity({ mantissa: area.value, unitId: 'm2' });
    if (!quantity.ok) {
      return refuse('INCOMPATIBLE_UNIT', quantity.error.detail);
    }
    sourceQuantity = quantity.value;
    canonicalQuantity = quantity.value;
    canonicalUnit = 'm2';
  }

  const observation: NormalizedRealEstateObservation = Object.freeze({
    schemaVersion: REAL_ESTATE_FABRIC_SCHEMA_VERSION,
    observationId: observationIdOf(record),
    sourceClass: record.sourceClass,
    factType: record.factType,
    sourceCategory: 'real_estate_use',
    productiveCategory: 'REAL_ESTATE_USE',
    proposedClaimType: createsUsageEvent ? 'USAGE' : 'CAPACITY',
    usageState: record.usageState,
    sourceQuantity,
    canonicalQuantity,
    canonicalUnit,
    areaMantissa: area.value,
    durationSeconds,
    identityRefs: identityRefsOf(record),
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    operatorPartyId: record.operatorPartyId,
    parties: record.parties,
    rightsReferences: rights.value,
    independenceClass: independence,
    createsUsageEvent,
    createsCapacityReference,
    canCreateUsageClaim: createsUsageEvent,
    canMintMoonRey: false,
    canAutomaticallyProduceGpuv: CAPACITY_CANNOT_AUTOMATICALLY_PRODUCE_GPUV,
    legalOwnershipInferred: false,
    productionActive: false,
  });

  const evidence: RealEstateEvidenceRecord = Object.freeze({
    schemaVersion: REAL_ESTATE_FABRIC_SCHEMA_VERSION,
    fabricPolicyVersion: policy.policyVersion,
    observation,
    eventId: null,
    claimType: observation.proposedClaimType,
    automaticIssuance: false,
    verified: false,
    issued: false,
    certificationAuthorizesMoonRey: false,
    realProviderContacted: REAL_ESTATE_REAL_PROVIDER_CONTACTED,
    productionActive: REAL_ESTATE_PRODUCTION_ACTIVE,
  });
  return ok(Object.freeze({ observation, evidence }));
}

export function ingestRealEstateRecords(
  records: readonly RealEstateSourceRecord[],
  nowUnix: bigint,
  policy: RealEstateFabricPolicy = defaultRealEstateFabricPolicy(),
): Result<readonly RealEstateIngestResult[], RealEstateRefusal> {
  const accepted: RealEstateIngestResult[] = [];
  for (const record of records) {
    const ingested = ingestRealEstateRecord(record, nowUnix, policy, records.filter((row) => row !== record));
    if (!ingested.ok) {
      return ingested;
    }
    accepted.push(ingested.value);
  }
  return ok(Object.freeze(accepted));
}

export function identifySpaceUseEvents(
  observations: readonly NormalizedRealEstateObservation[],
): Result<readonly ProductiveEconomicEvent[], RealEstateRefusal> {
  const usage = observations.filter((row) => row.createsUsageEvent);
  const grouped = new Map<string, NormalizedRealEstateObservation[]>();
  for (const observation of usage) {
    const key = `${observation.identityRefs.spaceRef}|${observation.identityRefs.propertyRef}|${observation.durationSeconds}`;
    const rows = grouped.get(key) ?? [];
    rows.push(observation);
    grouped.set(key, rows);
  }
  const events: ProductiveEconomicEvent[] = [];
  for (const rows of grouped.values()) {
    const first = rows[0];
    if (!first) {
      continue;
    }
    const start = 1_700_000_000n;
    const end = start + first.durationSeconds;
    events.push(
      createProductiveEconomicEvent({
        eventClass: 'INFRASTRUCTURE_SERVICE_EVENT',
        evidence: {
          transformationRef: first.identityRefs.spaceRef,
          alternateViewGroupRef: first.identityRefs.spaceRef,
          physicalObjectRefs: Object.freeze([first.identityRefs.propertyRef, first.identityRefs.spaceRef]),
          sourceObjectRefs: Object.freeze([first.identityRefs.propertyRef]),
          inputLotRefs: Object.freeze([]),
          outputLotRefs: Object.freeze([]),
          serialAssetRefs: Object.freeze([]),
          measurementPeriod: Object.freeze({
            validFromUnixSeconds: start,
            validUntilUnixSeconds: end,
            epoch: 1,
          }),
          deliveryPeriod: Object.freeze({
            fromUnixSeconds: start,
            untilUnixSeconds: end,
          }),
          geographyId: first.identityRefs.propertyRef,
          jurisdiction: 'SIM',
          oracleFactRefs: Object.freeze(rows.map((row) => identityRef('obs', row.observationId))),
          sourceProvenanceRefs: Object.freeze([identityRef('src', first.sourceClass)]),
          upstreamEventRefs: Object.freeze([]),
          downstreamEventRefs: Object.freeze([]),
          canonicalMeasurementRefs: Object.freeze([
            identityRef('area-time', `${first.canonicalQuantity.mantissa.toString()}:${first.canonicalUnit}`),
          ]),
          controllerRefs: Object.freeze([identityRef('ctl', first.controllerId)]),
          participantRefs: Object.freeze(first.parties.map((party) => identityRef('party', party.partyId))),
          sourceSystemRefs: Object.freeze([identityRef('sys', first.sourceClass)]),
          lineageRoot: first.identityRefs.spaceRef,
          economicTransformationRef: first.identityRefs.spaceRef,
        },
      }),
    );
  }
  return ok(Object.freeze(events));
}

export function refuseDuplicateBuildingUsage(
  events: readonly ProductiveEconomicEvent[],
  observationCount: number,
): Result<true, RealEstateRefusal> {
  if (events.length === 1 && observationCount > 1) {
    return refuse('DUPLICATE_BUILDING_USAGE', 'booking and access-control views of one occupancy are one event');
  }
  return ok(true);
}

export function evaluateRealEstateClaimPath(input: {
  readonly factType: string;
  readonly claimType: string;
  readonly sourceCategory?: string;
}): Result<{ readonly compatible: true }, RealEstateRefusal> {
  if (input.factType === 'REAL_ESTATE_USE_CAPACITY' && input.claimType === 'USAGE') {
    return refuse('CAPACITY_IS_NOT_USAGE', 'historical capacity records are not reinterpreted as usage');
  }
  if (input.factType === 'REAL_ESTATE_USE_CAPACITY' && input.claimType === 'OUTPUT') {
    return refuse('CAPACITY_CANNOT_PRODUCE_GPUV', 'capacity cannot automatically produce GPUV');
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: (input.sourceCategory ?? 'real_estate_use') as 'real_estate_use',
    factType: input.factType as 'REAL_ESTATE_USAGE',
    sourceUnit: input.factType === 'REAL_ESTATE_USAGE' ? 'm2_hour' : 'm2',
    claimType: input.claimType as 'USAGE',
  });
  if (!mapped.ok) {
    return refuse('WRONG_FACT_TYPE', mapped.error.detail);
  }
  return ok(Object.freeze({ compatible: true as const }));
}
