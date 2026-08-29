/**
 * Canonical SunRey Access Fabric identity (ACCESS-02 foundation).
 *
 * The Access Fabric orchestrates discovery and entitlement over canonical
 * productive-economy owners. It does not own productive truth, act as an
 * oracle, or mint MoonRey.
 */

export const ACCESS_FABRIC_SCHEMA = 'sunrey.access-fabric.v1' as const;
export const ACCESS_FABRIC_CHUNK = 'ACCESS-02' as const;

export const CANONICAL_ACCESS_FABRIC = Object.freeze({
  id: 'sunrey.access-fabric.v1',
  owner: 'packages/sunrey-access-fabric',
  authoritativePath: 'packages/sunrey-access-fabric/src/index.ts',
  secondAccessFabricForbidden: true,
  ownsProductiveTruth: false,
  isOracle: false,
  canMintMoonRey: false,
  canIssueExecutionAuthority: false,
  productionActive: false,
  liveProviderConnected: false,
  simulationOnly: true,
});

export const ACCESS_FABRIC_INVARIANTS = Object.freeze({
  QUERY_DOES_NOT_CREATE_CAPACITY: true,
  MARKETING_WITHOUT_PROVENANCE_IS_REJECTED: true,
  STALE_EVIDENCE_IS_REJECTED: true,
  ZERO_OR_NEGATIVE_CAPACITY_IS_REJECTED: true,
  CAPACITY_IS_NOT_OUTPUT: true,
  AVAILABILITY_IS_NOT_UTILIZATION: true,
});
