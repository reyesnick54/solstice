/**
 * Simulation-only capability flags.
 *
 * ENVIRONMENT is simulation. Every LIVE_* flag is false and must stay false.
 * These are not product-experiment toggles. They are the only switches that
 * could enable real-world side effects, and they are compiled to false.
 */
export const ENVIRONMENT = 'simulation' as const;

export const LIVE_MONEY_ENABLED = false as const;
export const LIVE_PAYMENTS_ENABLED = false as const;
export const LIVE_BANKING_RAILS = false as const;
export const LIVE_EXTERNAL_KYC = false as const;
export const LIVE_EXTERNAL_BANK_CONNECTION = false as const;

export const CAPABILITIES = Object.freeze({
  ENVIRONMENT,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_KYC,
  LIVE_EXTERNAL_BANK_CONNECTION,
});

export function assertSimulationOnly(): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation');
  }
  if (
    LIVE_MONEY_ENABLED !== false ||
    LIVE_PAYMENTS_ENABLED !== false ||
    LIVE_BANKING_RAILS !== false ||
    LIVE_EXTERNAL_KYC !== false ||
    LIVE_EXTERNAL_BANK_CONNECTION !== false
  ) {
    throw new Error('every LIVE_* flag must remain false; real-world movement is not authorised');
  }
}
