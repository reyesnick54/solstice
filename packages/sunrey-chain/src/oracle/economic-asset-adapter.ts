import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  chainIdFor,
  contentCommitmentFor,
  controllerRefFor,
  licenseRefFor,
  networkIdFor,
  operatorRefFor,
  projectDescriptor,
  reflectSourceLifecycle,
  scanForbiddenPayload,
  sourceOrganizationRefFor,
  usageRestrictionRefFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../economic-asset-registry/src/index.ts';
import type { OracleObservation, VerifiedEconomicFact } from './types.ts';
import type {
  EconomicDataSource,
  OracleProviderOnboardingRecord,
  OracleSourceQualityProfile,
  SourceProvenance,
} from './production/types.ts';

const OWNER = CANONICAL_SYSTEM_OWNERS.oracle;

const CATEGORY_MAP = Object.freeze({
  energy: 'ENERGY',
  food_agriculture: 'FOOD_AGRICULTURE',
  water: 'WATER',
  compute: 'COMPUTE',
  ai_usage: 'AI_COMPUTE',
  manufacturing: 'MANUFACTURING',
  real_estate_use: 'REAL_ESTATE_USE',
  storage: 'STORAGE',
  logistics: 'LOGISTICS_TRANSPORTATION',
  bandwidth: 'BANDWIDTH_COMMUNICATIONS',
  resources: 'MINERALS_RAW_MATERIALS',
  service_delivery: 'SERVICES',
  reference_price: 'SHARED_ECONOMIC_REFERENCE',
} as const);

/**
 * Maps production oracle sources, observation sets, and verified facts
 * into master registry descriptors. The oracle remains authoritative
 * for whether a fact is verified. Credentials are never stored.
 */
export class OracleEconomicAssetAdapter {
  readonly registry: EconomicAssetRegistryPort;

  constructor(registry: EconomicAssetRegistryPort) {
    this.registry = registry;
  }

  projectSource(
    source: EconomicDataSource,
    onboarding: OracleProviderOnboardingRecord,
    at: UtcInstant,
    quality?: OracleSourceQualityProfile,
  ): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapOracleSource(source, onboarding, at, quality);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok) {
      return projected;
    }
    if (onboarding.status === 'SUSPENDED' || source.retired) {
      return this.registry.suspend(projected.value.assetId, at);
    }
    if (onboarding.status === 'REVOKED') {
      return this.registry.restrict(projected.value.assetId, at);
    }
    return projected;
  }

  projectObservationSet(input: {
    readonly observations: readonly OracleObservation[];
    readonly source: EconomicDataSource;
    readonly provenance?: SourceProvenance;
    readonly sourceAssetId?: EconomicAssetDescriptor['assetId'];
    readonly at: UtcInstant;
  }): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapOracleObservationSet(input);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !input.sourceAssetId) {
      return projected;
    }
    const derived = this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: input.sourceAssetId,
      kind: 'DERIVED_FROM',
      at: input.at,
    });
    if (!derived.ok) {
      return derived;
    }
    return this.registry.addLineage({
      fromAssetId: derived.value.assetId,
      toAssetId: input.sourceAssetId,
      kind: 'NORMALIZED_FROM',
      at: input.at,
    });
  }

  projectVerifiedFact(input: {
    readonly fact: VerifiedEconomicFact;
    readonly observationAssetId?: EconomicAssetDescriptor['assetId'];
    readonly at: UtcInstant;
  }): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapVerifiedEconomicFact(input.fact, input.at);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !input.observationAssetId) {
      return projected;
    }
    const aggregated = this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: input.observationAssetId,
      kind: 'AGGREGATED_FROM',
      at: input.at,
    });
    if (!aggregated.ok) {
      return aggregated;
    }
    return this.registry.addLineage({
      fromAssetId: aggregated.value.assetId,
      toAssetId: input.observationAssetId,
      kind: 'VERIFIED_BY',
      at: input.at,
    });
  }

  reflectProviderSuspension(sourceId: string, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    return reflectSourceLifecycle(this.registry, OWNER, sourceId, 'SUSPENDED', at);
  }
}

export function createOracleEconomicAssetAdapter(registry: EconomicAssetRegistryPort): OracleEconomicAssetAdapter {
  return new OracleEconomicAssetAdapter(registry);
}

