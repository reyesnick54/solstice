import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { availabilityCannotCreateOutput, availabilityIsNotProduction } from './availability.ts';
import { deriveWaterInterval, normalizeWaterVolume } from './meters.ts';
import { classifyWaterIndependence, profileFor } from './profiles.ts';
import { clusterWaterProductionObservations, identityRefsOf } from './production.ts';
import { qualityIsNotVolume } from './quality.ts';
import { evaluateWaterRights } from './rights.ts';
import { containsWaterCredentialLeak, waterSchemaDrift } from './schemas.ts';
import {
  IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION,
  REFERENCE_PRICE_CREATES_OUTPUT,
  WATER_FABRIC_SCHEMA_VERSION,
  WATER_PRODUCTION_ACTIVE,
  WATER_REAL_PROVIDER_CONTACTED,
  defaultWaterFabricPolicy,
  isWaterFactType,
  isWaterMeasurementSemantics,
  isWaterProductionSemantics,
  isWaterSourceClass,
  type NormalizedWaterObservation,
  type WaterFabricPolicy,
  type WaterLineageLink,
  type WaterProductionEvidenceRecord,
  type WaterQualityInputs,
  type WaterRefusal,
  type WaterSourceRecord,
} from './types.ts';

const INTEGER_RE = /^-?\d+$/;

export type WaterIngestResult = {
  readonly observation: NormalizedWaterObservation;
  readonly evidence: WaterProductionEvidenceRecord;
};

function refuse(code: WaterRefusal['code'], detail: string): Result<never, WaterRefusal> {
  return err({ code, detail });
}

