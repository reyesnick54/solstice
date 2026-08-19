/**
 * Chunk 123 — Governed MoonRey Productive Value Function constitution.
 *
 * This is the policy architecture that will replace simplistic Chunk 44
 * simulation weights. It does not mint MoonRey, does not become a second
 * monetary authority, and does not compute a final value in this chunk.
 *
 * Canonical owner remains packages/sunrey-chain policy-governance.
 */

export const PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_ID =
  'moonrey-productive-value-function-constitution' as const;
export const PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION = '1' as const;
export const PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION = 1 as const;
export const PRODUCTIVE_VALUE_FUNCTION_DOMAIN = 'SUNREY_MOONREY_VALUE_FUNCTION_V1' as const;

export const PHYSICAL_MEASUREMENT_IS_NOT_PRODUCTIVE_ECONOMIC_VALUE = true as const;
export const PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE = true as const;
export const PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY = true as const;
export const PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT = true as const;
export const PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_CREATE_MONETARY_AUTHORITY = true as const;
export const ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE = true as const;
export const CAPACITY_ALONE_IS_NOT_REALIZED_OUTPUT = true as const;
export const REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE = true as const;
export const AI_FINAL_ECONOMIC_POLICY_AUTHORITY_FORBIDDEN = true as const;
export const PRODUCTION_VALUE_POLICY_ACTIVE = false as const;
export const PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED = false as const;
export const PRODUCTIVE_VALUE_FUNCTION_CAN_MINT = false as const;
export const PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT = false as const;
export const PRODUCTIVE_VALUE_UNIT_IS_MOONREY = false as const;
export const PRODUCTIVE_VALUE_UNIT_IS_FIAT = false as const;
export const ATTRIBUTION_REQUIRED = true as const;
export const MOONREY_PRICE_SELF_REFERENCE_FORBIDDEN = true as const;

/**
 * Chunk 124 engine-era status. Distinct from the Chunk 123
 * constitution-era `PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED`
 * marker. Engineering implementation is not production activation.
 */
export const PRODUCTIVE_VALUE_ENGINE_SCHEMA_VERSION = 1 as const;
export const PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED = true as const;
export const PRODUCTIVE_VALUE_ENGINE_SIMULATION_AVAILABLE = true as const;
export const PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED = false as const;
export const PRODUCTIVE_VALUE_ENGINE_PRODUCTION_POLICY_CONFIGURED = false as const;
export const PRODUCTIVE_VALUE_ENGINE_CAN_MINT = false as const;
export const PRODUCTIVE_VALUE_ENGINE_CAN_CREATE_MONETARY_AUTHORITY = false as const;

export const PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION = Object.freeze({
  constitutionId: PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_ID,
  constitutionVersion: PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION,
  schemaVersion: PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION,
  domain: PRODUCTIVE_VALUE_FUNCTION_DOMAIN,
  PHYSICAL_MEASUREMENT_IS_NOT_PRODUCTIVE_ECONOMIC_VALUE,
  PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE,
  PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY,
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT,
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_CREATE_MONETARY_AUTHORITY,
  ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE,
  CAPACITY_ALONE_IS_NOT_REALIZED_OUTPUT,
  REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE,
  AI_FINAL_ECONOMIC_POLICY_AUTHORITY_FORBIDDEN,
  PRODUCTION_VALUE_POLICY_ACTIVE,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
  PRODUCTIVE_VALUE_FUNCTION_CAN_MINT,
  PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT,
  PRODUCTIVE_VALUE_UNIT_IS_MOONREY,
  PRODUCTIVE_VALUE_UNIT_IS_FIAT,
  ATTRIBUTION_REQUIRED,
  MOONREY_PRICE_SELF_REFERENCE_FORBIDDEN,
  PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED,
  PRODUCTIVE_VALUE_ENGINE_SIMULATION_AVAILABLE,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_POLICY_CONFIGURED,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTIVE_VALUE_ENGINE_CAN_CREATE_MONETARY_AUTHORITY,
  legacyFormulaRemainsAvailable: true,
  issuanceEngineUnchanged: true,
  productionActivated: false,
  engineeringImplementedDoesNotActivateProduction: true,
});

export const VALUE_NOT_PHYSICAL_MEASUREMENT =
  'A physical measurement (Wh, GPU-seconds, liters, tonne-km, service hours) is not productive economic value. Normalization must precede valuation.';

export const VALUE_NOT_MARKET_PRICE =
  'Productive economic value is not a market price. A reference price is context, never automatic value.';

export const VALUE_NOT_MOONREY_QUANTITY =
  'A ProductiveValueUnit is not a MoonRey Coin quantity and does not mint.';

export const VALUE_FUNCTION_NOT_MINT =
  'The Productive Value Function does not mint MoonRey and does not create monetary authority. Chunk 71 remains the issuance authority.';

export const VALUE_FUNCTION_NOT_ENGINE =
  'Chunk 123 defines the governed constitution and policy. Its engineImplemented=false marker is a constitution-era fact, not a production-activation switch.';

export const VALUE_FUNCTION_ENGINE_NOT_PRODUCTION =
  'Chunk 124 implements the simulation valuation engine. Engineering implementation is not production activation, mint authority, or MoonRey quantity.';
