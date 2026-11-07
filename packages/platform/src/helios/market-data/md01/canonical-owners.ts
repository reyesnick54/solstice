/**
 * MD01 canonical owner reuse — no parallel market-data planes.
 */

export const MD01_CANONICAL_OWNER_REUSE = Object.freeze([
  {
    path: 'packages/provider-sdk/src/market-data-capability/',
    md01Usage: 'Canonical event schema + capability contract',
  },
  {
    path: 'packages/provider-sdk/src/venue/',
    md01Usage: 'Venue normalization → canonical market events',
  },
  {
    path: 'packages/external-data/src/certification/market-data/',
    md01Usage: 'Certification alignment for admitted event kinds',
  },
  {
    path: 'packages/sunrey-exchange/src/market-data/',
    md01Usage: 'Exchange observation contract; not a second price authority',
  },
  {
    path: 'packages/platform/src/helios/observation/',
    md01Usage: 'H08 envelope + information-time + entitlement integration',
  },
  {
    path: 'packages/platform/src/helios/feature-fabric/',
    md01Usage: 'Evidence-time feature compilation from sealed events',
  },
]);

export const MD01_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/market-data-v2 — forbidden parallel package',
  'Second provider registry — reuse provider-sdk registry + external-data catalog',
  'Second Feature Fabric — extend feature-fabric/market-data slice only',
  'Second Exchange — reuse sunrey-exchange market-data owner',
  'Execution Authority — MD01 is MARKET_OBSERVATION_ONLY',
]);
