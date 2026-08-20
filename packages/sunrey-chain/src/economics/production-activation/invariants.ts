/**
 * Hard invariants for the production economic activation firewall.
 *
 * These are typed literals, not runtime toggles.
 */

import {
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  REAL_MONEY_ENABLED,
  SIMULATION_MODE,
} from '../../../../config/src/flags.ts';
import { moonreyIssuanceActivated } from '../../protocol/assets.ts';

import type { LiveFlagSnapshot } from './types.ts';

export const PRODUCTION_ACTIVATED = false as const;
export const LIVE_FLAGS_CHANGED = false as const;
export const MONETARY_AUTHORITY_INVOKED = false as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;
export const AI_CAN_AUTHORIZE_PRODUCTION = false as const;
export const ENGINEERING_EVIDENCE_IS_EXTERNAL_APPROVAL = false as const;
export const PRODUCTION_PARAMETERS_CONFIGURED_ON_MAIN = false as const;

export function currentLiveFlags(): LiveFlagSnapshot {
  return Object.freeze({
    ENVIRONMENT,
    SIMULATION_MODE,
    LIVE_MONEY_ENABLED,
    LIVE_PAYMENTS_ENABLED,
    LIVE_BANKING_RAILS,
    LIVE_EXTERNAL_KYC,
    LIVE_EXTERNAL_BANK_CONNECTION,
    REAL_MONEY_ENABLED,
    LIVE_TRADING_ENABLED,
    LIVE_CRYPTO_ENABLED,
    LIVE_EXCHANGE_ENABLED,
    LIVE_DATA_MARKET_ENABLED,
    LIVE_INVESTMENT_EXECUTION,
  });
}

export function liveFlagsRemainDisabled(flags: LiveFlagSnapshot = currentLiveFlags()): boolean {
  return (
    flags.ENVIRONMENT === 'simulation' &&
    flags.SIMULATION_MODE === true &&
    flags.LIVE_MONEY_ENABLED === false &&
    flags.LIVE_PAYMENTS_ENABLED === false &&
    flags.LIVE_BANKING_RAILS === false &&
    flags.LIVE_EXTERNAL_KYC === false &&
    flags.LIVE_EXTERNAL_BANK_CONNECTION === false &&
    flags.REAL_MONEY_ENABLED === false &&
    flags.LIVE_TRADING_ENABLED === false &&
    flags.LIVE_CRYPTO_ENABLED === false &&
    flags.LIVE_EXCHANGE_ENABLED === false &&
    flags.LIVE_DATA_MARKET_ENABLED === false &&
    flags.LIVE_INVESTMENT_EXECUTION === false
  );
}

export function compiledCapabilitiesRemainSafe(): boolean {
  return (
    CAPABILITIES.ENVIRONMENT === 'simulation' &&
    moonreyIssuanceActivated() === false &&
    liveFlagsRemainDisabled()
  );
}
