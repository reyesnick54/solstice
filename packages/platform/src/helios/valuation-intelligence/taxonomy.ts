/**
 * HELIOS Valuation Intelligence — work-package taxonomy (research only).
 */

export const HELIOS_VALUATION_INTELLIGENCE_SCHEMA = 'helios.valuation-intelligence.v1' as const;
export const HELIOS_VALUATION_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/valuation-intelligence' as const;

export const VAL_WORK_PACKAGES = ['VAL02'] as const;
export type ValWorkPackageId = (typeof VAL_WORK_PACKAGES)[number];
