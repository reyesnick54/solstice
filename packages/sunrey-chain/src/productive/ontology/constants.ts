/**
 * Wave 5 — MoonRey Productive Economy ontology invariants.
 *
 * These constants mirror economy-data and value-function boundaries.
 * Observations, events, claims, GPUV, and market price remain distinct
 * from MoonRey supply policy.
 */

export const PRODUCTIVE_ONTOLOGY_ID = 'sunrey.productive-economy-ontology' as const;
export const PRODUCTIVE_ONTOLOGY_VERSION = '1' as const;

export const OBSERVATION_CANNOT_MINT = true as const;
export const SINGLE_SOURCE_IS_NOT_CONSENSUS = true as const;
export const CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED = true as const;
export const GPUV_IS_NOT_MOONREY = true as const;
export const GPUV_IS_NOT_MARKET_PRICE = true as const;
export const PRODUCTIVE_VALUE_IS_NOT_SUPPLY_POLICY = true as const;
export const SUPPLY_POLICY_IS_NOT_EXCHANGE_PRICE = true as const;
export const ORACLE_CANNOT_MINT = true as const;

export const PRODUCTIVE_ONTOLOGY_INVARIANTS = Object.freeze({
  OBSERVATION_CANNOT_MINT,
  SINGLE_SOURCE_IS_NOT_CONSENSUS,
  CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED,
  GPUV_IS_NOT_MOONREY,
  GPUV_IS_NOT_MARKET_PRICE,
  PRODUCTIVE_VALUE_IS_NOT_SUPPLY_POLICY,
  SUPPLY_POLICY_IS_NOT_EXCHANGE_PRICE,
  ORACLE_CANNOT_MINT,
});
