/**
 * Capability flags. These are the only switches that may enable real-world
 * side effects. They are not feature toggles for product experiments.
 *
 * Every live-money / live-market flag is false and stays false. This process
 * is a simulation. No code path may flip these flags.
 */
export const ENVIRONMENT = 'simulation' as const;
export const REAL_MONEY_ENABLED = false as const;
export const LIVE_TRADING_ENABLED = false as const;
export const LIVE_CRYPTO_ENABLED = false as const;
export const LIVE_EXCHANGE_ENABLED = false as const;
export const LIVE_DATA_MARKET_ENABLED = false as const;

export const CAPABILITIES = Object.freeze({
  ENVIRONMENT,
  REAL_MONEY_ENABLED,
  LIVE_TRADING_ENABLED,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
});

export function assertSimulationOnly(): void {
  if (REAL_MONEY_ENABLED !== false) {
    throw new Error(
      'REAL_MONEY_ENABLED must remain false; real-money movement is not authorised',
    );
  }
  if (LIVE_TRADING_ENABLED !== false) {
    throw new Error('LIVE_TRADING_ENABLED must remain false');
  }
  if (LIVE_CRYPTO_ENABLED !== false) {
    throw new Error('LIVE_CRYPTO_ENABLED must remain false');
  }
  if (LIVE_EXCHANGE_ENABLED !== false) {
    throw new Error('LIVE_EXCHANGE_ENABLED must remain false');
  }
  if (LIVE_DATA_MARKET_ENABLED !== false) {
    throw new Error('LIVE_DATA_MARKET_ENABLED must remain false');
  }
}
