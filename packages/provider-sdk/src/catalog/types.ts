/**
 * Types matching config/providers/free-api-catalog.schema.json.
 */

import type {
  ProviderAuthorityClass,
  ProviderCategory,
  ProviderId,
  ProviderLaunchTier,
  ProviderPriority,
  SunReyConsumerDomain,
} from '../types.ts';

export const CATALOG_ID = 'sunrey-free-api-catalog' as const;
export const EXPECTED_PROVIDER_COUNT = 126;

export type CatalogPopulationStatus = 'awaiting_master_list' | 'populated' | 'partial';

export type CatalogAuthenticationType =
  | 'none'
  | 'api_key'
  | 'oauth'
  | 'bearer_token'
  | 'basic_auth'
  | 'other';

export type CatalogVerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'deprecated'
  | 'unavailable';

export type CatalogFreeAccessStatus =
  | 'verified_free'
  | 'free_tier'
  | 'trial_only'
  | 'unclear'
  | 'no_longer_free';

export type CatalogCommercialUseStatus =
  | 'verified_allowed'
  | 'restricted'
  | 'attribution_required'
  | 'noncommercial_only'
  | 'unclear'
  | 'unknown'
  | 'requires_legal_review';

export type CatalogRedistributionStatus =
  | 'allowed'
  | 'attribution_required'
  | 'restricted'
  | 'prohibited'
  | 'unclear'
  | 'unknown';

export type CatalogProviderEntry = {
  readonly provider_id: ProviderId;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly primary_category: ProviderCategory;
  readonly secondary_categories?: readonly ProviderCategory[];
  readonly capabilities: readonly string[];
  readonly endpoints: {
    readonly base_url: string | null;
    readonly api_version: string | null;
    readonly documentation_url: string | null;
    readonly status_url: string | null;
  };
  readonly authentication: {
    readonly type: CatalogAuthenticationType;
    readonly required: boolean;
    readonly registration_required: boolean;
    readonly environment_variable: string | null;
    readonly notes?: string | null;
  };
  readonly access: {
    readonly status: CatalogFreeAccessStatus;
    readonly free_tier_verified: boolean;
    readonly registration_required: boolean;
    readonly notes?: string | null;
  };
  readonly commercial_use: {
    readonly status: CatalogCommercialUseStatus;
    readonly notes: string | null;
  };
  readonly redistribution: {
    readonly status: CatalogRedistributionStatus;
    readonly notes: string | null;
  };
  readonly rate_limits: {
    readonly documented: boolean;
    readonly requests_per_second: number | null;
    readonly requests_per_minute: number | null;
    readonly requests_per_hour: number | null;
    readonly requests_per_day: number | null;
    readonly monthly_quota: number | null;
    readonly concurrency_limit: number | null;
    readonly notes: string | null;
  };
  readonly data_characteristics: {
    readonly freshness:
      | 'realtime'
      | 'delayed'
      | 'daily'
      | 'weekly'
      | 'monthly'
      | 'historical'
      | null;
    readonly geographic_scope: readonly string[];
    readonly historical_data: boolean | null;
    readonly realtime: boolean | null;
    readonly data_format: string | null;
    readonly notes: string | null;
  };
  readonly sunrey: {
    readonly domain: readonly SunReyConsumerDomain[];
    readonly canonical_provider_interface: string | null;
    readonly priority: ProviderPriority;
    readonly launch_tier: ProviderLaunchTier;
    readonly authority_class: ProviderAuthorityClass;
    readonly integration_state?:
      | 'not_integrated'
      | 'catalog_only'
      | 'simulated'
      | 'sandbox'
      | 'production_candidate'
      | 'implemented'
      | null;
    readonly existing_adapter?: string | null;
  };
  readonly verification: {
    readonly status: CatalogVerificationStatus;
    readonly verified_against_official_docs: boolean;
    readonly last_verified: string | null;
    readonly notes: string | null;
  };
};

export type FreeApiCatalog = {
  readonly schema_version: string;
  readonly catalog_id: typeof CATALOG_ID;
  readonly expected_provider_count: typeof EXPECTED_PROVIDER_COUNT;
  readonly population_status: CatalogPopulationStatus;
  readonly source_list?: {
    readonly document: string | null;
    readonly version: string | null;
    readonly verified_at: string | null;
  } | null;
  readonly notes?: string | null;
  readonly providers: readonly CatalogProviderEntry[];
};

export type CatalogIndex = Readonly<{
  readonly catalog: FreeApiCatalog;
  readonly byId: ReadonlyMap<ProviderId, CatalogProviderEntry>;
}>;
