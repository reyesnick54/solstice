export const EXEC11_CANONICAL_OWNER = 'packages/custody/src/execution-connectivity/exec11/' as const;

export const EXEC11_HELIOS_OWNER = 'packages/platform/src/helios/execution-connectivity/exec11/' as const;

export const EXEC11_RELATED_OWNERS = Object.freeze([
  'packages/custody/src/regulated/',
  'packages/custody/src/provider-candidate/',
  'packages/platform/src/helios/grow-controls/',
]);

export const EXEC11_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/custody-ledger/',
  'packages/withdrawal-engine/',
  'packages/travel-rule-v2/',
]);
