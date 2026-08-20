import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { createProductiveEconomicEvent, identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import { assayIsNotMass } from './assay.ts';
import { clusterExtractionObservations, identityRefsOf } from './extraction.ts';
import { normalizeMassQuantity, refuseBlindMassSum } from './mass-balance.ts';
import { classifyResourceIndependence, profileFor } from './profiles.ts';
import { evaluateStaleReserve, reserveCannotCreateOutput } from './reserves.ts';
import { evaluateExtractionRights } from './rights.ts';
import { resourceSchemaDrift } from './schemas.ts';
import { stockpileMovementIsNotExtraction } from './stockpiles.ts';
import {
  FORBIDDEN_RESOURCE_FACT_TYPES,
  REFERENCE_PRICE_CREATES_OUTPUT,
  RESOURCE_FABRIC_SCHEMA_VERSION,
  RESOURCE_PRODUCTION_ACTIVE,
  RESOURCE_REAL_PROVIDER_CONTACTED,
  defaultResourceFabricPolicy,
  isResourceFactType,
  isResourceMeasurementSemantics,
  isResourceSourceClass,
  type NormalizedResourceObservation,
  type ResourceExtractionEvidenceRecord,
  type ResourceFabricPolicy,
  type ResourceLineageLink,
  type ResourceQualityInputs,
  type ResourceRefusal,
  type ResourceSourceRecord,
} from './types.ts';

const INTEGER_RE = /^-?\d+$/;

export type ResourceIngestResult = {
  readonly observation: NormalizedResourceObservation;
  readonly evidence: ResourceExtractionEvidenceRecord;
};

function refuse(code: ResourceRefusal['code'], detail: string): Result<never, ResourceRefusal> {
  return err({ code, detail });
}

function observationIdOf(record: ResourceSourceRecord): string {
  return `robs_${createHash('sha256')
    .update(
      [
        record.identifier,
        record.sourceClass,
        record.factType,
        record.numericValue,
        record.unit,
        record.sourceTimestampUnix,
        record.identity.haulBatchId ?? '',
        record.identity.weighbridgeTicketId ?? '',
        record.identity.rawMaterialLotId ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;
}

function parseIntegerMantissa(numericValue: string): Result<bigint, ResourceRefusal> {
  if (numericValue.includes('.') || numericValue.toLowerCase().includes('e')) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'floating-point resource quantities are refused');
  }
  if (!INTEGER_RE.test(numericValue)) {
    return refuse('FLOAT_QUANTITY_FORBIDDEN', 'resource quantities must be integer strings');
  }
  if (numericValue.startsWith('-')) {
    return refuse('NEGATIVE_EXTRACTION', 'negative extraction or reserve quantities are refused');
  }
  return ok(BigInt(numericValue));
}

function freshnessBps(record: ResourceSourceRecord, nowUnix: bigint, maxAge: number): number {
  const sourceUnix = BigInt(record.sourceTimestampUnix);
  if (nowUnix < sourceUnix) {
    return 0;
  }
  const age = nowUnix - sourceUnix;
  if (age > BigInt(maxAge)) {
    return 0;
  }
  const remaining = Number(BigInt(maxAge) - age);
  return Math.min(10_000, Math.max(0, Math.floor((remaining * 10_000) / maxAge)));
}

function qualityInputsOf(
  record: ResourceSourceRecord,
  independenceBps: number,
  nowUnix: bigint,
  policy: ResourceFabricPolicy,
): ResourceQualityInputs {
  return Object.freeze({
    scaleCalibrationBps: record.sourceClass === 'WEIGHBRIDGE' ? 9_000 : 7_000,
    assayProvenanceBps: record.assayEvidence ? 9_000 : 5_000,
    samplingMethodologyBps: record.assayEvidence?.samplingMethodologyReference ? 8_000 : 5_000,
    measurementFreshnessBps: freshnessBps(record, nowUnix, policy.maximumObservationAgeSeconds),
    batchIdentityPresent: Boolean(record.identity.rawMaterialLotId || record.identity.haulBatchId),
    sourceIndependenceBps: independenceBps,
    stockpileReconciliationBps: record.sourceClass === 'INVENTORY_STOCKPILE_SYSTEM' ? 8_000 : 7_000,
  });
}

export function ingestResourceRecord(
  record: ResourceSourceRecord,
  nowUnix: bigint,
  policy: ResourceFabricPolicy = defaultResourceFabricPolicy(),
  related: readonly ResourceSourceRecord[] = [],
): Result<ResourceIngestResult, ResourceRefusal> {
  if (policy.realNetworkCalls || policy.productionActive) {
    return refuse('PRODUCTION_ACTIVATION_FORBIDDEN', 'resource fabric stays simulation-only');
  }
  if (!isResourceSourceClass(record.sourceClass)) {
    return refuse('UNKNOWN_SOURCE_CLASS', `unknown source class ${record.sourceClass}`);
  }
  if ((FORBIDDEN_RESOURCE_FACT_TYPES as readonly string[]).includes(record.factType)) {
    return refuse(
      record.factType === 'RESOURCE_VALUE' ? 'RESOURCE_VALUE_FACT_FORBIDDEN' : 'MINERAL_VALUE_FACT_FORBIDDEN',
      `${record.factType} is not a canonical resource fact`,
    );
  }
  if (record.factType === 'REFERENCE_PRICE') {
    return refuse(
      'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
      'commodity/reference price uses REFERENCE_PRICE and cannot be ingested as resource extraction',
    );
  }
  if (!isResourceMeasurementSemantics(record.measurementSemantics)) {
    return refuse('UNKNOWN_SEMANTICS', `unknown measurement semantics ${record.measurementSemantics}`);
  }
  if (resourceSchemaDrift(record)) {
    return refuse(
      'SCHEMA_DRIFT',
      `schema ${record.schemaId}@${record.schemaVersion} does not match ${record.sourceClass}`,
    );
  }
  if (record.geography.protectedSite && !record.geography.preciseLocationRedacted && !policy.allowPreciseProtectedLocations) {
    return refuse(
      'PROTECTED_LOCATION_REDACTION_REQUIRED',
      'protected resource sites must not expose precise location',
    );
  }
  for (const environmental of record.environmentalEvidence) {
    if (environmental.valueMultiplier !== false || environmental.productiveValueBonusOrPenalty !== false) {
      return refuse(
        'ENVIRONMENTAL_MULTIPLIER_FORBIDDEN',
        'environmental telemetry is not a productive-value multiplier',
      );
    }
  }

  const profile = profileFor(record.sourceClass);
  if (record.factType === 'RESOURCE_RESERVE' && profile.createsExtractionEvent && record.measurementSemantics !== 'RESERVE_ESTIMATE_MASS') {
    return refuse('RESERVE_IS_NOT_EXTRACTION', 'reserve reports cannot be ingested as extraction observations');
  }
  if (record.factType === 'RESOURCE_EXTRACTION' && profile.createsReserveEstimate) {
    return refuse('RESERVE_IS_NOT_EXTRACTION', `${record.sourceClass} reports estimates, not realized extraction`);
  }
  if (!isResourceFactType(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `resource fabric does not ingest ${record.factType}`);
  }
  if (!profile.allowedFactTypes.includes(record.factType)) {
    return refuse(
      'WRONG_FACT_TYPE',
      `${record.sourceClass} cannot emit ${record.factType}`,
    );
  }
  if (profile.createsInventoryEvidence && record.measurementSemantics !== 'STOCKPILE_INVENTORY_MASS') {
    return refuse(
      'STOCKPILE_MOVEMENT_IS_NOT_EXTRACTION',
      'stockpile systems cannot emit extraction measurement semantics',
    );
  }
  if (record.factType === 'RESOURCE_RESERVE') {
    const outputGate = reserveCannotCreateOutput('OUTPUT');
    if (record.measurementSemantics !== 'RESERVE_ESTIMATE_MASS' && !outputGate.ok) {
      return outputGate;
    }
    const stale = evaluateStaleReserve({
      nowUnix,
      effectiveDateUnix: record.effectiveDateUnix,
      policy,
    });
    if (!stale.ok) {
      return stale;
    }
  }

  const mantissa = parseIntegerMantissa(record.numericValue);
  if (!mantissa.ok) {
    return mantissa;
  }
  if (
    record.priorCumulativeMantissa !== null &&
    mantissa.value < record.priorCumulativeMantissa &&
    !record.documentedMeterReset
  ) {
    return refuse('COUNTER_RESET_UNDOCUMENTED', 'cumulative meter decreased without a documented reset');
  }

  if (record.measurementSemantics === 'ASSAY_GRADE_QUALITY' || record.sourceClass === 'ASSAY_LAB_ATTESTATION') {
    const assay = assayIsNotMass(record);
    if (!assay.ok) {
      return assay;
    }
    return refuse('ASSAY_GRADE_IS_NOT_MASS', 'assay grade remains quality evidence and is not extracted mass');
  }

  const mass = normalizeMassQuantity({
    mantissa: mantissa.value,
    unit: record.unit,
    density: record.densityEvidence,
    targetUnit: record.unit === 'kg' ? 'kg' : 'tonne',
  });
  if (!mass.ok) {
    return mass;
  }

  const rights = evaluateExtractionRights(record, {
    ...policy,
    requireExtractionRightsReference:
      policy.requireExtractionRightsReference && profile.createsExtractionEvent && record.factType === 'RESOURCE_EXTRACTION',
  });
  if (!rights.ok) {
    return rights;
  }

  const independence = classifyResourceIndependence({
    sourceClass: record.sourceClass,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    related: related.map((row) => ({
      controllerId: row.controllerId,
      upstreamOrganizationId: row.upstreamOrganizationId,
    })),
  });
  const independenceBps = independence === 'INDEPENDENT_ORGANIZATION' ? 10_000 : 0;
  if (
    related.length > 0 &&
    independence !== 'INDEPENDENT_ORGANIZATION' &&
    related.some((row) => row.controllerId === record.controllerId) &&
    profile.mayBeIndependentOrganization
  ) {
    return refuse(
      'SAME_CONTROLLER_FAKE_QUORUM',
      'same-controller assay/audit/regulatory feeds are not independent quorum members',
    );
  }

  const measurementSemantics: string = record.measurementSemantics;
  const canCreateOutputClaim =
    record.factType === 'RESOURCE_EXTRACTION' &&
    profile.createsExtractionEvent &&
    measurementSemantics !== 'STOCKPILE_INVENTORY_MASS' &&
    measurementSemantics !== 'ASSAY_GRADE_QUALITY' &&
    measurementSemantics !== 'PROCESSED_CONCENTRATE';

  const observation: NormalizedResourceObservation = Object.freeze({
    schemaVersion: RESOURCE_FABRIC_SCHEMA_VERSION,
    observationId: observationIdOf(record),
    sourceClass: record.sourceClass,
    factType: record.factType,
    sourceCategory: 'minerals_resources',
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    proposedClaimType: canCreateOutputClaim
      ? 'OUTPUT'
      : record.factType === 'RESOURCE_RESERVE'
        ? 'RESERVE'
        : null,
    measurementSemantics: record.measurementSemantics,
    sourceQuantity: mass.value.source,
    canonicalQuantity: mass.value.canonical,
    canonicalUnit: mass.value.unit,
    identityRefs: identityRefsOf(record),
    geography: record.geography,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    operatorPartyId: record.operatorPartyId,
    parties: record.parties,
    rightsReferences: rights.value,
    independenceClass: independence,
    qualityInputs: qualityInputsOf(record, independenceBps, nowUnix, policy),
    createsExtractionEvent: profile.createsExtractionEvent && record.factType === 'RESOURCE_EXTRACTION',
    createsReserveEstimate: profile.createsReserveEstimate || record.factType === 'RESOURCE_RESERVE',
    createsInventoryEvidence: profile.createsInventoryEvidence,
    isAssayQualityOnly: profile.isAssayQualityOnly || measurementSemantics === 'ASSAY_GRADE_QUALITY',
    canCreateOutputClaim,
    canMintMoonRey: false,
    legalOwnershipInferred: false,
    productionActive: false,
  });

  const stockpile = stockpileMovementIsNotExtraction(observation);
  if (!stockpile.ok) {
    return stockpile;
  }

  const evidence: ResourceExtractionEvidenceRecord = Object.freeze({
    schemaVersion: RESOURCE_FABRIC_SCHEMA_VERSION,
    fabricPolicyVersion: policy.policyVersion,
    observation,
    eventId: null,
    claimType: observation.proposedClaimType,
    automaticIssuance: false,
    verified: false,
    issued: false,
    certificationAuthorizesMoonRey: false,
    realProviderContacted: RESOURCE_REAL_PROVIDER_CONTACTED,
    productionActive: RESOURCE_PRODUCTION_ACTIVE,
  });
  return ok(Object.freeze({ observation, evidence }));
}

export function ingestResourceRecords(
  records: readonly ResourceSourceRecord[],
  nowUnix: bigint,
  policy: ResourceFabricPolicy = defaultResourceFabricPolicy(),
): Result<readonly ResourceIngestResult[], ResourceRefusal> {
  const accepted: ResourceIngestResult[] = [];
  for (const record of records) {
    const ingested = ingestResourceRecord(record, nowUnix, policy, records.filter((row) => row !== record));
    if (!ingested.ok) {
      return ingested;
    }
    accepted.push(ingested.value);
  }
  return ok(Object.freeze(accepted));
}

export function identifyExtractionEvents(
  observations: readonly NormalizedResourceObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): Result<readonly ProductiveEconomicEvent[], ResourceRefusal> {
  return clusterExtractionObservations(observations, measurementStartUnix, measurementEndUnix);
}

export function linkExtractionToProcessing(input: {
  readonly extraction: NormalizedResourceObservation;
  readonly concentrate: NormalizedResourceObservation;
}): Result<ResourceLineageLink, ResourceRefusal> {
  const summed = refuseBlindMassSum(input.extraction, input.concentrate);
  if (summed.ok) {
    return refuse(
      'ORE_CONCENTRATE_CANNOT_BE_SUMMED',
      'processing concentrate must remain a distinct transformation stage',
    );
  }
  if (summed.error.code !== 'ORE_CONCENTRATE_CANNOT_BE_SUMMED') {
    return summed;
  }
  return ok(
    Object.freeze({
      fromObservationId: input.extraction.observationId,
      toObservationId: input.concentrate.observationId,
      relation: 'TRANSFORMS',
      impliesDuplicateValue: false,
    }),
  );
}

/**
 * Mine-face → truck → stockpile does not create new extraction.
 * Inventory inflows attach lineage to the underlying extraction event.
 */
export function linkExtractionToStockpile(input: {
  readonly extraction: NormalizedResourceObservation;
  readonly stockpile: NormalizedResourceObservation;
}): Result<ResourceLineageLink, ResourceRefusal> {
  if (!input.extraction.createsExtractionEvent) {
    return refuse('WRONG_FACT_TYPE', 'stockpile lineage requires an underlying extraction observation');
  }
  if (!input.stockpile.createsInventoryEvidence) {
    return refuse('STOCKPILE_MOVEMENT_IS_NOT_EXTRACTION', 'stockpile lineage requires inventory evidence');
  }
  return ok(
    Object.freeze({
      fromObservationId: input.extraction.observationId,
      toObservationId: input.stockpile.observationId,
      relation: 'STORES',
      impliesDuplicateValue: false,
    }),
  );
}

export function evaluateResourceClaimPath(input: {
  readonly factType: string;
  readonly claimType: string | null;
  readonly sourceCategory?: string;
}): Result<{ readonly allowed: boolean; readonly canMint: false }, ResourceRefusal> {
  if (input.factType === 'REFERENCE_PRICE' || input.sourceCategory === 'reference_price') {
    return refuse(
      'REFERENCE_PRICE_CANNOT_CREATE_CLAIM',
      'REFERENCE_PRICE cannot create a productive claim or OUTPUT',
    );
  }
  if (input.factType === 'RESOURCE_RESERVE' && input.claimType === 'OUTPUT') {
    return refuse('RESERVE_CANNOT_CREATE_OUTPUT', 'RESOURCE_RESERVE cannot create OUTPUT');
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory ?? (input.factType === 'RESOURCE_RESERVE' ? 'resources' : 'resources'),
    factType: input.factType,
    sourceUnit: 'tonne',
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    claimType: input.claimType,
  });
  if (!mapped.ok) {
    if (mapped.error.code === 'REFERENCE_DATA_CANNOT_CREATE_CLAIM') {
      return refuse('REFERENCE_PRICE_CANNOT_CREATE_CLAIM', mapped.error.detail);
    }
    if (mapped.error.code === 'CLAIM_TYPE_NOT_ALLOWED') {
      return refuse(
        input.factType === 'RESOURCE_RESERVE' ? 'RESERVE_CANNOT_CREATE_OUTPUT' : 'WRONG_FACT_TYPE',
        mapped.error.detail,
      );
    }
    return refuse('WRONG_FACT_TYPE', mapped.error.detail);
  }
  return ok(Object.freeze({ allowed: true, canMint: false as const }));
}

export function referencePriceCreatesOutput(): false {
  return REFERENCE_PRICE_CREATES_OUTPUT;
}

export function processingTransformationEvent(concentrateObservationId: string): ProductiveEconomicEvent {
  const evidenceStart = 1_700_000_000n;
  return createProductiveEconomicEvent({
    eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
    evidence: {
      transformationRef: identityRef('process', concentrateObservationId),
      alternateViewGroupRef: identityRef('process-view', concentrateObservationId),
      physicalObjectRefs: Object.freeze([identityRef('plant', 'process-plant')]),
      sourceObjectRefs: Object.freeze([identityRef('plant', 'process-plant')]),
      inputLotRefs: Object.freeze([identityRef('ore', concentrateObservationId)]),
      outputLotRefs: Object.freeze([identityRef('conc', concentrateObservationId)]),
      serialAssetRefs: Object.freeze([]),
      measurementPeriod: Object.freeze({
        validFromUnixSeconds: evidenceStart,
        validUntilUnixSeconds: evidenceStart + 3_600n,
        epoch: 1,
      }),
      deliveryPeriod: Object.freeze({
        fromUnixSeconds: evidenceStart,
        untilUnixSeconds: evidenceStart + 3_600n,
      }),
      geographyId: 'SIM:mine-region:zone',
      jurisdiction: 'SIM',
      oracleFactRefs: Object.freeze([identityRef('obs', concentrateObservationId)]),
      sourceProvenanceRefs: Object.freeze([identityRef('src', 'PROCESS_PLANT_METER')]),
      upstreamEventRefs: Object.freeze([]),
      downstreamEventRefs: Object.freeze([]),
      canonicalMeasurementRefs: Object.freeze([]),
      controllerRefs: Object.freeze([identityRef('ctl', 'mine-controller')]),
      participantRefs: Object.freeze([]),
      sourceSystemRefs: Object.freeze([identityRef('sys', 'PROCESS_PLANT_METER')]),
      lineageRoot: identityRef('ore', concentrateObservationId),
      economicTransformationRef: identityRef('process', concentrateObservationId),
    },
  });
}
