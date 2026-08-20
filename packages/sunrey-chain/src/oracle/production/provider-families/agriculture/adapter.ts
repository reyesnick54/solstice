import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { clusterHarvestObservations, deriveHarvestInterval, identityRefsOf, normalizeHarvestMass } from './harvest.ts';
import { classifyAgricultureIndependence, profileFor } from './profiles.ts';
import { fixtureCertificationIsNotLegalProof, qualityIsNotMass } from './quality.ts';
import { evaluateHarvestRights } from './rights.ts';
import { agricultureSchemaDrift, containsAgricultureCredentialLeak } from './schemas.ts';
import {
  AGRICULTURE_FABRIC_SCHEMA_VERSION,
  AGRICULTURE_PRODUCTION_ACTIVE,
  AGRICULTURE_REAL_PROVIDER_CONTACTED,
  REFERENCE_PRICE_CREATES_OUTPUT,
  defaultAgricultureFabricPolicy,
  isAgricultureFactType,
  isAgricultureMeasurementSemantics,
  isAgricultureSourceClass,
  isRealizedHarvestSemantics,
  type AgricultureFabricPolicy,
  type AgricultureHarvestEvidenceRecord,
  type AgricultureQualityInputs,
  type AgricultureRefusal,
  type AgricultureSourceRecord,
  type NormalizedAgricultureObservation,
} from './types.ts';

const INTEGER_RE = /^-?\d+$/;

export type AgricultureIngestResult = {
  readonly observation: NormalizedAgricultureObservation;
  readonly evidence: AgricultureHarvestEvidenceRecord;
};

function refuse(code: AgricultureRefusal['code'], detail: string): Result<never, AgricultureRefusal> {
  return err({ code, detail });
}

