/**
 * HELIOS alternative data intelligence — work package taxonomy.
 */

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/alternative-data-intelligence' as const;

export const ALT_WORK_PACKAGES = [
  'ALT07',
] as const;

export type AltWorkPackageId = (typeof ALT_WORK_PACKAGES)[number];
