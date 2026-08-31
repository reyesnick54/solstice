/**
 * ACCESS Wave 2 Prompt 31 — catalog entries for new discovery providers.
 */

export const ACCESS_DISCOVERY_CATALOG_ENTRIES = Object.freeze([
  Object.freeze({
    provider_id: 'gbfs',
    name: 'GBFS Shared Mobility Feeds',
    primary_category: 'mobility',
    capabilities: Object.freeze([
      'gbfs_system_information',
      'gbfs_station_information',
      'gbfs_station_status',
      'gbfs_vehicle_types',
      'gbfs_pricing_plans',
    ]),
    integration_state: 'simulated',
    existing_adapter: 'packages/sunrey-chain/src/access-discovery/adapters/fixture-adapters.ts',
  }),
  Object.freeze({
    provider_id: 'national-park-service',
    name: 'U.S. National Park Service Developer API',
    primary_category: 'experiences',
    capabilities: Object.freeze([
      'nps_parks',
      'nps_events',
      'nps_campgrounds',
      'nps_alerts',
      'nps_visitor_information',
    ]),
    integration_state: 'simulated',
    existing_adapter: 'packages/sunrey-chain/src/access-discovery/adapters/fixture-adapters.ts',
  }),
  Object.freeze({
    provider_id: 'recreation-gov-ridb',
    name: 'Recreation.gov RIDB',
    primary_category: 'experiences',
    capabilities: Object.freeze([
      'ridb_campgrounds',
      'ridb_facilities',
      'ridb_tours',
      'ridb_activities',
      'ridb_permit_metadata',
    ]),
    integration_state: 'simulated',
    existing_adapter: 'packages/sunrey-chain/src/access-discovery/adapters/fixture-adapters.ts',
  }),
]);
