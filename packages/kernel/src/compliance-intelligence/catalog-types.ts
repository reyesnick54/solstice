/**
 * Local catalog entry shape for compliance intelligence — avoids kernel → provider-sdk dependency.
 */

export const COMPLIANCE_CATALOG_ID = 'sunrey-free-api-catalog';
export const COMPLIANCE_EXPECTED_PROVIDER_COUNT = 126;

export type ComplianceAuthorityClass =
  | 'authoritative_official'
  | 'regulated_provider'
  | 'reference_data'
  | 'research_data'
  | 'community_data'
  | 'derived_data';

export type ComplianceCatalogProviderEntry = {
  readonly provider_id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly primary_category: string;
  readonly secondary_categories?: readonly string[];
  readonly capabilities: readonly string[];
  readonly endpoints: {
    readonly base_url: string | null;
    readonly api_version: string | null;
    readonly documentation_url: string | null;
    readonly status_url: string | null;
  };
  readonly authentication: {
    readonly type: string;
    readonly required: boolean;
    readonly registration_required: boolean;
    readonly environment_variable: string | null;
    readonly notes: string | null;
  };
  readonly access: {
    readonly status: string;
    readonly free_tier_verified: boolean;
    readonly registration_required: boolean;
    readonly notes: string | null;
  };
  readonly commercial_use: {
    readonly status: string;
    readonly notes: string | null;
  };
  readonly redistribution: {
    readonly status: string;
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
    readonly freshness: string | null;
    readonly geographic_scope: readonly string[];
    readonly historical_data: boolean;
    readonly realtime: boolean;
    readonly data_format: string | null;
    readonly notes: string | null;
  };
  readonly sunrey: {
    readonly domain: readonly string[];
    readonly canonical_provider_interface: string;
    readonly priority: string;
    readonly launch_tier: string;
    readonly authority_class: ComplianceAuthorityClass;
    readonly integration_state: string;
    readonly existing_adapter: string | null;
  };
  readonly verification: {
    readonly status: string;
    readonly verified_against_official_docs: boolean;
    readonly last_verified: string | null;
    readonly notes: string | null;
  };
};

export type ComplianceCatalogIndex = {
  readonly byId: ReadonlyMap<string, ComplianceCatalogProviderEntry>;
};

export function buildComplianceCatalogIndex(
  entries: readonly ComplianceCatalogProviderEntry[],
): ComplianceCatalogIndex {
  const byId = new Map<string, ComplianceCatalogProviderEntry>();
  for (const entry of entries) {
    byId.set(entry.provider_id, entry);
  }
  return Object.freeze({ byId });
}
