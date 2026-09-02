/**
 * Pre-Wave 5 productive asset identity audit (Task 1).
 */

export const PRODUCTIVE_ASSET_IDENTITY_AUDIT = Object.freeze({
  schemaVersion: 'sunrey.productive.asset-identity.audit.v1',
  auditedAtUtc: '2026-09-02T00:00:00.000Z',
  surfaces: Object.freeze([
    Object.freeze({
      surface: 'ProductiveAssetRegistry (economy-data)',
      identifiers: ['resourceId'],
      durable: false,
      weakness: 'provider-scoped sandbox resource ids; no cross-provider alias resolution',
    }),
    Object.freeze({
      surface: 'ProductiveEconomicObject (productive/objects)',
      identifiers: ['objectId', 'owner', 'controller', 'operator', 'geography.geographyId'],
      durable: false,
      weakness: 'objectId is owner-registry scoped; no durable alias graph',
    }),
    Object.freeze({
      surface: 'ProductiveResourceRecord (economy-data/types)',
      identifiers: ['resourceId', 'ownerRef', 'operatorRef', 'location.jurisdiction'],
      durable: false,
      weakness: 'lifecycle limited to REGISTERED/ACTIVE/SUSPENDED/RETIRED; no alias registry',
    }),
    Object.freeze({
      surface: 'Economic proof entity identity (economic-proof/entity-identity)',
      identifiers: ['canonicalEntityId', 'entityCommitment'],
      durable: true,
      weakness: 'human alias resolver fixtures only; productive assets not modeled',
    }),
    Object.freeze({
      surface: 'Wave 5 PEG snapshot (external-data/wave5-peg)',
      identifiers: ['nodeId derived from observation labels'],
      durable: false,
      weakness: 'projection nodes are observation-derived, not canonical facility identity',
    }),
    Object.freeze({
      surface: 'Economic Asset Registry adapter (productive/economic-asset-adapter)',
      identifiers: ['assetId from master registry projection'],
      durable: true,
      weakness: 'metadata/rights registry; not a productive facility resolver',
    }),
  ]),
  wave5Adds: Object.freeze([
    'CanonicalProductiveAsset with productiveAssetId P-######',
    'ProductiveAssetAliasRegistry preserving every source-specific alias',
    'Deterministic fingerprinting without raw sensitive payloads',
    'Identity confidence EXACT/PROBABLE/POSSIBLE/CONFLICT/NO_MATCH',
    'Hierarchy with explicit rollup lineage',
    'Lifecycle-aware production attribution guards',
    'Snapshot/restore persistence',
  ]),
});
