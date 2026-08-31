/**
 * Wave 5 Prompt 20 — travel / mobility catalog entries.
 */

import type { CatalogProviderEntry } from '../../../provider-sdk/src/catalog/types.ts';

function travelProvider(
  provider_id: string,
  name: string,
  short_name: string,
  description: string,
  primary_category: CatalogProviderEntry['primary_category'],
  capabilities: readonly string[],
): CatalogProviderEntry {
  return Object.freeze({
    provider_id,
    name,
    short_name,
    description,
    primary_category,
    secondary_categories: [],
    capabilities: [...capabilities],
    endpoints: {
      base_url: `https://api.example.com/${provider_id}`,
      api_version: 'v1',
      documentation_url: `https://docs.example.com/${provider_id}`,
      status_url: null,
    },
    authentication: {
      type: 'none',
      required: false,
      registration_required: false,
      environment_variable: null,
      notes: null,
    },
    access: {
      status: 'verified_free',
      free_tier_verified: true,
      registration_required: false,
      notes: null,
    },
    commercial_use: { status: 'unknown', notes: null },
    redistribution: { status: 'attribution_required', notes: null },
    rate_limits: {
      documented: false,
      requests_per_second: null,
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null,
      monthly_quota: null,
      concurrency_limit: null,
      notes: null,
    },
    data_characteristics: {
      freshness: 'delayed',
      geographic_scope: ['global'],
      historical_data: false,
      realtime: false,
      data_format: 'json',
      notes: null,
    },
    sunrey: {
      domain: ['travel', 'world'] as const,
      canonical_provider_interface: 'TravelProvider',
      priority: 'medium',
      launch_tier: 'production_candidate',
      authority_class: 'reference_data',
      integration_state: 'simulated',
      existing_adapter: 'packages/sunrey-chain/src/travel-intelligence/adapters/fixture-adapters.ts',
    },
    verification: {
      status: 'verified',
      verified_against_official_docs: true,
      last_verified: '2026-08-31',
      notes: 'Wave 5 Prompt 20 fixture adapter.',
    },
  }) as CatalogProviderEntry;
}

export const TRAVEL_CATALOG_ENTRIES: readonly CatalogProviderEntry[] = Object.freeze([
  travelProvider('opensky', 'OpenSky Network', 'OpenSky', 'ADS-B aircraft state vectors.', 'aviation', [
    'aviation_positions',
    'aircraft_position',
    'flight_reference',
  ]),
  travelProvider('faa-registry', 'FAA Aircraft Registry', 'FAA Registry', 'N-Number registration.', 'aviation', [
    'aircraft_registry',
    'flight_reference',
  ]),
  travelProvider('aviationapi', 'AviationAPI', 'AviationAPI', 'Airport and flight reference.', 'aviation', [
    'airport_information',
    'flight_reference',
  ]),
  travelProvider('can-i-enter', 'Can I Enter', 'Can I Enter', 'Visa and entry requirements.', 'travel', [
    'entry_requirements',
    'visa_entry',
  ]),
  travelProvider('transport-rest', 'Transport.rest', 'Transport.rest', 'Swiss public transport.', 'transportation', [
    'public_transit',
    'transit_route',
    'transit_departure',
  ]),
  travelProvider('transitland', 'TransitLand', 'TransitLand', 'Global transit feeds.', 'transportation', [
    'public_transit',
    'transit_route',
    'transit_departure',
  ]),
  travelProvider('open-charge-map', 'Open Charge Map', 'OCM', 'EV charging locations.', 'transportation', [
    'ev_charging',
    'mobility_status',
  ]),
  travelProvider('bc-ferries', 'BC Ferries', 'BC Ferries', 'BC ferry schedules.', 'transportation', [
    'public_transit',
    'transit_route',
    'transit_departure',
  ]),
  travelProvider('entur', 'Entur', 'Entur', 'Norway public transport.', 'transportation', [
    'public_transit',
    'transit_route',
    'transit_departure',
    'mobility_status',
  ]),
]);

export function catalogEntryForProvider(providerId: string): CatalogProviderEntry | undefined {
  return TRAVEL_CATALOG_ENTRIES.find((e) => e.provider_id === providerId);
}