function observationIdOf(record: AgricultureSourceRecord): string {
  return `aobs_${createHash('sha256')
    .update(
      [
        record.identifier,
        record.sourceClass,
        record.factType,
        record.numericValue,
        record.unit,
        record.sourceTimestampUnix,
        record.identity.harvestBatchId ?? '',
        record.identity.lotId ?? '',
        record.identity.cropCycleId ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;
}

function parseIntegerMantissa(numericValue: string): Result<bigint, AgricultureRefusal> {
  if (numericValue.includes('.') || numericValue.toLowerCase().includes('e')) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'floating-point agricultural quantities are refused');
  }
  if (!INTEGER_RE.test(numericValue)) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'agricultural quantities must be integer strings');
  }
  if (numericValue.startsWith('-')) {
    return refuse('NEGATIVE_HARVEST', 'negative harvest quantities are refused');
  }
  return ok(BigInt(numericValue));
}

function freshnessBps(record: AgricultureSourceRecord, nowUnix: bigint, maxAge: number): Result<number, AgricultureRefusal> {
  const sourceUnix = BigInt(record.sourceTimestampUnix);
  if (nowUnix < sourceUnix) {
    return ok(0);
  }
  const age = nowUnix - sourceUnix;
  if (age > BigInt(maxAge)) {
    return refuse('STALE_METER', 'agricultural observation is older than the freshness policy');
  }
  const remaining = Number(BigInt(maxAge) - age);
  return ok(Math.min(10_000, Math.max(0, Math.floor((remaining * 10_000) / maxAge))));
}

function qualityInputsOf(
  record: AgricultureSourceRecord,
  independenceBps: number,
  freshness: number,
): AgricultureQualityInputs {
  return Object.freeze({
    scaleCalibrationBps: record.sourceClass === 'GRAIN_SCALE' ? 9_000 : 7_000,
    measurementFreshnessBps: freshness,
    batchIdentityPresent: Boolean(record.identity.harvestBatchId || record.identity.lotId),
    sourceIndependenceBps: independenceBps,
    qualityAttestationBps: record.qualityEvidence ? 8_000 : 5_000,
  });
}

export function ingestAgricultureRecord(
  record: AgricultureSourceRecord,
  nowUnix: bigint,
  policy: AgricultureFabricPolicy = defaultAgricultureFabricPolicy(),
  related: readonly AgricultureSourceRecord[] = [],
): Result<AgricultureIngestResult, AgricultureRefusal> {
  if (policy.realNetworkCalls || policy.productionActive) {
    return refuse('PRODUCTION_ACTIVATION_FORBIDDEN', 'agriculture fabric stays simulation-only');
  }
  if (!isAgricultureSourceClass(record.sourceClass)) {
    return refuse('UNKNOWN_SOURCE_CLASS', `unknown source class ${record.sourceClass}`);
  }
  if (containsAgricultureCredentialLeak(record.extras)) {
    return refuse('CREDENTIAL_LEAK', 'farm credentials and secrets must not be stored');
  }
  if (record.factType === 'REFERENCE_PRICE') {
    return refuse(
      'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
      'agricultural commodity price uses REFERENCE_PRICE and cannot be ingested as harvest output',
    );
  }
  if (!isAgricultureMeasurementSemantics(record.measurementSemantics)) {
    return refuse('UNKNOWN_SEMANTICS', `unknown measurement semantics ${record.measurementSemantics}`);
  }
  if (agricultureSchemaDrift(record)) {
    return refuse(
      'SCHEMA_DRIFT',
      `schema ${record.schemaId}@${record.schemaVersion} does not match ${record.sourceClass}`,
    );
  }
  if (!record.geography.preciseLocationRedacted && !policy.allowPreciseLocations) {
    return refuse(
      'PROTECTED_LOCATION_REDACTION_REQUIRED',
      'farm geography must not expose unnecessarily precise coordinates',
    );
  }
  if (record.weatherContext !== null && record.measurementSemantics === 'WEATHER_CONTEXT') {
    return refuse('WEATHER_IS_NOT_PRODUCTION', 'rainfall, temperature, and weather forecasts are not agricultural output');
  }
  if (record.measurementSemantics === 'WEATHER_CONTEXT') {
    return refuse('WEATHER_IS_NOT_PRODUCTION', 'weather remains reference context only');
  }
  if (record.measurementSemantics === 'PLANTED') {
    return refuse('PLANTED_IS_NOT_PRODUCTION', 'a planted crop is not production');
  }
  if (record.measurementSemantics === 'GROWING') {
    return refuse('GROWING_IS_NOT_PRODUCTION', 'a growing crop is not realized harvest output');
  }
  if (record.measurementSemantics === 'EXPECTED_YIELD') {
    return refuse(
      'FORECAST_YIELD_IS_NOT_PRODUCTION',
      'forecast / expected yield is reference evidence and cannot substitute for realized harvest',
    );
  }
  if (record.measurementSemantics === 'INVENTORY') {
    // inventory may ingest as evidence, not as harvest output — handled below
  }
  if (record.measurementSemantics === 'REJECTED_OUTPUT') {
    return refuse('REJECTED_OUTPUT_IS_NOT_ACCEPTED_PRODUCTION', 'rejected output is not accepted agricultural production');
  }
  if (record.measurementSemantics === 'WASTE') {
    return refuse('WASTE_IS_NOT_PRODUCTION', 'waste is not realized accepted output');
  }

  const qualityGate = qualityIsNotMass(record);
  if (!qualityGate.ok) {
    return qualityGate;
  }
  if (record.qualityEvidence) {
    const fixture = fixtureCertificationIsNotLegalProof(record.qualityEvidence);
    if (!fixture.ok) {
      return fixture;
    }
  }

  const profile = profileFor(record.sourceClass);
  if (!isAgricultureFactType(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `agriculture fabric does not ingest ${record.factType}`);
  }
  if (!profile.allowedFactTypes.includes(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `${record.sourceClass} cannot emit ${record.factType}`);
  }
  if (profile.createsInventoryEvidence && record.measurementSemantics !== 'INVENTORY') {
    return refuse('INVENTORY_IS_NOT_PRODUCTION', 'silo/inventory systems cannot emit harvest measurement semantics');
  }
  if (record.measurementSemantics === 'INVENTORY' && !profile.createsInventoryEvidence) {
    return refuse('INVENTORY_IS_NOT_PRODUCTION', 'inventory movement is not new agricultural production');
  }
  if (record.unit === 'm2') {
    return refuse(
      'AREA_IS_NOT_OUTPUT',
      'field area (m2) cannot become harvested mass without an independently observed output measurement',
    );
  }

  const mantissa = parseIntegerMantissa(record.numericValue);
  if (!mantissa.ok) {
    return mantissa;
  }
  const interval = deriveHarvestInterval(record, mantissa.value);
  if (!interval.ok) {
    return interval;
  }
  if (interval.value.kind === 'CUMULATIVE_REGISTER_ONLY' && record.meterSemantics === 'CUMULATIVE_REGISTER') {
    // A lone cumulative snapshot is not period production.
    return refuse(
      'COUNTER_RESET_UNDOCUMENTED',
      'cumulative harvest register requires a prior valid reading to derive interval output',
    );
  }

  const mass = normalizeHarvestMass({
    mantissa: interval.value.mantissa,
    unit: record.unit,
    factType: record.factType,
    targetUnit: record.unit === 'tonne' ? 'tonne' : 'kg',
  });
  if (!mass.ok) {
    return mass;
  }

  const rights = evaluateHarvestRights(record, {
    ...policy,
    requireHarvestRightsReference:
      policy.requireHarvestRightsReference &&
      profile.createsHarvestEvent &&
      isRealizedHarvestSemantics(record.measurementSemantics),
  });
  if (!rights.ok) {
    return rights;
  }

  const independence = classifyAgricultureIndependence({
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
  if (
    related.length > 0 &&
    independence !== 'INDEPENDENT_ORGANIZATION' &&
    profile.mayBeIndependentOrganization
  ) {
    return refuse(
      'SAME_CONTROLLER_FAKE_QUORUM',
      'same-controller farm/cooperative/regulatory feeds are not independent quorum members',
    );
  }

  const freshness = freshnessBps(record, nowUnix, policy.maximumObservationAgeSeconds);
  if (!freshness.ok) {
    return freshness;
  }

  const canCreateOutputClaim =
    record.measurementSemantics !== 'INVENTORY' &&
    record.measurementSemantics !== 'PROCESSED_FOOD' &&
    record.measurementSemantics !== 'QUALITY_GRADE' &&
    isRealizedHarvestSemantics(record.measurementSemantics) &&
    profile.createsHarvestEvent;

  const observation: NormalizedAgricultureObservation = Object.freeze({
    schemaVersion: AGRICULTURE_FABRIC_SCHEMA_VERSION,
    observationId: observationIdOf(record),
    sourceClass: record.sourceClass,
    factType: record.factType,
    sourceCategory: 'food_agriculture',
    productiveCategory: 'FOOD_AGRICULTURE',
    proposedClaimType: canCreateOutputClaim ? 'OUTPUT' : null,
    measurementSemantics: record.measurementSemantics,
    meterSemantics: record.meterSemantics,
    sourceQuantity: mass.value.source,
    canonicalQuantity: mass.value.canonical,
    canonicalUnit: mass.value.unit,
    normalizationReceipt: mass.value.receipt,
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
    createsHarvestEvent: profile.createsHarvestEvent && canCreateOutputClaim,
    createsInventoryEvidence: profile.createsInventoryEvidence || record.measurementSemantics === 'INVENTORY',
    isQualityOnly: profile.isQualityOnly || record.measurementSemantics === 'QUALITY_GRADE',
    canCreateOutputClaim,
    canMintMoonRey: false,
    legalOwnershipInferred: false,
    productionActive: false,
  });

  const evidence: AgricultureHarvestEvidenceRecord = Object.freeze({
    schemaVersion: AGRICULTURE_FABRIC_SCHEMA_VERSION,
    fabricPolicyVersion: policy.policyVersion,
    observation,
    eventId: null,
    claimType: observation.proposedClaimType,
    automaticIssuance: false,
    verified: false,
    issued: false,
    certificationAuthorizesMoonRey: false,
    realProviderContacted: AGRICULTURE_REAL_PROVIDER_CONTACTED,
    productionActive: AGRICULTURE_PRODUCTION_ACTIVE,
  });
  return ok(Object.freeze({ observation, evidence }));
}

export function ingestAgricultureRecords(
  records: readonly AgricultureSourceRecord[],
  nowUnix: bigint,
  policy: AgricultureFabricPolicy = defaultAgricultureFabricPolicy(),
): Result<readonly AgricultureIngestResult[], AgricultureRefusal> {
  const accepted: AgricultureIngestResult[] = [];
  for (const record of records) {
    const ingested = ingestAgricultureRecord(
      record,
      nowUnix,
      policy,
      records.filter((row) => row !== record),
    );
    if (!ingested.ok) {
      return ingested;
    }
    accepted.push(ingested.value);
  }
  return ok(Object.freeze(accepted));
}

export function identifyHarvestEvents(
  observations: readonly NormalizedAgricultureObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): Result<readonly import('../../../../productive/policy-governance/attribution/types.ts').ProductiveEconomicEvent[], AgricultureRefusal> {
  return clusterHarvestObservations(observations, measurementStartUnix, measurementEndUnix);
}

export function evaluateAgricultureClaimPath(input: {
  readonly factType: string;
  readonly claimType: string | null;
  readonly sourceCategory?: string;
}): Result<{ readonly allowed: boolean; readonly canMint: false }, AgricultureRefusal> {
  if (input.factType === 'REFERENCE_PRICE' || input.sourceCategory === 'reference_price') {
    return refuse(
      'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
      'REFERENCE_PRICE cannot create a productive claim or OUTPUT',
    );
  }
  if (input.factType === 'FOOD_PRODUCTION' && input.claimType === 'OUTPUT') {
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'food_agriculture',
      factType: 'FOOD_PRODUCTION',
      sourceUnit: 'kg',
      productiveCategory: 'FOOD_AGRICULTURE',
      claimType: 'OUTPUT',
    });
    if (!mapped.ok) {
      return refuse('WRONG_FACT_TYPE', mapped.error.detail);
    }
    return ok(Object.freeze({ allowed: true, canMint: false as const }));
  }
  if (input.factType === 'AGRICULTURAL_OUTPUT' && input.claimType === 'OUTPUT') {
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'food_agriculture',
      factType: 'AGRICULTURAL_OUTPUT',
      sourceUnit: 'kg',
      productiveCategory: 'FOOD_AGRICULTURE',
      claimType: 'OUTPUT',
    });
    if (!mapped.ok) {
      return refuse('WRONG_FACT_TYPE', mapped.error.detail);
    }
    return ok(Object.freeze({ allowed: true, canMint: false as const }));
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory ?? 'food_agriculture',
    factType: input.factType,
    sourceUnit: 'kg',
    productiveCategory: 'FOOD_AGRICULTURE',
    claimType: input.claimType,
  });
  if (!mapped.ok) {
    return refuse(
      mapped.error.code === 'REFERENCE_DATA_CANNOT_CREATE_CLAIM'
        ? 'REFERENCE_PRICE_CANNOT_CREATE_CLAIM'
        : 'WRONG_FACT_TYPE',
      mapped.error.detail,
    );
  }
  return ok(Object.freeze({ allowed: true, canMint: false as const }));
}

export function referencePriceCreatesOutput(): false {
  return REFERENCE_PRICE_CREATES_OUTPUT;
}
