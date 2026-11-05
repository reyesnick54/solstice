/** HELIOS Valuation Intelligence — canonical owner and schema identifiers. */

export const HELIOS_VALUATION_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/valuation-intelligence' as const;

export const HELIOS_VALUATION_INTELLIGENCE_SCHEMA = 'sunrey.helios.valuation-intelligence.v1' as const;

export const VAL_WORK_PACKAGES = Object.freeze([
  'VAL04',
] as const);

export type ValWorkPackageId = (typeof VAL_WORK_PACKAGES)[number];
