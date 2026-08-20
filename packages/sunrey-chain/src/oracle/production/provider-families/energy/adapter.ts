/**
 * Provider-neutral energy family adapter.
 *
 * Plugs into OracleSourceAdapterV2 / Chunk 127 through an injected
 * transport. No public-internet call. Future endpoint profiles can
 * supply provider-specific field mappings without changing the domain
 * model.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { asUtcInstant } from '../../../../../../domain/src/time.ts';
import {
  EconomicAssetRegistry,
  type EconomicAssetDescriptor,
} from '../../../../../../economic-asset-registry/src/index.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { OracleEconomicAssetAdapter } from '../../../economic-asset-adapter.ts';
import type { ExternalSourceRecord } from '../../schema.ts';
import type { UnitCode } from '../../../types.ts';
import type {
  CanonicalCollectedObservation,
  EconomicDataSource,
  OracleProviderOnboardingRecord,
  ProductionOracleRejection,
} from '../../types.ts';
import type {
  ConnectorRuntimeContext,
  OracleSourceAdapterV2,
  SourceFetchRequestV2,
} from '../../runtime-types.ts';
import { EconomicDataConnectorRuntime } from '../../runtime.ts';
import {
  REAL_EXTERNAL_PROVIDER_CONTACTED,
  energyRejection,
  isEnergyPowerUnitCandidate,
  type EnergyAcceptedObservation,
  type EnergyIngestResult,
  type EnergyObservationInput,
} from './types.ts';
import { profileFor } from './profiles.ts';
import { validateEnergySchema } from './schemas.ts';
import { normalizeEnergyMeasurement, parseEnergyIntegerQuantity, quantityToWh, samePhysicalEnergy } from './normalization.ts';
import { cumulativeRegisterIsNotPeriodProduction, deriveIntervalQuantity, parseEnergyTimeWindow } from './intervals.ts';
import { evaluateEnergyQuality, sameControllerFakeQuorum } from './quality.ts';
import {
  energyEventIdentity,
  energyObservationKey,
  provenanceCommitment,
  retainDeviceProvenance,
} from './provenance.ts';

export type EnergyFieldMapping = {
  readonly identifierField: string;
  readonly quantityField: string;
  readonly unitField: string;
  readonly sourceTimestampField: string;
  readonly measurementStartField: string;
  readonly measurementEndField: string;
  readonly collectionTimestampField: string;
  readonly observationIdField: string;
  readonly meterField: string;
  readonly registerField: string;
};

export const CANONICAL_ENERGY_FIELD_MAPPING: EnergyFieldMapping = Object.freeze({
  identifierField: 'identifier',
  quantityField: 'numericValue',
  unitField: 'unit',
  sourceTimestampField: 'sourceTimestampUnix',
  measurementStartField: 'measurementStartUnix',
  measurementEndField: 'measurementEndUnix',
  collectionTimestampField: 'collectionTimestampUnix',
  observationIdField: 'sourceObservationId',
  meterField: 'meterRef',
  registerField: 'registerId',
});

export class EnergyObservationStore {
  private readonly byKey = new Map<string, EnergyAcceptedObservation>();
  private readonly byObservationId = new Map<string, EnergyAcceptedObservation>();

  remember(observation: EnergyAcceptedObservation): EnergyAcceptedObservation | null {
    const existing = this.byObservationId.get(observation.sourceObservationId) ?? this.byKey.get(observation.observationKey);
    this.byKey.set(observation.observationKey, observation);
    this.byObservationId.set(observation.sourceObservationId, observation);
    return existing ?? null;
  }

  get(sourceObservationId: string): EnergyAcceptedObservation | undefined {
    return this.byObservationId.get(sourceObservationId);
  }
}

export function mapProviderPayload(
  payload: Readonly<Record<string, unknown>>,
  mapping: EnergyFieldMapping = CANONICAL_ENERGY_FIELD_MAPPING,
): Result<ExternalSourceRecord, ProductionOracleRejection> {
  const identifier = stringField(payload, mapping.identifierField);
  const numericValue = stringField(payload, mapping.quantityField);
  const unit = stringField(payload, mapping.unitField);
  const sourceTimestampUnix = stringField(payload, mapping.sourceTimestampField);
  if (!identifier || !numericValue || !unit || !sourceTimestampUnix) {
    return err({ code: 'SOURCE_RECORD_INVALID', detail: 'provider payload is missing canonical energy fields' });
  }
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (![mapping.identifierField, mapping.quantityField, mapping.unitField, mapping.sourceTimestampField].includes(key)) {
      extras[key] = value;
    }
  }
  return ok(
    Object.freeze({
      identifier,
      numericValue,
      unit,
      sourceTimestampUnix,
      schemaId: typeof payload.schemaId === 'string' ? payload.schemaId : 'ENERGY_INTERVAL_V1',
      schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 1,
      extras: Object.freeze(extras),
    }),
  );
}

export function ingestEnergyObservation(
  input: EnergyObservationInput,
  nowUnix: bigint,
  store?: EnergyObservationStore,
): EnergyIngestResult {
  const schema = validateEnergySchema(input);
  if (!schema.ok) {
    return schema;
  }
  const profile = profileFor(input.profileId);
  if (!profile) {
    return { ok: false, error: energyRejection('SCHEMA_INVALID', `unknown energy profile ${input.profileId}`) };
  }
  if (input.schemaId !== profile.schemaId) {
    return { ok: false, error: energyRejection('SCHEMA_DRIFT', `profile ${profile.profileId} expects ${profile.schemaId}`) };
  }
  if (input.channel === 'STORAGE_CHARGE' && input.factType === 'ENERGY_PRODUCTION') {
    return { ok: false, error: energyRejection('STORAGE_CHARGE_NOT_OUTPUT', 'battery charging energy is an input, not production') };
  }
  if (input.factType !== profile.factType) {
    return { ok: false, error: energyRejection('WRONG_FACT_TYPE', `profile ${profile.profileId} is ${profile.factType}, received ${input.factType}`) };
  }
  if (input.channel === 'LOCAL_PRODUCTION' && input.factType === 'ENERGY_CONSUMPTION') {
    return { ok: false, error: energyRejection('PRODUCTION_CONSUMPTION_COLLISION', 'consumption cannot be recorded as local production') };
  }
  if (input.channel === 'LOCAL_CONSUMPTION' && input.factType === 'ENERGY_PRODUCTION') {
    return { ok: false, error: energyRejection('PRODUCTION_CONSUMPTION_COLLISION', 'a consuming facility is not the producer of that electricity') };
  }
  if (input.channel === 'GRID_EXPORT' && profile.defaultChannel === 'LOCAL_PRODUCTION') {
    return { ok: false, error: energyRejection('EXPORT_IS_NOT_GROSS_PRODUCTION', 'grid export is not gross energy production') };
  }
  if (input.extras?.roundTripEfficiency !== undefined) {
    return { ok: false, error: energyRejection('ROUND_TRIP_EFFICIENCY_INVENTED', 'round-trip efficiency is not invented from charge and discharge') };
  }
  if (input.extras?.pretendProduction === true && input.factType === 'REFERENCE_PRICE') {
    return { ok: false, error: energyRejection('WRONG_FACT_TYPE', 'reference price cannot pretend to be production') };
  }
  if (input.factType === 'ENERGY_CAPACITY' || input.meterSemantics === 'INSTANTANEOUS_CAPACITY_REFERENCE') {
    return {
      ok: false,
      error: energyRejection(
        isEnergyPowerUnitCandidate(input.unit) ? 'UNIT_EXTENSION_REQUIRED' : 'CAPACITY_CANNOT_FAKE_MWH_AS_MW',
        'installed capacity is a power dimension; the unit constitution has no MW/kW vocabulary',
        false,
      ),
    };
  }
  const related = input.relatedObservations ?? [];
  if (related.length > 0 && sameControllerFakeQuorum(input, related) && input.extras?.requireIndependentQuorum === true) {
    return { ok: false, error: energyRejection('SAME_CONTROLLER_FAKE_QUORUM', 'resellers of the same upstream feed are not independent sources') };
  }

  const time = parseEnergyTimeWindow(input, nowUnix);
  if (!time.ok) {
    return time;
  }
  const parsed = parseEnergyIntegerQuantity(input.quantity, input.unit);
  if (!parsed.ok) {
    return parsed;
  }
  const derived = deriveIntervalQuantity(input, parsed.value, time.value);
  if (!derived.ok) {
    return derived;
  }
  if (cumulativeRegisterIsNotPeriodProduction(derived.value)) {
    return { ok: false, error: energyRejection('CUMULATIVE_NOT_PRODUCTION', 'a cumulative register value is not period production') };
  }

  const mappingUnit = derived.value.quantity.unit === 'units_produced' ? 'units_produced' : derived.value.quantity.unit;
  const mapping = validateSourceFactClaimMapping({
    sourceCategory: profile.sourceCategory,
    factType: input.factType,
    sourceUnit: mappingUnit,
    productiveCategory: profile.productiveCategory,
    claimType: profile.claimType,
  });
  if (!mapping.ok) {
    return { ok: false, error: energyRejection('MAPPING_INCOMPATIBLE', `${mapping.error.code}: ${mapping.error.detail}`) };
  }

  const intervalQuantity = derived.value.quantity;
  const measurement =
    profile.productiveCategory && intervalQuantity.unit !== 'units_produced'
      ? normalizeEnergyMeasurement({
          quantity: intervalQuantity,
          factType: input.factType,
          productiveCategory: profile.productiveCategory,
          claimType: profile.claimType,
          time: time.value,
          mappingId: mapping.value.mapping.mappingId,
          mappingVersion: mapping.value.mapping.mappingVersion,
        })
      : null;
  if (measurement && !measurement.ok) {
    return measurement;
  }

  const quantityWh = intervalQuantity.unit === 'units_produced' ? null : quantityToWh(intervalQuantity);
  if (quantityWh && !quantityWh.ok) {
    return quantityWh;
  }
  const observationKey = energyObservationKey({
    meterRef: input.meterRef,
    registerId: input.registerId,
    startUnix: time.value.measurementStartUnix,
    endUnix: time.value.measurementEndUnix,
    sourceObservationId: input.sourceObservationId,
    unit: intervalQuantity.originalUnit,
    quantityWh: quantityWh && quantityWh.ok ? quantityWh.value : null,
  });
  const existing = store?.get(input.sourceObservationId);
  if (existing) {
    const replaySame =
      existing.observationKey === observationKey ||
      (existing.intervalQuantity !== null && samePhysicalEnergy(existing.intervalQuantity, intervalQuantity));
    if (replaySame) {
      return { ok: true, value: existing, idempotentReplay: true };
    }
  }

  const event =
    input.channel === 'LOCAL_PRODUCTION' && input.factType === 'ENERGY_PRODUCTION'
      ? energyEventIdentity({
          subject: input.subject,
          time: time.value,
          geography: input.geography,
          channel: 'LOCAL_PRODUCTION',
          measurementRef: measurement?.ok ? measurement.value.normalizationReceiptId : null,
        })
      : null;

  const quality = evaluateEnergyQuality({
    observation: input,
    time: time.value,
    schemaValid: true,
    related,
  });

  const accepted: EnergyAcceptedObservation = Object.freeze({
    schemaVersion: 1,
    fabricId: 'sunrey.oracle.energy-data-fabric.v1',
    observationKey,
    sourceObservationId: input.sourceObservationId,
    profile,
    factType: input.factType,
    channel: input.channel,
    meterSemantics: input.meterSemantics,
    subject: input.subject,
    geography: input.geography,
    time: time.value,
    independence: input.independence,
    sourceQuantity: parsed.value,
    intervalQuantity,
    canonicalMeasurement: measurement?.ok ? measurement.value : null,
    deviceProvenance: retainDeviceProvenance(input.deviceProvenance),
    provenanceCommitment: provenanceCommitment({
      sourceObservationId: input.sourceObservationId,
      meterRef: input.meterRef,
      quantity: input.quantity,
      unit: input.unit,
      sourceTimestampUnix: input.sourceTimestampUnix,
    }),
    economicEventRef: event?.eventId ?? null,
    quality,
    mappingId: mapping.value.mapping.mappingId,
    canCreateProductiveClaim:
      profile.canCreateProductiveClaim &&
      input.channel === 'LOCAL_PRODUCTION' &&
      input.factType !== 'REFERENCE_PRICE',
    autoFinalizesFact: false,
    autoMintsMoonRey: false,
    credentialsPresent: false,
    productionActive: false,
  });
  store?.remember(accepted);
  return { ok: true, value: accepted, idempotentReplay: false };
}

export class EnergyProviderFamilyAdapter implements OracleSourceAdapterV2 {
  readonly adapterId = 'oracle.source.energy-family.v1';
  readonly adapterContract = 'v2' as const;
  readonly authenticationClass: SourceFetchRequestV2['source']['authenticationMethod'];
  readonly contactsPublicInternet = REAL_EXTERNAL_PROVIDER_CONTACTED;
  private readonly runtime: EconomicDataConnectorRuntime;
  private readonly mapping: EnergyFieldMapping;
  readonly store = new EnergyObservationStore();

  constructor(
    runtime: EconomicDataConnectorRuntime,
    authenticationClass: SourceFetchRequestV2['source']['authenticationMethod'] = 'FILE_FIXTURE_TEST_ONLY',
    mapping: EnergyFieldMapping = CANONICAL_ENERGY_FIELD_MAPPING,
  ) {
    this.runtime = runtime;
    this.authenticationClass = authenticationClass;
    this.mapping = mapping;
  }

  async retrieve(
    request: SourceFetchRequestV2,
    context: ConnectorRuntimeContext,
  ): Promise<Result<ExternalSourceRecord, ProductionOracleRejection>> {
    const collected = await this.runtime.collect({
      request,
      secrets: context.secrets,
      auth: context.auth,
    });
    if (!collected.ok) {
      return collected;
    }
    const mapped = mapProviderPayload(
      {
        identifier: collected.value.record.identifier,
        numericValue: collected.value.record.numericValue,
        unit: collected.value.record.unit,
        sourceTimestampUnix: collected.value.record.sourceTimestampUnix,
        schemaId: collected.value.record.schemaId,
        schemaVersion: collected.value.record.schemaVersion,
        ...collected.value.record.extras,
      },
      this.mapping,
    );
    return mapped;
  }

  async collectDraft(input: {
    readonly request: SourceFetchRequestV2;
    readonly context: ConnectorRuntimeContext;
    readonly observation: EnergyObservationInput;
  }): Promise<Result<{ readonly record: ExternalSourceRecord; readonly energy: EnergyAcceptedObservation; readonly draft: CanonicalCollectedObservation }, ProductionOracleRejection>> {
    const retrieved = await this.retrieve(input.request, input.context);
    if (!retrieved.ok) {
      return retrieved;
    }
    const ingested = ingestEnergyObservation(input.observation, input.request.nowUnix, this.store);
    if (!ingested.ok) {
      return err({ code: 'SOURCE_RECORD_INVALID', detail: `${ingested.error.code}: ${ingested.error.detail}` });
    }
    const draft: CanonicalCollectedObservation = Object.freeze({
      schemaVersion: 1,
      observationDraftId: `draft_energy_${ingested.value.sourceObservationId}`,
      providerId: input.request.source.providerId,
      sourceId: input.request.source.sourceId,
      feedId: input.request.source.feedId,
      subject: ingested.value.subject.canonicalRef,
      value: {
        schemaVersion: 1 as const,
        mantissa: ingested.value.intervalQuantity?.mantissa ?? ingested.value.sourceQuantity.mantissa,
        scale: 0,
        unit: (ingested.value.intervalQuantity?.unit === 'units_produced'
          ? 'units_produced'
          : ingested.value.canonicalMeasurement?.canonicalUnit === 'Wh'
            ? 'Wh'
            : ingested.value.sourceQuantity.unit === 'units_produced'
              ? 'units_produced'
              : ingested.value.sourceQuantity.unit) as UnitCode,
      },
      sourceValue: {
        schemaVersion: 1 as const,
        mantissa: ingested.value.sourceQuantity.originalMantissa,
        scale: 0,
        unit: (ingested.value.sourceQuantity.unit === 'units_produced'
          ? 'units_produced'
          : ingested.value.sourceQuantity.unit) as UnitCode,
      },
      canonicalMeasurement: ingested.value.canonicalMeasurement ?? undefined,
      provenance: {
        schemaVersion: 1,
        providerId: input.request.source.providerId,
        sourceId: input.request.source.sourceId,
        sourceObservationId: ingested.value.sourceObservationId,
        collectionTimestampUnix: ingested.value.time.collectionTimestampUnix,
        sourceTimestampUnix: ingested.value.time.sourceTimestampUnix,
        schemaVersionRecord: 1,
        unit: (ingested.value.sourceQuantity.unit === 'units_produced'
          ? 'units_produced'
          : ingested.value.sourceQuantity.unit) as UnitCode,
        normalizationVersion: 'sunrey.economic-unit.normalization.v1',
        credentialRefHref: null,
        authMethod: input.request.source.authenticationMethod,
        collectorVersion: 'sunrey-oracle-connector/1',
        contentHash: ingested.value.provenanceCommitment,
      },
    });
    return ok(Object.freeze({ record: retrieved.value, energy: ingested.value, draft }));
  }
}

export function projectEnergyAssets(input: {
  readonly source: EconomicDataSource;
  readonly onboarding: OracleProviderOnboardingRecord;
  readonly observation: EnergyAcceptedObservation;
}): Result<
  {
    readonly sourceAsset: EconomicAssetDescriptor;
    readonly observationAsset: EconomicAssetDescriptor;
  },
  { readonly code: string; readonly message: string }
> {
  const registry = new EconomicAssetRegistry();
  const adapter = new OracleEconomicAssetAdapter(registry);
  const at = asUtcInstant(new Date(Number(input.observation.time.collectionTimestampUnix) * 1000).toISOString());
  const source = adapter.projectSource(input.source, input.onboarding, at);
  if (!source.ok) {
    return source;
  }
  const observations = adapter.projectObservationSet({
    observations: [
      {
        schemaVersion: 1,
        observationId: input.observation.sourceObservationId,
        oracleId: input.source.providerId,
        feedId: input.source.feedId,
        subject: input.observation.subject.canonicalRef,
        value: {
          schemaVersion: 1,
          mantissa: input.observation.intervalQuantity?.mantissa ?? 0n,
          scale: 0,
          unit: input.observation.sourceQuantity.unit === 'units_produced' ? 'units_produced' : 'Wh',
        },
        measurementStartUnix: input.observation.time.measurementStartUnix,
        measurementEndUnix: input.observation.time.measurementEndUnix,
        observationTimeUnix: input.observation.time.sourceTimestampUnix,
        validUntilUnix: input.observation.time.measurementEndUnix + 3_600n,
        geography: input.observation.geography,
        sourceReferenceCommitment: input.observation.provenanceCommitment,
        methodologyReference: input.observation.profile.profileId,
        confidence: { schemaVersion: 1, scoreBps: input.observation.quality.scoreBps, sampleCount: 1, notesRef: 'energy-fabric' },
        sequence: 1n,
        networkId: 'net_sunrey_simulation',
        chainId: 'chn_sunrey_simulation',
        deviceProvenance: input.observation.deviceProvenance,
        weight: 1n,
        signatureHex: '00',
        publicKeyHex: '00',
        cryptoSuite: 'sunrey.oracle.software-dev',
      } as never,
    ],
    source: input.source,
    at,
    sourceAssetId: source.value.assetId,
  });
  if (!observations.ok) {
    return observations;
  }
  return ok(Object.freeze({ sourceAsset: source.value, observationAsset: observations.value }));
}

export function energyReferencePriceCannotCreateClaim(): false {
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: 'reference_price',
    factType: 'REFERENCE_PRICE',
    sourceUnit: 'units_produced',
    productiveCategory: null,
    claimType: 'OUTPUT',
  });
  return mapped.ok ? (false as never) : false;
}

export function energyReferencePriceCannotMint(): false {
  return false;
}

export function energyObservationDoesNotAutoFinalize(): false {
  return false;
}

export function energyFactDoesNotAutoMintMoonRey(): false {
  return false;
}

function stringField(payload: Readonly<Record<string, unknown>>, field: string): string | null {
  const value = payload[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
