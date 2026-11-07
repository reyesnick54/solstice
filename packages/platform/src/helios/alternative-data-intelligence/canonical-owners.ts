/**
 * ALT01 canonical owner reuse — no parallel external-data or feature planes.
 */

export const ALT01_CANONICAL_OWNER_REUSE = Object.freeze([
  Object.freeze({
    capability: 'external_data_plane',
    owner: 'packages/external-data',
    alt01Usage: 'Wave 5 physical-economy + Wave 6 jobs/patents/research ingest; ALT01 consumes normalized observations',
  }),
  Object.freeze({
    capability: 'provider_sdk_envelope',
    owner: 'packages/provider-sdk',
    alt01Usage: 'ExternalObservation, provider health, provenance, operational-health',
  }),
  Object.freeze({
    capability: 'aaf02_feature_fabric',
    owner: 'packages/platform/src/helios/feature-fabric',
    alt01Usage: 'alternative-data feature slice extends fabric; revision ledger + coverage tensor + bias sentinel',
  }),
  Object.freeze({
    capability: 'aaf03_entity_resolution',
    owner: 'packages/platform/src/helios/feature-fabric/entity-resolution',
    alt01Usage: 'AlternativeDataEntityLink binds resolved canonical entity/instrument ids',
  }),
  Object.freeze({
    capability: 'aafv2_adaptive_alpha',
    owner: 'packages/platform/src/helios/adaptive-alpha-v2',
    alt01Usage: 'compiler context + mandatory gates; alt-data features feed certification only',
  }),
  Object.freeze({
    capability: 'productive_economy_oracles',
    owner: 'packages/sunrey-chain/src/oracle/production',
    alt01Usage: 'productive measurements remain oracle-owned; ALT01 references observation envelope only',
  }),
  Object.freeze({
    capability: 'provider_catalog',
    owner: 'config/providers',
    alt01Usage: 'free-api-catalog + wave overlays; alternative_data tag preserved',
  }),
]);

export const ALT01_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/external-data — ALT01 does not add a second provider registry',
  'packages/evidence — ALT01 does not add a second Evidence Vault',
  'packages/platform/src/helios/strategy-lab — Strategy Lab consumes features; ALT01 does not fork it',
  'packages/platform/src/helios/feature-fabric/compiler — single PIT compiler owner',
]);