function observationIdOf(record: WaterSourceRecord): string {
  return `wobs_${createHash('sha256')
    .update(
      [
        record.identifier,
        record.sourceClass,
        record.factType,
        record.numericValue,
        record.unit,
        record.sourceTimestampUnix,
        record.meterRef,
        record.identity.batchId ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;
}

function parseIntegerMantissa(numericValue: string): Result<bigint, WaterRefusal> {
  if (numericValue.includes('.') || numericValue.toLowerCase().includes('e')) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'floating-point water quantities are refused');
  }
  if (!INTEGER_RE.test(numericValue)) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'water quantities must be integer strings');
  }
  if (numericValue.startsWith('-')) {
    return refuse('NEGATIVE_WATER_PRODUCTION', 'negative water quantities are refused');
  }
  return ok(BigInt(numericValue));
}

function freshnessBps(record: WaterSourceRecord, nowUnix: bigint, maxAge: number): Result<number, WaterRefusal> {
  const sourceUnix = BigInt(record.sourceTimestampUnix);
  if (nowUnix < sourceUnix) {
    return ok(0);
  }
  const age = nowUnix - sourceUnix;
  if (age > BigInt(maxAge)) {
    return refuse('STALE_METER', 'water observation is older than the freshness policy');
  }
  const remaining = Number(BigInt(maxAge) - age);
  return ok(Math.min(10_000, Math.max(0, Math.floor((remaining * 10_000) / maxAge))));
}

function qualityInputsOf(record: WaterSourceRecord, independenceBps: number, freshness: number): WaterQualityInputs {
  return Object.freeze({
    meterCalibrationBps: 8_000,
    measurementFreshnessBps: freshness,
    batchIdentityPresent: Boolean(record.identity.batchId),
    sourceIndependenceBps: independenceBps,
    qualityAttestationBps: record.qualityEvidence ? 8_000 : 5_000,
  });
}

export function ingestWaterRecord(
  record: WaterSourceRecord,
  nowUnix: bigint,
  policy: WaterFabricPolicy = defaultWaterFabricPolicy(),
  related: readonly WaterSourceRecord[] = [],
): Result<WaterIngestResult, WaterRefusal> {
  if (policy.realNetworkCalls || policy.productionActive) {
    return refuse('PRODUCTION_ACTIVATION_FORBIDDEN', 'water fabric stays simulation-only');
  }
  if (!isWaterSourceClass(record.sourceClass)) {
    return refuse('UNKNOWN_SOURCE_CLASS', `unknown source class ${record.sourceClass}`);
  }
  if (containsWaterCredentialLeak(record.extras)) {
    return refuse('CREDENTIAL_LEAK', 'utility credentials and secrets must not be stored');
  }
  if (record.factType === 'REFERENCE_PRICE') {
    return refuse(
      'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
      'water commodity price uses REFERENCE_PRICE and cannot be ingested as water production',
    );
  }
  if (!isWaterMeasurementSemantics(record.measurementSemantics)) {
    return refuse('UNKNOWN_SEMANTICS', `unknown measurement semantics ${record.measurementSemantics}`);
  }
  if (waterSchemaDrift(record)) {
    return refuse(
      'SCHEMA_DRIFT',
      `schema ${record.schemaId}@${record.schemaVersion} does not match ${record.sourceClass}`,
    );
  }
  if (!record.geography.preciseLocationRedacted && !policy.allowPreciseLocations) {
    return refuse(
      'PROTECTED_LOCATION_REDACTION_REQUIRED',
      'water geography must not expose unnecessarily precise coordinates',
    );
  }

  const availabilityGate = availabilityCannotCreateOutput(record);
  if (!availabilityGate.ok) {
    return availabilityGate;
  }
  const qualityGate = qualityIsNotVolume(record);
  if (!qualityGate.ok) {
    return qualityGate;
  }

  const profile = profileFor(record.sourceClass);
  if (!isWaterFactType(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `water fabric does not ingest ${record.factType}`);
  }
  if (!profile.allowedFactTypes.includes(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `${record.sourceClass} cannot emit ${record.factType}`);
  }
  if (profile.createsAvailabilityEvidence && record.factType === 'WATER_PRODUCTION') {
    return refuse('WATER_AVAILABILITY_IS_NOT_PRODUCTION', `${record.sourceClass} reports availability, not production`);
  }
  if (profile.isIrrigationInput && record.measurementSemantics !== 'IRRIGATION_CONSUMPTION') {
    return refuse('IRRIGATION_IS_NOT_WATER_PRODUCTION', 'irrigation meters cannot emit water-production semantics');
  }
  if (record.measurementSemantics === 'IRRIGATION_CONSUMPTION' && !profile.isIrrigationInput) {
    return refuse(
      'IRRIGATION_IS_NOT_WATER_PRODUCTION',
      'irrigation consumption cannot be claimed as the utility water-production event',
    );
  }
  if (record.measurementSemantics === 'DISTRIBUTED_WATER') {
    return refuse('DISTRIBUTED_WATER_IS_NOT_PRODUCTION', 'distributed water is not treated/desalinated production');
  }
  if (record.unit === 'L_s' || record.unit === 'm3_s' || record.unit === 'm3_hour') {
    return refuse('VOLUME_TIME_IS_STORAGE', 'do not automatically convert water volume into volume-time');
  }

  const mantissa = parseIntegerMantissa(record.numericValue);
  if (!mantissa.ok) {
    return mantissa;
  }
  const interval = deriveWaterInterval(record, mantissa.value);
  if (!interval.ok) {
    return interval;
  }
  if (interval.value.kind === 'CUMULATIVE_REGISTER_ONLY' && record.meterSemantics === 'CUMULATIVE_REGISTER') {
    return refuse(
      'COUNTER_RESET_UNDOCUMENTED',
      'cumulative water register requires a prior valid reading to derive interval volume',
    );
  }

  const volume = normalizeWaterVolume({
    mantissa: interval.value.mantissa,
    unit: record.unit,
    factType: record.factType,
    targetUnit: record.unit === 'L' ? 'L' : 'm3',
  });
  if (!volume.ok) {
    return volume;
  }

  const rights = evaluateWaterRights(record, policy);
  if (!rights.ok) {
    return rights;
  }

  const independence = classifyWaterIndependence({
    sourceClass: record.sourceClass,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    sharedControlGroup: record.sharedControlGroup,
    related: related.map((row) => ({
      controllerId: row.controllerId,
      upstreamOrganizationId: row.upstreamOrganizationId,
      sharedControlGroup: row.sharedControlGroup,
    })),
  });
  if (related.length > 0 && independence !== 'INDEPENDENT_ORGANIZATION' && profile.mayBeIndependentOrganization) {
    return refuse(
      'SAME_CONTROLLER_FAKE_QUORUM',
      'same-controller utility/audit feeds are not independent quorum members',
    );
  }

  const freshness = freshnessBps(record, nowUnix, policy.maximumObservationAgeSeconds);
  if (!freshness.ok) {
    return freshness;
  }

  const isIrrigation = profile.isIrrigationInput || record.measurementSemantics === 'IRRIGATION_CONSUMPTION';
  const canCreateOutputClaim =
    record.factType === 'WATER_PRODUCTION' &&
    profile.createsWaterProductionEvent &&
    isWaterProductionSemantics(record.measurementSemantics) &&
    !isIrrigation;

  const observation: NormalizedWaterObservation = Object.freeze({
    schemaVersion: WATER_FABRIC_SCHEMA_VERSION,
    observationId: observationIdOf(record),
    sourceClass: record.sourceClass,
    factType: record.factType,
    sourceCategory: 'water',
    productiveCategory: 'WATER',
    proposedClaimType: canCreateOutputClaim
      ? 'OUTPUT'
      : record.factType === 'WATER_AVAILABILITY'
        ? 'CAPACITY'
        : isIrrigation
          ? 'USAGE'
          : null,
    measurementSemantics: record.measurementSemantics,
    meterSemantics: record.meterSemantics,
    sourceQuantity: volume.value.source,
    canonicalQuantity: volume.value.canonical,
    canonicalUnit: volume.value.unit,
    normalizationReceipt: volume.value.receipt,
    measurementStartUnix: record.measurementStartUnix === null ? null : BigInt(record.measurementStartUnix),
    measurementEndUnix: record.measurementEndUnix === null ? null : BigInt(record.measurementEndUnix),
    identityRefs: identityRefsOf(record),
    geography: record.geography,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    sharedControlGroup: record.sharedControlGroup,
    operatorPartyId: record.operatorPartyId,
    parties: record.parties,
    rightsReferences: rights.value,
    independenceClass: independence,
    qualityInputs: qualityInputsOf(
      record,
      independence === 'INDEPENDENT_ORGANIZATION' ? 10_000 : 0,
      freshness.value,
    ),
    qualityEvidence: record.qualityEvidence,
    createsWaterProductionEvent: canCreateOutputClaim,
    createsAvailabilityEvidence: profile.createsAvailabilityEvidence || record.factType === 'WATER_AVAILABILITY',
    isIrrigationInput: isIrrigation,
    isQualityOnly: profile.isQualityOnly,
    canCreateOutputClaim,
    canMintMoonRey: false,
    legalOwnershipInferred: false,
    productionActive: false,
  });

  const availability = availabilityIsNotProduction(observation);
  if (!availability.ok) {
    return availability;
  }

  const evidence: WaterProductionEvidenceRecord = Object.freeze({
    schemaVersion: WATER_FABRIC_SCHEMA_VERSION,
    fabricPolicyVersion: policy.policyVersion,
    observation,
    eventId: null,
    claimType: observation.proposedClaimType,
    automaticIssuance: false,
    verified: false,
    issued: false,
    certificationAuthorizesMoonRey: false,
    realProviderContacted: WATER_REAL_PROVIDER_CONTACTED,
    productionActive: WATER_PRODUCTION_ACTIVE,
  });
  return ok(Object.freeze({ observation, evidence }));
}

export function ingestWaterRecords(
  records: readonly WaterSourceRecord[],
  nowUnix: bigint,
  policy: WaterFabricPolicy = defaultWaterFabricPolicy(),
): Result<readonly WaterIngestResult[], WaterRefusal> {
  const accepted: WaterIngestResult[] = [];
  for (const record of records) {
    const ingested = ingestWaterRecord(record, nowUnix, policy, records.filter((row) => row !== record));
    if (!ingested.ok) {
      return ingested;
    }
    accepted.push(ingested.value);
  }
  return ok(Object.freeze(accepted));
}

export function identifyWaterProductionEvents(
  observations: readonly NormalizedWaterObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
) {
  return clusterWaterProductionObservations(observations, measurementStartUnix, measurementEndUnix);
}

export function linkWaterProductionToIrrigation(input: {
  readonly production: NormalizedWaterObservation;
  readonly irrigation: NormalizedWaterObservation;
}): Result<WaterLineageLink, WaterRefusal> {
  if (!input.production.createsWaterProductionEvent) {
    return refuse('WRONG_FACT_TYPE', 'irrigation lineage requires an underlying water-production observation');
  }
  if (!input.irrigation.isIrrigationInput) {
    return refuse('IRRIGATION_IS_NOT_WATER_PRODUCTION', 'irrigation lineage requires irrigation consumption evidence');
  }
  return ok(
    Object.freeze({
      fromObservationId: input.production.observationId,
      toObservationId: input.irrigation.observationId,
      relation: 'INPUT_TO',
      impliesDuplicateValue: false,
    }),
  );
}

export function evaluateWaterClaimPath(input: {
  readonly factType: string;
  readonly claimType: string | null;
  readonly sourceCategory?: string;
}): Result<{ readonly allowed: boolean; readonly canMint: false }, WaterRefusal> {
  if (input.factType === 'REFERENCE_PRICE' || input.sourceCategory === 'reference_price') {
    return refuse('REFERENCE_PRICE_CANNOT_CREATE_CLAIM', 'REFERENCE_PRICE cannot create a productive claim or OUTPUT');
  }
  if (input.factType === 'WATER_AVAILABILITY' && input.claimType === 'OUTPUT') {
    return refuse('AVAILABILITY_CANNOT_CREATE_OUTPUT', 'WATER_AVAILABILITY cannot create OUTPUT');
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory ?? (input.factType === 'WATER_AVAILABILITY' ? 'water' : 'water'),
    factType: input.factType,
    sourceUnit: 'm3',
    productiveCategory: 'WATER',
    claimType: input.claimType,
  });
  if (!mapped.ok) {
    if (mapped.error.code === 'CLAIM_TYPE_NOT_ALLOWED') {
      return refuse(
        input.factType === 'WATER_AVAILABILITY' ? 'AVAILABILITY_CANNOT_CREATE_OUTPUT' : 'WRONG_FACT_TYPE',
        mapped.error.detail,
      );
    }
    return refuse(
      mapped.error.code === 'REFERENCE_DATA_CANNOT_CREATE_CLAIM'
        ? 'REFERENCE_PRICE_CANNOT_CREATE_CLAIM'
        : 'WRONG_FACT_TYPE',
      mapped.error.detail,
    );
  }
  return ok(Object.freeze({ allowed: true, canMint: false as const }));
}

export function irrigationConsumptionEqualsWaterProduction(): false {
  return IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION;
}

export function referencePriceCreatesOutput(): false {
  return REFERENCE_PRICE_CREATES_OUTPUT;
}
