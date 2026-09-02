/**
 * Wave 4 — versioned ProviderDefinition (credentials never embedded).
 */

import type { CatalogProviderEntry, CatalogAuthenticationType } from '../catalog/types.ts';
import type { ProviderId, SunReyConsumerDomain } from '../registry-types.ts';
import type { ExtensibleSourceClass } from './source-class.ts';
import {
  defaultSourceClassForAuthority,
  assertExtensibleSourceClass,
  isExtensibleSourceClass,
} from './source-class.ts';
import type { EconomicDomain } from './domain-taxonomy.ts';
import { classifyProviderDomains } from './domain-taxonomy.ts';

export const PROVIDER_DEFINITION_SCHEMA_VERSION = 'sunrey.provider-definition.v1' as const;

export const CONNECTOR_TYPES = [
  'REST',
  'GRAPHQL',
  'WEBSOCKET',
  'FILE_BATCH',
  'DATABASE_FEDERATED',
  'EVENT_STREAM',
  'WEBHOOK',
  'SENSOR_IOT_GATEWAY',
  'FIXTURE',
] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const PERSISTENCE_POLICIES = [
  'CACHE_ONLY',
  'SHORT_TERM_CACHE',
  'DERIVED_AGGREGATE_ONLY',
  'NO_PERSISTENCE',
  'ATTRIBUTION_REQUIRED_PERSISTENCE',
] as const;
export type PersistencePolicy = (typeof PERSISTENCE_POLICIES)[number];

export const ENABLED_ENVIRONMENTS = [
  'simulation',
  'sandbox',
  'preview',
  'production_candidate',
] as const;
export type EnabledEnvironment = (typeof ENABLED_ENVIRONMENTS)[number];

export type ProviderLicensePolicy = {
  readonly commercialUse: string;
  readonly redistribution: string;
  readonly attributionRequirement: string | null;
  readonly persistencePolicy: PersistencePolicy;
};

export type ProviderRateLimitSpec = {
  readonly documented: boolean;
  readonly requestsPerSecond: number | null;
  readonly requestsPerMinute: number | null;
  readonly requestsPerHour: number | null;
  readonly requestsPerDay: number | null;
  readonly monthlyQuota: number | null;
  readonly concurrencyLimit: number | null;
  readonly notes: string | null;
};

export type ProviderDefinition = {
  readonly schemaVersion: typeof PROVIDER_DEFINITION_SCHEMA_VERSION;
  readonly providerId: ProviderId;
  readonly providerName: string;
  readonly domain: readonly EconomicDomain[];
  readonly sourceClass: ExtensibleSourceClass;
  readonly providerType: string;
  readonly baseEndpoint: string | null;
  readonly referenceUrl: string | null;
  readonly authType: CatalogAuthenticationType;
  readonly secretEnvironmentVariable: string | null;
  readonly license: ProviderLicensePolicy;
  readonly rateLimit: ProviderRateLimitSpec;
  readonly expectedFreshness: string | null;
  readonly jurisdictions: readonly string[];
  readonly dataCategories: readonly string[];
  readonly productionApproved: boolean;
  readonly enabledEnvironments: readonly EnabledEnvironment[];
  readonly connectorType: ConnectorType;
  readonly sunreyDomains: readonly SunReyConsumerDomain[];
  readonly capabilities: readonly string[];
  readonly integrationState: string | null;
  readonly existingAdapter: string | null;
};

export function mapAuthTypeToConnectorType(authType: CatalogAuthenticationType): ConnectorType {
  return 'REST';
}

export function mapLaunchTierToProductionApproved(launchTier: string): boolean {
  return launchTier === 'production_candidate';
}

export function mapIntegrationToEnvironments(
  integrationState: string | null,
  launchTier: string,
): readonly EnabledEnvironment[] {
  if (launchTier === 'blocked_pending_review') {
    return Object.freeze([]);
  }
  if (integrationState === 'implemented' || integrationState === 'production_candidate') {
    return Object.freeze(['simulation', 'sandbox', 'preview', 'production_candidate']);
  }
  if (integrationState === 'simulated' || integrationState === 'sandbox') {
    return Object.freeze(['simulation', 'sandbox']);
  }
  return Object.freeze(['simulation']);
}

