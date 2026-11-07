/**
 * ALT15 — canonical implementation owners for ALT01–ALT14 (current-main integration).
 */

export type CanonicalAltModuleRow = {
  readonly packageId: string;
  readonly capability: string;
  readonly implementationOwner: string;
  readonly entryModule: string;
  readonly qualificationTest?: string;
};

export const CANONICAL_ALT_MODULES: readonly CanonicalAltModuleRow[] = Object.freeze([
  Object.freeze({
    packageId: 'ALT01',
    capability: 'Canonical alternative-data feature fabric',
    implementationOwner: 'packages/platform/src/helios/feature-fabric/alternative-data',
    entryModule: 'packages/platform/src/helios/feature-fabric/alternative-data/index.ts',
    qualificationTest: 'tests/helios-alt01-canonical-alternative-data-fabric.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT02',
    capability: 'Rights, provenance, and ingestion firewall',
    implementationOwner:
      'packages/provider-sdk/src/alternative-data-rights; packages/external-data/src/alternative-data-rights; packages/platform/src/helios/adaptive-alpha-fabric/alt02',
    entryModule: 'packages/provider-sdk/src/alternative-data-rights/index.ts',
    qualificationTest: 'tests/helios-alt02-data-rights-firewall.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT03',
    capability: 'Entity and asset resolution graph',
    implementationOwner: 'packages/platform/src/helios/alternative-data/alt03-entity-asset-graph',
    entryModule: 'packages/platform/src/helios/alternative-data/alt03-entity-asset-graph/index.ts',
    qualificationTest: 'tests/helios-alt03-entity-asset-graph.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT04',
    capability: 'Workforce and hiring intelligence',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/alt04-workforce',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt04-workforce/index.ts',
    qualificationTest: 'tests/helios-alt04-workforce-intelligence.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT05',
    capability: 'Digital demand and attention intelligence',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/alt05',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt05/index.ts',
    qualificationTest: 'tests/helios-alt05-digital-demand.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT06',
    capability: 'Product, pricing, and availability intelligence',
    implementationOwner:
      'packages/platform/src/helios/alternative-data/alt06; packages/external-data/src/product-demand',
    entryModule: 'packages/platform/src/helios/alternative-data/alt06/index.ts',
    qualificationTest: 'tests/helios-alt06-product-demand.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT07',
    capability: 'Maritime, logistics, and commodity flow intelligence',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow/index.ts',
    qualificationTest: 'tests/helios-alt07-logistics-flow.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT08',
    capability: 'Geospatial and satellite activity intelligence',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/geospatial-activity',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/geospatial-activity/index.ts',
    qualificationTest: 'tests/helios-alt08-geospatial-activity.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT09',
    capability: 'Patent, technology, and commercialization intelligence',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/alt09',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt09/index.ts',
    qualificationTest: 'tests/helios-alt09-innovation-intelligence-qualification.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT10',
    capability: 'Government procurement and contract intelligence',
    implementationOwner:
      'packages/platform/src/helios/procurement-intelligence; packages/external-data/src/procurement',
    entryModule: 'packages/platform/src/helios/procurement-intelligence/index.ts',
    qualificationTest: 'tests/helios-alt10-procurement-intelligence.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT11',
    capability: 'Supply-chain knowledge graph and risk propagation',
    implementationOwner: 'packages/platform/src/helios/alternative-data/alt11-supply-chain-graph',
    entryModule: 'packages/platform/src/helios/alternative-data/alt11-supply-chain-graph/index.ts',
    qualificationTest: 'tests/helios-alt11-supply-chain-graph.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT12',
    capability: 'Missing-aware multimodal fusion and signal routing',
    implementationOwner: 'packages/platform/src/helios/alternative-data-intelligence/alt12',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt12/index.ts',
    qualificationTest: 'tests/helios-alt12-multimodal-fusion.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT13',
    capability: 'Incremental information and redundancy assessment',
    implementationOwner: 'packages/platform/src/helios/alternative-data/alt13',
    entryModule: 'packages/platform/src/helios/alternative-data/alt13/index.ts',
    qualificationTest: 'tests/helios-alt13-incremental-information.test.ts',
  }),
  Object.freeze({
    packageId: 'ALT14',
    capability: 'Agentic research mesh and stack final qualification',
    implementationOwner:
      'packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts; packages/agentic-capital-mesh/src/alternative-data-research-alt14',
    entryModule: 'packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts',
    qualificationTest: 'tests/helios-alt14-alternative-data-qualification.test.ts',
  }),
]);
