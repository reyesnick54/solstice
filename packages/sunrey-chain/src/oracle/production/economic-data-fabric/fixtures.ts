/**
 * Deterministic multi-domain fixtures for the unified economic data fabric.
 * No live providers. No credentials. No raw personal or industrial payloads.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import type { FactType, UnitCode } from '../../types.ts';
import type { DataSourceCategory } from '../../../productive/source-taxonomy/types.ts';
import type { CollectionCandidate, FabricGeography, ProviderFamilyId } from './types.ts';

export const FABRIC_NOW_UNIX = 1_700_000_000n;

const GEO: FabricGeography = Object.freeze({
  jurisdiction: 'US',
  region: 'sim-west',
  locality: 'zone-a',
});

function commitment(label: string): string {
  return sha256Hex(`edf.fixture.${label}`);
}

export function fixtureCandidate(input: {
  readonly familyHint?: ProviderFamilyId;
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly schemaId: string;
  readonly sourceObservationId: string;
  readonly subjectRef: string;
  readonly mantissa: bigint;
  readonly unit: UnitCode;
  readonly certificationStatus?: CollectionCandidate['certificationStatus'];
  readonly certificationId?: string | null;
  readonly certificationExpired?: boolean;
  readonly providerSuspended?: boolean;
  readonly sourceSuspended?: boolean;
  readonly sourceRegistered?: boolean;
  readonly endpointApproved?: boolean;
  readonly connectorResultValid?: boolean;
  readonly schemaValid?: boolean;
  readonly claimedFamilyId?: ProviderFamilyId;
  readonly claimedProductiveCategory?: CollectionCandidate['claimedProductiveCategory'];
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly sharedControlGroup?: string | null;
  readonly payload?: unknown;
  readonly credentialsPresent?: boolean;
  readonly rawPayloadPresent?: boolean;
  readonly externalUrl?: string | null;
  readonly stale?: boolean;
  readonly contentCommitment?: string;
}): CollectionCandidate {
  const now = FABRIC_NOW_UNIX;
  return Object.freeze({
    providerId: input.providerId,
    sourceId: input.sourceId,
    feedId: input.feedId,
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    schemaId: input.schemaId,
    schemaVersion: 1,
    sourceObservationId: input.sourceObservationId,
    subjectRef: input.subjectRef,
    sourceQuantity: Object.freeze({ mantissa: input.mantissa, scale: 0 as const, unit: input.unit }),
    measurementStart: now - 3_600n,
    measurementEnd: now,
    sourceTimestamp: input.stale ? now - 10_000n : now - 60n,
    collectionTimestamp: now,
    geography: GEO,
    provenanceRef: `prov.${input.sourceObservationId}`,
    contentCommitment: input.contentCommitment ?? commitment(input.sourceObservationId),
    certificationId: input.certificationId ?? (input.certificationStatus && input.certificationStatus !== 'NOT_EVALUATED' ? `cert.${input.sourceId}` : null),
    certificationStatus: input.certificationStatus ?? 'ENGINEERING_SANDBOX',
    certificationExpired: input.certificationExpired,
    mappingId: null,
    mappingVersion: null,
    claimedFamilyId: input.claimedFamilyId,
    claimedProductiveCategory: input.claimedProductiveCategory,
    endpointProfileId: `profile.${input.sourceId}`,
    connectorResultValid: input.connectorResultValid ?? true,
    schemaValid: input.schemaValid ?? true,
    sourceRegistered: input.sourceRegistered ?? true,
    endpointApproved: input.endpointApproved ?? true,
    providerSuspended: input.providerSuspended ?? false,
    sourceSuspended: input.sourceSuspended ?? false,
    freshnessMaxAgeSeconds: 3_600,
    controllerId: input.controllerId ?? `controller.${input.providerId}`,
    upstreamOrganizationId: input.upstreamOrganizationId ?? `org.${input.providerId}`,
    sharedControlGroup: input.sharedControlGroup ?? null,
    payload: input.payload,
    credentialsPresent: input.credentialsPresent,
    rawPayloadPresent: input.rawPayloadPresent,
    externalUrl: input.externalUrl,
  });
}

export function energyProductionFixture(providerId = 'prov_energy_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_energy_production_sim',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    schemaId: 'ENERGY_INTERVAL_V1',
    sourceObservationId: `obs.energy.${providerId}`,
    subjectRef: 'plant_sim_1',
    mantissa: 1_200n,
    unit: 'kWh',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function manufacturingOutputFixture(providerId = 'prov_mfg_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_manufacturing_output_sim',
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_OUTPUT',
    schemaId: 'manufacturing.mes.output.v1',
    sourceObservationId: `obs.mfg.${providerId}`,
    subjectRef: 'factory_line_1',
    mantissa: 40n,
    unit: 'units_produced',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function goodsOutputFixture(providerId = 'prov_goods_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_goods_output_sim',
    sourceCategory: 'goods',
    factType: 'GOODS_OUTPUT',
    schemaId: 'sunrey.fixture.goods.v1',
    sourceObservationId: `obs.goods.${providerId}`,
    subjectRef: 'goods_batch_1',
    mantissa: 40n,
    unit: 'units_produced',
  });
}

export function logisticsDeliveryFixture(providerId = 'prov_log_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_delivery_completion_sim',
    sourceCategory: 'logistics',
    factType: 'DELIVERY_COMPLETION',
    schemaId: 'delivery.completion.v1',
    sourceObservationId: `obs.log.${providerId}`,
    subjectRef: 'shipment_1',
    mantissa: 40n,
    unit: 'units_produced',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function computeUsageFixture(providerId = 'prov_compute_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_compute_usage_sim',
    sourceCategory: 'compute',
    factType: 'COMPUTE_USAGE',
    schemaId: 'COMPUTE_USAGE_V1',
    sourceObservationId: `obs.compute.${providerId}`,
    subjectRef: 'cluster_1',
    mantissa: 3_600n,
    unit: 'compute_s',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function aiInferenceFixture(providerId = 'prov_ai_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_ai_inference_sim',
    sourceCategory: 'ai_usage',
    factType: 'AI_INFERENCE_USAGE',
    schemaId: 'AI_INFERENCE_USAGE_V1',
    sourceObservationId: `obs.ai.${providerId}`,
    subjectRef: 'model_job_1',
    mantissa: 10_000n,
    unit: 'token_inference',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function resourceExtractionFixture(providerId = 'prov_res_a'): CollectionCandidate {
  return fixtureCandidate({
    providerId,
    sourceId: `src_${providerId}`,
    feedId: 'feed_resource_extraction_sim',
    sourceCategory: 'minerals_resources',
    factType: 'RESOURCE_EXTRACTION',
    schemaId: 'minerals.weighbridge.v1',
    sourceObservationId: `obs.res.${providerId}`,
    subjectRef: 'mine_site_1',
    mantissa: 25n,
    unit: 'tonne',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function agricultureFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_ag_a',
    sourceId: 'src_prov_ag_a',
    feedId: 'feed_food_production_sim',
    sourceCategory: 'food_agriculture',
    factType: 'FOOD_PRODUCTION',
    schemaId: 'sunrey.fixture.agriculture.v1',
    sourceObservationId: 'obs.ag.a',
    subjectRef: 'farm_block_1',
    mantissa: 12n,
    unit: 'tonne',
  });
}

export function waterFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_water_a',
    sourceId: 'src_prov_water_a',
    feedId: 'feed_water_production_sim',
    sourceCategory: 'water',
    factType: 'WATER_PRODUCTION',
    schemaId: 'sunrey.fixture.water.v1',
    sourceObservationId: 'obs.water.a',
    subjectRef: 'well_1',
    mantissa: 8_000n,
    unit: 'L',
  });
}

export function storageFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_store_a',
    sourceId: 'src_prov_store_a',
    feedId: 'feed_storage_capacity_sim',
    sourceCategory: 'storage',
    factType: 'STORAGE_CAPACITY',
    schemaId: 'storage.warehouse.v1',
    sourceObservationId: 'obs.store.a',
    subjectRef: 'warehouse_1',
    mantissa: 400n,
    unit: 'm3',
    certificationStatus: 'TESTNET_ADMISSIBLE',
  });
}

export function realEstateFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_re_a',
    sourceId: 'src_prov_re_a',
    feedId: 'feed_real_estate_sim',
    sourceCategory: 'real_estate_use',
    factType: 'REAL_ESTATE_USE_CAPACITY',
    schemaId: 'sunrey.fixture.real-estate.v1',
    sourceObservationId: 'obs.re.a',
    subjectRef: 'facility_1',
    mantissa: 2_500n,
    unit: 'm2',
  });
}

export function infrastructureFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_infra_a',
    sourceId: 'src_prov_infra_a',
    feedId: 'feed_infrastructure_sim',
    sourceCategory: 'infrastructure',
    factType: 'INFRASTRUCTURE_CAPACITY',
    schemaId: 'sunrey.fixture.infrastructure.v1',
    sourceObservationId: 'obs.infra.a',
    subjectRef: 'facility_1',
    mantissa: 2_500n,
    unit: 'm2',
  });
}

export function bandwidthFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_bw_a',
    sourceId: 'src_prov_bw_a',
    feedId: 'feed_bandwidth_sim',
    sourceCategory: 'bandwidth',
    factType: 'BANDWIDTH_USAGE',
    schemaId: 'sunrey.fixture.bandwidth.v1',
    sourceObservationId: 'obs.bw.a',
    subjectRef: 'link_1',
    mantissa: 12n,
    unit: 'GB_s',
  });
}

export function serviceDeliveryFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_svc_a',
    sourceId: 'src_prov_svc_a',
    feedId: 'feed_service_delivery_sim',
    sourceCategory: 'services',
    factType: 'SERVICE_DELIVERY',
    schemaId: 'sunrey.fixture.services.v1',
    sourceObservationId: 'obs.svc.a',
    subjectRef: 'service_job_1',
    mantissa: 3n,
    unit: 'units_produced',
  });
}

export function referencePriceFixture(): CollectionCandidate {
  return fixtureCandidate({
    providerId: 'prov_ref_a',
    sourceId: 'src_prov_ref_a',
    feedId: 'feed_reference_price_sim',
    sourceCategory: 'reference_price',
    factType: 'REFERENCE_PRICE',
    schemaId: 'ENERGY_REFERENCE_PRICE_V1',
    sourceObservationId: 'obs.ref.a',
    subjectRef: 'market_hub_1',
    mantissa: 42n,
    unit: 'units_produced',
    certificationStatus: 'ENGINEERING_SANDBOX',
  });
}

export function multiDomainScenario(): readonly CollectionCandidate[] {
  return Object.freeze([
    resourceExtractionFixture(),
    agricultureFixture(),
    waterFixture(),
    energyProductionFixture(),
    manufacturingOutputFixture(),
    goodsOutputFixture(),
    logisticsDeliveryFixture(),
    storageFixture(),
    realEstateFixture(),
    infrastructureFixture(),
    bandwidthFixture(),
    computeUsageFixture(),
    aiInferenceFixture(),
    serviceDeliveryFixture(),
    referencePriceFixture(),
  ]);
}

export function sameControllerSources(): readonly CollectionCandidate[] {
  return Object.freeze([
    energyProductionFixture('prov_shared_a'),
    fixtureCandidate({
      providerId: 'prov_shared_b',
      sourceId: 'src_prov_shared_b',
      feedId: 'feed_energy_production_sim',
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      schemaId: 'ENERGY_INTERVAL_V1',
      sourceObservationId: 'obs.energy.shared.b',
      subjectRef: 'plant_sim_1',
      mantissa: 1_200n,
      unit: 'kWh',
      certificationStatus: 'TESTNET_ADMISSIBLE',
      controllerId: 'controller.shared',
      upstreamOrganizationId: 'org.shared',
      sharedControlGroup: 'group.shared',
    }),
  ]);
}

export function conflictingEnergyQuantities(): readonly CollectionCandidate[] {
  return Object.freeze([
    energyProductionFixture('prov_energy_a'),
    fixtureCandidate({
      providerId: 'prov_energy_b',
      sourceId: 'src_prov_energy_b',
      feedId: 'feed_energy_production_sim',
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      schemaId: 'ENERGY_INTERVAL_V1',
      sourceObservationId: 'obs.energy.b',
      subjectRef: 'plant_sim_1',
      mantissa: 2_400n,
      unit: 'kWh',
      certificationStatus: 'TESTNET_ADMISSIBLE',
    }),
  ]);
}

export function privacyLeakFixture(): CollectionCandidate {
  return fixtureCandidate({
    ...energyProductionFixture(),
    payload: { prompt: 'secret user prompt', apiKey: 'sk-live' },
  });
}

export function credentialFixture(): CollectionCandidate {
  return fixtureCandidate({
    ...energyProductionFixture(),
    credentialsPresent: true,
  });
}

export function rawPayloadFixture(): CollectionCandidate {
  return fixtureCandidate({
    ...energyProductionFixture(),
    rawPayloadPresent: true,
    payload: { meterDump: 'raw' },
  });
}

export function arbitraryUrlFixture(): CollectionCandidate {
  return fixtureCandidate({
    ...energyProductionFixture(),
    externalUrl: 'https://example.com/steal',
  });
}
