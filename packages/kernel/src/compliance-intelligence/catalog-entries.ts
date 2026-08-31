/**
 * Wave 4 Prompt 15 — compliance intelligence catalog entries.
 *
 * Eligible free/public compliance providers. Production activation follows
 * Wave 0 governance: commercial_use and verification status gate activation.
 */

import type { ComplianceCatalogProviderEntry } from './catalog-types.ts';

export const COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS = [
  'open-sanctions',
  'interpol-red-notices',
] as const;
export type ComplianceIntelligenceCatalogProviderId =
  (typeof COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS)[number];

function complianceProvider(
  overrides: Partial<ComplianceCatalogProviderEntry> & Pick<ComplianceCatalogProviderEntry, 'provider_id' | 'name' | 'short_name' | 'description'>,
): ComplianceCatalogProviderEntry {
  return Object.freeze({
    primary_category: 'compliance',
    secondary_categories: Object.freeze([]),
    capabilities: Object.freeze(['sanctions', 'pep_screening', 'watchlists']),
    endpoints: Object.freeze({
      base_url: null,
      api_version: null,
      documentation_url: null,
      status_url: null,
    }),
    authentication: Object.freeze({
      type: 'none' as const,
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: null,
    }),
    access: Object.freeze({
      status: 'verified_free' as const,
      free_tier_verified: true,
      registration_required: false,
      notes: null,
    }),
    commercial_use: Object.freeze({
      status: 'verified_allowed' as const,
      notes: null,
    }),
    redistribution: Object.freeze({
      status: 'attribution_required' as const,
      notes: null,
    }),
    rate_limits: Object.freeze({
      documented: true,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: 'Simulation uses fixtures only; respect provider quotas in production.',
    }),
    data_characteristics: Object.freeze({
      freshness: 'daily',
      geographic_scope: Object.freeze(['GLOBAL']),
      historical_data: true,
      realtime: false,
      data_format: 'json',
      notes: null,
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['compliance', 'world', 'exchange', 'financial_agent']),
      canonical_provider_interface: 'ComplianceIntelligenceProvider',
      priority: 'critical',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/kernel/src/compliance-intelligence/adapters/index.ts',
    }),
    verification: Object.freeze({
      status: 'verified' as const,
      verified_against_official_docs: true,
      last_verified: '2026-08-30',
      notes: 'Wave 4 Prompt 15 compliance intelligence subset.',
    }),
    ...overrides,
  });
}

export const COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES: readonly ComplianceCatalogProviderEntry[] = Object.freeze([
  complianceProvider({
    provider_id: 'open-sanctions',
    name: 'OpenSanctions',
    short_name: 'OpenSanctions',
    description:
      'Open database of sanctions, PEPs, and watchlists aggregating OFAC, UN, EU, UK, and national lists. ' +
      'Bulk data is CC BY-NC 4.0; commercial screening requires a paid license.',
    capabilities: Object.freeze([
      'sanctions',
      'pep_screening',
      'watchlists',
      'adverse_regulatory_data',
      'entity_resolution',
    ]),
    endpoints: Object.freeze({
      base_url: 'https://api.opensanctions.org',
      api_version: 'v1',
      documentation_url: 'https://www.opensanctions.org/docs/api/',
      status_url: 'https://www.opensanctions.org/',
    }),
    authentication: Object.freeze({
      type: 'api_key',
      required: false,
      registration_required: false,
      environment_variable: 'OPENSANCTIONS_API_KEY',
      notes: 'Optional API key for higher limits; bulk non-commercial use does not require a key.',
    }),
    access: Object.freeze({
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: false,
      notes: 'Free for non-commercial use; API trial keys available for evaluation.',
    }),
    commercial_use: Object.freeze({
      status: 'restricted',
      notes:
        'CC BY-NC 4.0 for bulk data. Commercial compliance screening requires paid license. ' +
        'Production activation blocked pending legal review.',
    }),
    redistribution: Object.freeze({
      status: 'attribution_required',
      notes: 'OpenSanctions attribution required per dataset terms.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['compliance', 'world', 'exchange', 'financial_agent']),
      canonical_provider_interface: 'ComplianceIntelligenceProvider',
      priority: 'critical',
      launch_tier: 'blocked_pending_review',
      authority_class: 'reference_data',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/kernel/src/compliance-intelligence/adapters/open-sanctions.ts',
    }),
    verification: Object.freeze({
      status: 'partially_verified',
      verified_against_official_docs: true,
      last_verified: '2026-08-30',
      notes: 'Commercial use restricted; adapter is preview_only until counsel confirms license.',
    }),
  }),
  complianceProvider({
    provider_id: 'interpol-red-notices',
    name: 'INTERPOL Red Notices',
    short_name: 'INTERPOL',
    description:
      'Public INTERPOL Red Notices API for wanted-person lookups. Distinct from sanctions lists; ' +
      'wanted status is a separate evidence classification.',
    capabilities: Object.freeze(['wanted_persons', 'watchlists', 'public_enforcement_data']),
    endpoints: Object.freeze({
      base_url: 'https://ws-public.interpol.int',
      api_version: 'v1',
      documentation_url: 'https://interpol.api.bund.dev/',
      status_url: null,
    }),
    authentication: Object.freeze({
      type: 'none',
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: 'Public unauthenticated API.',
    }),
    access: Object.freeze({
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: false,
      notes: 'Public API; no authentication required.',
    }),
    commercial_use: Object.freeze({
      status: 'verified_allowed',
      notes: 'Public law-enforcement notices API; use for screening evidence only.',
    }),
    redistribution: Object.freeze({
      status: 'attribution_required',
      notes: 'INTERPOL data usage subject to INTERPOL terms; evidence references only in SunRey.',
    }),
    sunrey: Object.freeze({
      domain: Object.freeze(['compliance', 'world']),
      canonical_provider_interface: 'ComplianceIntelligenceProvider',
      priority: 'high',
      launch_tier: 'production_candidate',
      authority_class: 'authoritative_official',
      integration_state: 'adapter_implemented',
      existing_adapter: 'packages/kernel/src/compliance-intelligence/adapters/interpol-red-notices.ts',
    }),
    verification: Object.freeze({
      status: 'verified',
      verified_against_official_docs: true,
      last_verified: '2026-08-30',
      notes: 'Public Red Notices API; wanted-person classification separate from sanctions.',
    }),
  }),
]);
