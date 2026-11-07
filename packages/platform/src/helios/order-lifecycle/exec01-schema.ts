/**
 * EXEC01 schema anchor for H23 order lifecycle records.
 */

export const HELIOS_H23_EXEC01_SCHEMA_REF = 'sunrey.helios.execution.connectivity.exec01.v1' as const;

export const EXEC01_SANDBOX_HELIOS_PROVIDER_ID = 'sandbox_helios_investment_v1' as const;

export const HELIOS_H23_ORDER_LIFECYCLE_EXEC01_NOTE =
  'H23 HeliosOrder maps to EXEC01 broker order request via order-lifecycle/exec01-bridge.ts' as const;
