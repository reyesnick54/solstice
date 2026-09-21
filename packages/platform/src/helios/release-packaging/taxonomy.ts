export const HELIOS_RELEASE_PACKAGE_SCHEMA = 'helios.release.package.v1' as const;

export const HELIOS_RELEASE_PACKAGE_QUALIFIED = 'HELIOS_RELEASE_PACKAGE_QUALIFIED' as const;
export const HELIOS_RELEASE_PACKAGE_BLOCKED = 'HELIOS_RELEASE_PACKAGE_BLOCKED' as const;

export const HELIOS_RELEASE_WORK_PACKAGE = 'H34' as const;
export const HELIOS_RELEASE_SEQUENCE = 'H01-H33,M01-M28' as const;

export const HELIOS_DEPLOYMENT_MANIFEST_VERSION = 'deploy/sunrey-sandbox-hetzner/v1' as const;

/** Derived from packages/strategy-lab STRATEGY_COMPILER_VERSION — do not invent. */
export const HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION = 'strategy-compiler-v1' as const;

export const ROLLBACK_STATES = [
  'SAFE_APP_ROLLBACK',
  'FORWARD_FIX_REQUIRED',
  'DATABASE_RESTORE_REQUIRED',
  'MANUAL_REVIEW_REQUIRED',
] as const;

export type RollbackState = (typeof ROLLBACK_STATES)[number];

export const ROLLBACK_LEVELS = ['LEVEL_1_APPLICATION', 'LEVEL_2_CONFIGURATION', 'LEVEL_3_DATABASE'] as const;

export type RollbackLevel = (typeof ROLLBACK_LEVELS)[number];
