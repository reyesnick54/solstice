/**
 * HELIOS Open-Source Integration Wave 1 — OS15 qualification taxonomies.
 * Simulation-only; does not enable live connectivity or third-party execution.
 */

export const HELIOS_OPEN_SOURCE_INTEGRATION_SCHEMA =
  'sunrey.helios.open-source-integration.v1' as const;

export const HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED =
  'HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED' as const;

export const HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED =
  'HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED' as const;

export const OPEN_SOURCE_WORK_PACKAGE_IDS = Object.freeze([
  'OS00',
  'OS01',
  'OS02',
  'OS03',
  'OS04',
  'OS05',
  'OS06',
  'OS07',
  'OS08',
  'OS09',
  'OS10',
  'OS11',
  'OS12',
  'OS13',
  'OS14',
  'OS15',
] as const);

export type OpenSourceWorkPackageId = (typeof OPEN_SOURCE_WORK_PACKAGE_IDS)[number];

export type OpenSourceWorkPackageStatus =
  | 'QUALIFIED'
  | 'IMPLEMENTED'
  | 'BLOCKED'
  | 'EXTERNAL_DEPENDENCY';

export type PlatformQualificationGateId =
  | 'architecture_lint'
  | 'production_safety'
  | 'typecheck'
  | 'repository_tests'
  | 'helios_boundary'
  | 'aaf_qualification'
  | 'database_migrations'
  | 'package_boundaries'
  | 'security_scan'
  | 'live_safety'
  | 'canonical_authority'
  | 'third_party_provenance'
  | 'system_demo'
  | 'open_source_work_packages';
