/**
 * Chunk 126 — explicit MoonRey value-path identities.
 *
 * V2 code existing in the repository is not production economics.
 * The production path remains UNCONFIGURED until later governance
 * configures production parameters. Tests cannot activate V2.
 */

export const LEGACY_ENGINEERING_SIMULATION_V1 = 'LEGACY_ENGINEERING_SIMULATION_V1' as const;
export const GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2 = 'GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2' as const;
export const PRODUCTION_VALUE_PATH = 'UNCONFIGURED' as const;

export type MoonReyValuePathIdentity =
  | typeof LEGACY_ENGINEERING_SIMULATION_V1
  | typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2
  | typeof PRODUCTION_VALUE_PATH;

export const SHADOW_MODE = true as const;
export const CANONICAL_SUPPLY_MUTATED = false as const;
export const V2_PRODUCTION_ACTIVE = false as const;
export const LEGACY_V1_REMOVED = false as const;
export const PRODUCTION_MIGRATION_APPROVED = false as const;
export const V2_PRODUCTION_ACTIVATION_PATH_EXISTS = false as const;

export const SHADOW_EVALUATION_CONSTITUTION_ID = 'moonrey-v2-shadow-economics' as const;
export const SHADOW_EVALUATION_CONSTITUTION_VERSION = '1' as const;
export const SHADOW_CONVERSION_POLICY_ID = 'moonrey.gpuv-moonrey.shadow-conversion.v1' as const;
export const SHADOW_CONVERSION_POLICY_VERSION = 1 as const;
export const SHADOW_VALUE_RECEIPT_SCHEMA = 'moonrey.v2.shadow-receipt.v1' as const;
export const V1_RECEIPT_SCHEMA = 'moonrey.v1.legacy-receipt.v1' as const;

export const VALUE_PATH_IDENTITIES = Object.freeze({
  v1: LEGACY_ENGINEERING_SIMULATION_V1,
  v2: GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  production: PRODUCTION_VALUE_PATH,
  shadowMode: SHADOW_MODE,
  canonicalSupplyMutated: CANONICAL_SUPPLY_MUTATED,
  v2ProductionActive: V2_PRODUCTION_ACTIVE,
  legacyV1Removed: LEGACY_V1_REMOVED,
  productionMigrationApproved: PRODUCTION_MIGRATION_APPROVED,
  v2ProductionActivationPathExists: V2_PRODUCTION_ACTIVATION_PATH_EXISTS,
  classification: 'ENGINEERING_ECONOMIC_SIMULATION',
  notMarketForecast: true,
  notProductionEconomics: true,
});

/**
 * There is no code path that flips V2 into production because tests
 * passed. Activation requires later explicit human/governance
 * authorization and configured production economics.
 */
export function productionActivationAuthorized(): false {
  return false;
}

export function isProductionValuePath(path: string): path is typeof PRODUCTION_VALUE_PATH {
  return path === PRODUCTION_VALUE_PATH;
}

export function isLegacyV1(path: string): path is typeof LEGACY_ENGINEERING_SIMULATION_V1 {
  return path === LEGACY_ENGINEERING_SIMULATION_V1;
}

export function isGovernedV2(path: string): path is typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2 {
  return path === GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2;
}
