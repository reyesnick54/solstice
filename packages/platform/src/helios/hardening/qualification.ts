/**
 * HEALTH02 — strict TypeScript qualification for the HELIOS investment/research scope.
 */

export const HELIOS_STRICT_TYPECHECK_QUALIFIED = 'HELIOS_STRICT_TYPECHECK_QUALIFIED' as const;
export const HELIOS_STRICT_TYPECHECK_BLOCKED = 'HELIOS_STRICT_TYPECHECK_BLOCKED' as const;

export type HeliosStrictTypecheckMarker =
  | typeof HELIOS_STRICT_TYPECHECK_QUALIFIED
  | typeof HELIOS_STRICT_TYPECHECK_BLOCKED;

export const HELIOS_STRICT_TYPECHECK_SCOPE = Object.freeze([
  'packages/platform/src/helios/',
  'packages/strategy-lab/',
  'packages/agentic-capital-mesh/',
  'packages/external-data/',
  'packages/provider-sdk/',
  'packages/ai-runtime/',
] as const);

export type HeliosStrictTypecheckScopePath = (typeof HELIOS_STRICT_TYPECHECK_SCOPE)[number];
