/**
 * Phase G Exchange core posture. Not production authorization.
 * Live trading, mainnet, real custody, and native issuance stay disabled.
 */

export const EXCHANGE_CORE_CODE_COMPLETE_CANDIDATE = true as const;
export const EXCHANGE_PRODUCTION_READY = false as const;
export const EXCHANGE_PRODUCTION_ACTIVE = false as const;
export const EXCHANGE_LIVE_CONNECTIVITY_ENABLED = false as const;
export const EXCHANGE_PRODUCTION_AUTHORIZED = false as const;
export const EXCHANGE_LIVE_TRADING_ENABLED = false as const;
export const EXCHANGE_ENVIRONMENT = 'simulation' as const;

export const EXCHANGE_CORE_POSTURE = Object.freeze({
  CORE_CODE_COMPLETE_CANDIDATE: EXCHANGE_CORE_CODE_COMPLETE_CANDIDATE,
  PRODUCTION_READY: EXCHANGE_PRODUCTION_READY,
  PRODUCTION_ACTIVE: EXCHANGE_PRODUCTION_ACTIVE,
  LIVE_CONNECTIVITY_ENABLED: EXCHANGE_LIVE_CONNECTIVITY_ENABLED,
  production_authorized: EXCHANGE_PRODUCTION_AUTHORIZED,
  LIVE_TRADING_ENABLED: EXCHANGE_LIVE_TRADING_ENABLED,
  ENVIRONMENT: EXCHANGE_ENVIRONMENT,
});

export function assertExchangeSimulationOnly(): void {
  if (EXCHANGE_ENVIRONMENT !== 'simulation') {
    throw new Error('Exchange ENVIRONMENT must remain simulation');
  }
  if (
    EXCHANGE_PRODUCTION_READY !== false ||
    EXCHANGE_PRODUCTION_ACTIVE !== false ||
    EXCHANGE_LIVE_CONNECTIVITY_ENABLED !== false ||
    EXCHANGE_PRODUCTION_AUTHORIZED !== false ||
    EXCHANGE_LIVE_TRADING_ENABLED !== false
  ) {
    throw new Error('Exchange production and live trading remain disabled');
  }
}