export function mapOracleSource(
  source: EconomicDataSource,
  onboarding: OracleProviderOnboardingRecord,
  at: UtcInstant,
  quality?: OracleSourceQualityProfile,
): Result<RegisterAssetInput, RegistryFailure> {
  if (hasCredentialValue(source) || hasCredentialValue(onboarding)) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'oracle projection cannot store credential values' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: source.sourceId,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: OWNER,
    sourceOrganizationRef: sourceOrganizationRefFor(source.upstreamOrganizationId),
    sourceSchemaVersion: `${source.version}:${source.sourceSchemaVersion}`,
    controllerRef: controllerRefFor(source.controllerId),
    operatorRef: operatorRefFor(source.providerId),
    jurisdiction: 'US',
    geography: source.infrastructureRegion,
    licenseRefs: onboarding.onboardingEvidence.dataLicenseRef
      ? [licenseRefFor(onboarding.onboardingEvidence.dataLicenseRef)]
      : [],
    usageRestrictionRefs: onboarding.onboardingEvidence.usageRightsRef
      ? [usageRestrictionRefFor(onboarding.onboardingEvidence.usageRightsRef)]
      : [],
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: quality?.qualityClass === 'PRODUCTION_CANDIDATE' ? 'AUTHORITATIVE' : 'ATTESTED',
    freshness: source.retired ? 'STALE' : 'CURRENT',
    validFrom: at,
    economicCategory: CATEGORY_MAP[source.category],
    contentCommitmentMaterial: `oracle-src:${source.sourceId}:${source.version}:${source.schemaId}`.slice(0, 256),
    provenanceMaterial: `oracle-src-prov:${source.providerId}:${source.authenticationMethod}:${source.normalizationVersion}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: onboarding.status === 'SUSPENDED' || source.retired ? 'SUSPENDED' : onboarding.status === 'REVOKED' ? 'RESTRICTED' : 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapOracleObservationSet(input: {
  readonly observations: readonly OracleObservation[];
  readonly source: EconomicDataSource;
  readonly provenance?: SourceProvenance;
  readonly at: UtcInstant;
}): Result<RegisterAssetInput, RegistryFailure> {
  const observationIds = input.observations.map((row) => row.observationId).sort().join(',');
  const commitments = input.observations.map((row) => row.sourceReferenceCommitment).join(',');
  const windowStart = input.observations[0]?.measurementStartUnix ?? 0n;
  const windowEnd = input.observations[0]?.measurementEndUnix ?? 0n;
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_OBSERVATION_SET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: `obsset:${input.source.sourceId}:${observationIds.slice(0, 48)}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: OWNER,
    sourceSchemaVersion: input.source.normalizationVersion,
    controllerRef: controllerRefFor(input.source.controllerId),
    operatorRef: operatorRefFor(input.source.providerId),
    jurisdiction: 'US',
    geography: input.observations[0]?.geography.region ?? input.source.infrastructureRegion,
    rightsConcepts: ['USAGE_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    observedAt: unixToUtc(input.observations[0]?.observationTimeUnix ?? windowStart),
    validFrom: unixToUtc(windowStart),
    validUntil: unixToUtc(windowEnd),
    economicCategory: CATEGORY_MAP[input.source.category],
    contentCommitmentMaterial: `oracle-obs:${input.source.feedId}:${commitments}`.slice(0, 256),
    provenanceMaterial: `oracle-obs-prov:${input.provenance?.contentHash ?? input.source.sourceId}:${input.source.feedId}`.slice(0, 256),
    storageClass: 'ON_CHAIN_COMMITMENT_ONLY',
    chainAnchor: {
      networkId: networkIdFor(input.observations[0]?.networkId ?? 'sunrey-simulation'),
      chainId: chainIdFor(input.observations[0]?.chainId ?? 'net_sunrey_simulation'),
      transactionId: null,
      blockHeight: null,
      blockId: null,
      stateRootRef: null,
      contentCommitment: contentCommitmentFor(`oracle-obs:${observationIds}`),
      anchorType: 'PROVENANCE_COMMITMENT',
      finalityState: 'UNANCHORED',
    },
    createdAt: input.at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapVerifiedEconomicFact(fact: VerifiedEconomicFact, at: UtcInstant): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'VERIFIED_ECONOMIC_FACT',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: fact.factId,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: OWNER,
    sourceSchemaVersion: String(fact.schemaVersion),
    controllerRef: controllerRefFor(`oracle-fact:${fact.feedId}`),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: fact.qualityStatus === 'VERIFIED' ? 'VERIFIED' : 'ATTESTED',
    freshness: fact.qualityStatus === 'STALE' ? 'STALE' : fact.qualityStatus === 'CONFLICTED' ? 'CONFLICTED' : 'CURRENT',
    observedAt: unixToUtc(fact.observationWindow.startUnix),
    validFrom: unixToUtc(fact.observationWindow.startUnix),
    validUntil: unixToUtc(fact.validUntilUnix),
    economicCategory: 'ENERGY',
    contentCommitmentMaterial: `oracle-fact:${fact.factId}:${fact.sourceObservationIds.join(',')}`.slice(0, 256),
    provenanceMaterial: `oracle-fact-prov:${fact.feedId}:${fact.aggregationPolicy}`.slice(0, 256),
    storageClass: 'ON_CHAIN_PUBLIC_METADATA',
    chainAnchor: {
      networkId: networkIdFor('sunrey-simulation'),
      chainId: chainIdFor('net_sunrey_simulation'),
      transactionId: null,
      blockHeight: BigInt(fact.finalizedHeight),
      blockId: null,
      stateRootRef: null,
      contentCommitment: contentCommitmentFor(`oracle-fact:${fact.factId}`),
      anchorType: 'VERIFIED_FACT_COMMITMENT',
      finalityState: fact.finalizedHeight > 0 ? 'FINALIZED_ON_SIMULATION' : 'UNANCHORED',
    },
    status: 'REGISTERED',
    createdAt: at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

function unixToUtc(seconds: bigint): UtcInstant {
  return asUtcInstant(new Date(Number(seconds) * 1000).toISOString());
}

function hasCredentialValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const forbidden = ['apiKey', 'api_key', 'clientSecret', 'oauthClientSecret', 'privateKey', 'hsmPrivate', 'password'];
  for (const key of forbidden) {
    if (key in record && record[key]) {
      return true;
    }
  }
  if ('credentialRef' in record && record.credentialRef && typeof record.credentialRef === 'object') {
    const href = (record.credentialRef as { href?: string }).href;
    if (href && !href.startsWith('secret://')) {
      return true;
    }
  }
  return false;
}
