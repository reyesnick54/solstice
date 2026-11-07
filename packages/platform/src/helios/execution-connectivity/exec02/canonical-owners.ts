export const EXEC02_CANONICAL_OWNER = 'packages/provider-sdk/src/broker-execution-capability/' as const;

export const EXEC02_HELIOS_OWNER = 'packages/platform/src/helios/execution-connectivity/exec02/' as const;

export const EXEC02_RELATED_OWNERS = Object.freeze([
  'packages/platform/src/helios/order-lifecycle/',
  'packages/platform/src/helios/provider-orchestration/',
]);

export const EXEC02_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/investments/',
  'packages/sunrey-exchange/',
  'services/accounts/',
]);
