/**
 * Documents canonical owners reused by AAF03 — proves no duplicate identity authority.
 */

export const AAF03_CANONICAL_OWNER_REUSE = Object.freeze([
  Object.freeze({
    capability: 'customer_identity',
    owner: 'packages/identity',
    aaf03Usage: 'not used — market entities are distinct from customer ActorContext',
  }),
  Object.freeze({
    capability: 'economic_knowledge_graph_entity_ids',
    owner: 'packages/economic-asset-registry/src/knowledge-graph',
    aaf03Usage: 'issuer/legal-entity nodes link via economicKnowledgeEntityId + helios-temporal-bridge',
  }),
  Object.freeze({
    capability: 'external_identifier_vocabulary',
    owner: 'packages/economic-asset-registry/src/knowledge-graph/types.ts',
    aaf03Usage: 'CIK/LEI/ISIN/provider identifiers reuse ExternalIdentifier',
  }),
  Object.freeze({
    capability: 'market_instrument_registry_m02',
    owner: 'packages/platform/src/helios/market-observation/instrument-registry.ts',
    aaf03Usage: 'instrument ID format aligned; AAF03 adds temporal graph, does not replace M02 registry',
  }),
  Object.freeze({
    capability: 'helios_observation_information_time',
    owner: 'packages/platform/src/helios/observation',
    aaf03Usage: 'knowableAt / effective dating matches observation fabric semantics',
  }),
  Object.freeze({
    capability: 'aaf02_feature_fabric',
    owner: 'packages/platform/src/helios/feature-fabric',
    aaf03Usage: 'features bind canonicalEntityId / canonicalInstrumentId from resolver output',
  }),
]);

export const AAF03_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/identity — SunRey customer identity (not duplicated)',
  'packages/domain LegalEntity — regulated SunRey legal entities only',
  'packages/economic-asset-registry entity-resolution pipeline — productive/human merge plane, not market tickers',
]);
