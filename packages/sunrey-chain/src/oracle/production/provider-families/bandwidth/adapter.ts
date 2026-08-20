/**
 * Bandwidth economic data adapter.
 *
 * Connector records enter here after the off-chain runtime. The
 * adapter never calls a live provider, never mints MoonRey, and
 * never stores packet payloads or subscriber browsing history.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact, lookupUnit } from '../../../../units/convert.ts';
import { receiptDigestOf } from '../../../../units/measurement.ts';
import type { MeasurementDimension } from '../../../../units/constitution.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import { validateExternalRecord } from '../../schema.ts';
import type { ExternalSourceRecord } from '../../schema.ts';
import {
  BANDWIDTH_FACT_AUTO_MINTS_MOONREY,
  bandwidthRefusal,
  isForbiddenBandwidthFactType,
  type BandwidthEconomicIdentity,
  type BandwidthEconomicRecord,
  type BandwidthRefusal,
  type BandwidthSourceObservation,
} from './types.ts';
import { scanBandwidthPrivacy } from './privacy.ts';
import { bandwidthFeedSchema } from './schemas.ts';
import { identityOf } from './lineage.ts';
import { parseBandwidthInterval } from './intervals.ts';
import { qualityOf } from './quality.ts';
import { normalizeVolume, rateTimesDuration, sourceQuantityOf } from './transfer.ts';
import { inventoryFrom } from './capacity.ts';
import { profileFor } from './profiles.ts';

const STALE_AFTER_SECONDS = 3_600n;

export function ingestBandwidthObservation(
  observation: BandwidthSourceObservation,
  nowUnix: bigint,
): Result<BandwidthEconomicRecord, BandwidthRefusal> {
  const privacy = scanBandwidthPrivacy(observation);
  if (!privacy.ok) {
    return privacy;
  }
  if (isForbiddenBandwidthFactType(observation.factType)) {
    return err(bandwidthRefusal('FORBIDDEN_FACT_TYPE', `${observation.factType} is not an economic bandwidth fact`));
  }
  if (observation.extras?.storageAtRest === true) {
    return err(bandwidthRefusal('STORAGE_IS_NOT_TRANSFER', 'data at rest is not a bandwidth transfer service'));
  }
  if (observation.extras?.capacityInventory === true && observation.factType === 'BANDWIDTH_USAGE') {
    return err(bandwidthRefusal('CAPACITY_IS_NOT_REALIZED_USAGE', 'capacity inventory cannot be reported as realized usage'));
  }
  const profile = profileFor(observation.sourceClass);
  if (!profile.allowedFactTypes.includes(observation.factType)) {
    return err(bandwidthRefusal('SCHEMA_INCOMPATIBLE', `${observation.sourceClass} cannot emit ${observation.factType}`));
  }
  if (nowUnix - BigInt(observation.sourceTimestampUnix) > STALE_AFTER_SECONDS) {
    return err(bandwidthRefusal('STALE_TRAFFIC', 'bandwidth observation exceeds freshness bound'));
  }
  const interval = parseBandwidthInterval(observation, nowUnix);
  if (!interval.ok) {
    return interval;
  }

  const schema = bandwidthFeedSchema(observation.schemaId);
  if (observation.schemaVersion !== schema.version) {
    return err(
      bandwidthRefusal(
        'SCHEMA_DRIFT',
        `expected schema version ${schema.version} for ${observation.schemaId}; create a new feed version`,
      ),
    );
  }
  const validated = validateExternalRecord(schema, Object.freeze({
    identifier: observation.identifier,
    numericValue: observation.numericValue,
    unit: schema.unit,
    sourceTimestampUnix: observation.sourceTimestampUnix,
    schemaId: schema.schemaId,
    schemaVersion: schema.version,
  } satisfies ExternalSourceRecord));
  if (!validated.ok) {
    if (validated.error.code === 'FLOAT_FORBIDDEN' || validated.error.code === 'WRONG_NUMERIC_REPRESENTATION') {
      return err(bandwidthRefusal('FLOAT_QUANTITY_FORBIDDEN', validated.error.detail));
    }
    if (validated.error.code === 'SCHEMA_DRIFT' || validated.error.code === 'SCHEMA_INCOMPATIBLE') {
      return err(bandwidthRefusal('SCHEMA_DRIFT', validated.error.detail));
    }
    return err(bandwidthRefusal('SCHEMA_INCOMPATIBLE', validated.error.detail));
  }

  if (observation.factType === 'BANDWIDTH_CAPACITY') {
    return ingestCapacity(observation);
  }
  if (observation.schemaId === 'BANDWIDTH_USAGE_V1') {
    return ingestUsageV1(observation, interval.value.durationSeconds);
  }
  if (observation.schemaId === 'BANDWIDTH_USAGE_V2') {
    return ingestUsageV2(observation);
  }
  return err(bandwidthRefusal('SCHEMA_INCOMPATIBLE', `unsupported bandwidth schema ${observation.schemaId}`));
}

function ingestCapacity(observation: BandwidthSourceObservation): Result<BandwidthEconomicRecord, BandwidthRefusal> {
  if (observation.quantityKind !== 'DATA_RATE' || observation.schemaId !== 'BANDWIDTH_CAPACITY_V1') {
    return err(bandwidthRefusal('CAPACITY_IS_NOT_REALIZED_USAGE', 'capacity must remain a DATA_RATE observation'));
  }
  const inventory = inventoryFrom(observation);
  if (!inventory.ok) {
    return inventory;
  }
  const source = sourceQuantityOf(observation);
  if (!source.ok) {
    return source;
  }
  const receipt = convertExact({
    source: source.value,
    targetUnitId: source.value.unitId,
    context: { factType: 'BANDWIDTH_CAPACITY', productiveCategory: 'BANDWIDTH_COMMUNICATIONS' },
  });
  if (!receipt.ok) {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }
  return ok(toRecord(observation, identityOf(observation), source.value, source.value, null, receipt.value));
}

function ingestUsageV1(
  observation: BandwidthSourceObservation,
  intervalDuration: bigint,
): Result<BandwidthEconomicRecord, BandwidthRefusal> {
  if (observation.unit !== 'GB_s' && observation.unit !== 'B_s') {
    return err(
      bandwidthRefusal(
        'UNIT_CHANGE_WITHOUT_VERSION',
        'BANDWIDTH_USAGE_V1 remains GB_s/B_s; volume units require BANDWIDTH_USAGE_V2',
      ),
    );
  }
  const source = sourceQuantityOf(observation);
  if (!source.ok) {
    return source;
  }
  const duration = observation.durationSeconds ?? intervalDuration;
  const derived = rateTimesDuration({
    rate: source.value,
    durationSeconds: duration,
    factType: 'BANDWIDTH_USAGE',
  });
  if (!derived.ok) {
    return derived;
  }
  return ok(toRecord(observation, identityOf(observation), source.value, derived.value.volume, derived.value.volume, derived.value.receipt));
}

function ingestUsageV2(observation: BandwidthSourceObservation): Result<BandwidthEconomicRecord, BandwidthRefusal> {
  if (observation.unit === 'GB_s' || observation.unit === 'B_s') {
    return err(
      bandwidthRefusal('RATE_PRESENTED_AS_VOLUME', 'BANDWIDTH_USAGE_V2 is transferred volume (GB/TB); GB/s is not GB'),
    );
  }
  if (!observation.transferSemantics) {
    return err(bandwidthRefusal('UNKNOWN_SEMANTICS', 'BANDWIDTH_USAGE_V2 requires an explicit transfer semantic class'));
  }
  const source = sourceQuantityOf(observation);
  if (!source.ok) {
    return source;
  }
  const unitDef = lookupUnit(source.value.unitId);
  if (!unitDef || unitDef.dimension !== 'DATA_VOLUME') {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', `${source.value.unitId} is not a data-volume unit`));
  }
  const normalized = normalizeVolume({ quantity: source.value, factType: 'BANDWIDTH_USAGE' });
  if (!normalized.ok) {
    return normalized;
  }
  return ok(
    toRecord(observation, identityOf(observation), source.value, normalized.value.volume, normalized.value.volume, normalized.value.receipt),
  );
}

function toRecord(
  observation: BandwidthSourceObservation,
  identity: BandwidthEconomicIdentity,
  sourceQuantity: ExactQuantity,
  canonicalQuantity: ExactQuantity,
  derivedVolume: ExactQuantity | null,
  receipt: NormalizationReceipt,
): BandwidthEconomicRecord {
  const dimension = observation.factType === 'BANDWIDTH_CAPACITY' ? 'DATA_RATE' : 'DATA_VOLUME';
  const canonicalUnit = observation.factType === 'BANDWIDTH_CAPACITY' ? sourceQuantity.unitId : 'GB';
  return Object.freeze({
    fabricVersion: 'sunrey.bandwidth-network-data-fabric.v1' as const,
    schemaId: observation.schemaId,
    usageSchemaVersion: observation.schemaId === 'BANDWIDTH_USAGE_V2' ? 2 : 1,
    factType: observation.factType,
    productiveCategory: observation.productiveCategory,
    claimType: observation.claimType,
    sourceClass: observation.sourceClass,
    identity,
    transferSemantics: observation.transferSemantics,
    networkStage: observation.networkStage,
    quantityKind: observation.quantityKind,
    sourceQuantity,
    canonicalQuantity,
    canonicalUnit,
    dimension,
    derivedVolume,
    measurement: {
      schemaVersion: 1 as const,
      sourceQuantity,
      sourceUnit: sourceQuantity.unitId,
      canonicalQuantity,
      canonicalUnit,
      measurementDimension: (observation.factType === 'BANDWIDTH_CAPACITY' ? 'DATA_RATE' : 'DATA_VOLUME') as MeasurementDimension,
      semanticQualifier: 'UNQUALIFIED' as const,
      productiveCategory: 'BANDWIDTH_COMMUNICATIONS' as const,
      factType: observation.factType,
      claimType: observation.claimType,
      normalizationReceiptId: receipt.receiptId,
      normalizationReceiptDigest: receiptDigestOf(receipt),
      normalizationConstitutionVersion: receipt.conversionVersion,
      measurementPeriod: {
        startUnix: observation.measurementStart,
        endUnix: observation.measurementEnd,
      },
      contextRefs: receipt.contextRefs,
      exact: true as const,
      roundingApplied: false as const,
      lossy: false as const,
      receipt,
      mappingId: null,
      mappingVersion: null,
    },
    receipt,
    quality: qualityOf(observation),
    cacheHitCreatesContentCopy: false as const,
    grossEqualsDelivered: false as const,
    storageEqualsTransfer: false as const,
    dataRateEqualsDataVolume: false as const,
    capacityEqualsRealizedUsage: false as const,
    packetPayloadStored: false as const,
    userBrowsingHistoryStored: false as const,
    realProviderContacted: false as const,
    bandwidthFactAutoMintsMoonRey: BANDWIDTH_FACT_AUTO_MINTS_MOONREY,
  });
}

export function bandwidthAdapterDoesNotMint(): false {
  return BANDWIDTH_FACT_AUTO_MINTS_MOONREY;
}