export function mapCommercialToPersistence(commercialStatus: string): PersistencePolicy {
  if (commercialStatus === 'noncommercial_only') {
    return 'NO_PERSISTENCE';
  }
  if (commercialStatus === 'attribution_required' || commercialStatus === 'restricted') {
    return 'ATTRIBUTION_REQUIRED_PERSISTENCE';
  }
  return 'SHORT_TERM_CACHE';
}

export function catalogEntryToProviderDefinition(
  entry: CatalogProviderEntry,
  overrides?: Partial<Pick<ProviderDefinition, 'sourceClass' | 'connectorType' | 'domain'>>,
): ProviderDefinition {
  const sourceClass =
    overrides?.sourceClass ??
    assertExtensibleSourceClass(defaultSourceClassForAuthority(entry.sunrey.authority_class));
  const domains =
    overrides?.domain ??
    classifyProviderDomains(entry.primary_category, entry.secondary_categories ?? []);

  return Object.freeze({
    schemaVersion: PROVIDER_DEFINITION_SCHEMA_VERSION,
    providerId: entry.provider_id,
    providerName: entry.name,
    domain: domains,
    sourceClass,
    providerType: entry.primary_category,
    baseEndpoint: entry.endpoints.base_url,
    referenceUrl: entry.endpoints.documentation_url,
    authType: entry.authentication.type,
    secretEnvironmentVariable: entry.authentication.environment_variable,
    license: Object.freeze({
      commercialUse: entry.commercial_use.status,
      redistribution: entry.redistribution.status,
      attributionRequirement:
        entry.redistribution.status === 'attribution_required' ? entry.name : null,
      persistencePolicy: mapCommercialToPersistence(entry.commercial_use.status),
    }),
    rateLimit: Object.freeze({
      documented: entry.rate_limits.documented,
      requestsPerSecond: entry.rate_limits.requests_per_second,
      requestsPerMinute: entry.rate_limits.requests_per_minute,
      requestsPerHour: entry.rate_limits.requests_per_hour,
      requestsPerDay: entry.rate_limits.requests_per_day,
      monthlyQuota: entry.rate_limits.monthly_quota,
      concurrencyLimit: entry.rate_limits.concurrency_limit,
      notes: entry.rate_limits.notes,
    }),
    expectedFreshness: entry.data_characteristics.freshness,
    jurisdictions: Object.freeze([...entry.data_characteristics.geographic_scope]),
    dataCategories: Object.freeze([...entry.capabilities]),
    productionApproved: mapLaunchTierToProductionApproved(entry.sunrey.launch_tier),
    enabledEnvironments: mapIntegrationToEnvironments(
      entry.sunrey.integration_state ?? null,
      entry.sunrey.launch_tier,
    ),
    connectorType: overrides?.connectorType ?? mapAuthTypeToConnectorType(entry.authentication.type),
    sunreyDomains: Object.freeze([...entry.sunrey.domain]),
    capabilities: Object.freeze([...entry.capabilities]),
    integrationState: entry.sunrey.integration_state ?? null,
    existingAdapter: entry.sunrey.existing_adapter ?? null,
  });
}

export function validateProviderDefinition(definition: ProviderDefinition): void {
  if (definition.schemaVersion !== PROVIDER_DEFINITION_SCHEMA_VERSION) {
    throw new TypeError(`unsupported schemaVersion '${definition.schemaVersion}'`);
  }
  if (!definition.providerId) {
    throw new TypeError('providerId is required');
  }
  if (definition.domain.length === 0) {
    throw new TypeError('domain must not be empty');
  }
  if (!isExtensibleSourceClass(definition.sourceClass)) {
    throw new TypeError(`invalid sourceClass '${definition.sourceClass}'`);
  }
}

export function assertValidProviderDefinition(definition: ProviderDefinition): ProviderDefinition {
  validateProviderDefinition(definition);
  return definition;
}
