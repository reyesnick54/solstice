/**
 * Simulation inventory for product reference data paths.
 *
 * Classifies each simulation source. Does not delete test fixtures.
 */

export const SIMULATION_CLASSIFICATIONS = [
  'KEEP_FOR_TEST',
  'KEEP_FOR_DEMO',
  'REPLACE_WITH_LIVE',
  'LIVE_SOURCE_NOT_AVAILABLE',
  'REMOVE_DEAD_PLACEHOLDER',
] as const;
export type SimulationClassification = (typeof SIMULATION_CLASSIFICATIONS)[number];

export type SimulationInventoryEntry = {
  readonly domain: string;
  readonly surface: string;
  readonly currentSource: string;
  readonly classification: SimulationClassification;
  readonly canonicalService: string | null;
  readonly bffRoute: string | null;
  readonly notes: string;
};

export const SIMULATION_INVENTORY: readonly SimulationInventoryEntry[] = Object.freeze([
  entry('World', 'economy macro', 'ExternalDataPlane macro facade', 'REPLACE_WITH_LIVE', 'MacroDataService', '/api/v1/world/economy', 'Facade wired; full sunrey-chain service available'),
  entry('World', 'markets', 'ExternalDataPlane markets facade', 'REPLACE_WITH_LIVE', 'MarketReferenceService', '/api/v1/world/markets', 'Exchange canonical service exists'),
  entry('World', 'fx', 'ExternalDataPlane fx facade', 'REPLACE_WITH_LIVE', 'FxReferenceService', '/api/v1/world/fx', 'Payments canonical service also on /api/v1/fx/reference'),
  entry('World', 'resources lithium', 'none', 'LIVE_SOURCE_NOT_AVAILABLE', 'ResourceDataProvider', '/api/v1/world/resources/lithium', 'Returns UNAVAILABLE — no fabricated price'),
  entry('World', 'environment', 'EnvironmentalOracleService fixtures', 'REPLACE_WITH_LIVE', 'EnvironmentalOracleService', '/api/v1/world/environmental', 'Simulation transport only'),
  entry('Grow', 'opportunities', 'GrowthOrchestrator deterministic', 'KEEP_FOR_DEMO', 'GrowOpportunityPort', '/api/v1/grow/opportunities', 'Internal orchestrator, not provider-backed'),
  entry('Grow', 'external context', 'ExternalDataPlane bridges', 'REPLACE_WITH_LIVE', 'growContextSnapshot', '/api/v1/grow/context', 'Prompt 25 wiring'),
  entry('Exchange', 'market quotes', 'Sandbox BFF helpers', 'KEEP_FOR_DEMO', 'MarketReferenceService', '/api/v1/exchange/markets', 'Reference display only; not execution'),
  entry('Exchange', 'crypto reference', 'Sandbox crypto BFF', 'REPLACE_WITH_LIVE', 'CryptoMarketReferenceService', '/api/v1/markets/crypto', 'Reference only'),
  entry('MoonRey', 'productive metrics', 'ProductiveEconomyDataPlatform', 'REPLACE_WITH_LIVE', 'ProductiveEconomySnapshot', '/api/v1/economy/productive/snapshot', 'Analytics only'),
  entry('Travel', 'overview', 'Environmental travel context', 'REPLACE_WITH_LIVE', 'TravelIntelligenceService', '/api/v1/travel/overview', 'Partial — no dedicated TravelIntelligenceService yet'),
  entry('HIN', 'reference nutrition', 'none', 'LIVE_SOURCE_NOT_AVAILABLE', null, null, 'Public reference not wired; private vault boundary preserved'),
  entry('Action Center', 'external events', 'sampleActionCenterEvents', 'REPLACE_WITH_LIVE', 'Wave2ActionCenterEvent', '/api/v1/agent/external-events', 'Canonical events, no provider subscription'),
  entry('Home', 'aggregation', 'ConsumerBff home', 'KEEP_FOR_DEMO', 'services/accounts', '/api/v1/me/home', 'Ledger-derived balances'),
  entry('Financial Agent', 'evidence', 'agentEvidenceCatalog', 'REPLACE_WITH_LIVE', 'AgentEvidenceCatalog', '/api/v1/agent/external-evidence', 'Evidence only; no execution authority'),
  entry('Tests', 'wave fixtures', 'provider fixture adapters', 'KEEP_FOR_TEST', null, null, 'Required by CI contract tests'),
]);

function entry(
  domain: string,
  surface: string,
  currentSource: string,
  classification: SimulationClassification,
  canonicalService: string | null,
  bffRoute: string | null,
  notes: string,
): SimulationInventoryEntry {
  return Object.freeze({ domain, surface, currentSource, classification, canonicalService, bffRoute, notes });
}

export function inventoryByDomain(domain: string): readonly SimulationInventoryEntry[] {
  return SIMULATION_INVENTORY.filter((row) => row.domain === domain);
}

export function inventoryByClassification(
  classification: SimulationClassification,
): readonly SimulationInventoryEntry[] {
  return SIMULATION_INVENTORY.filter((row) => row.classification === classification);
}
