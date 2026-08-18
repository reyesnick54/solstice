/**
 * Distinct economic-rehearsal network identity.
 *
 * Must not reuse the production-candidate network ID, chain ID,
 * genesis, production address HRP, or Chunk 70 launch-rehearsal IDs.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import {
  REHEARSAL_ADDRESS_HRP as LAUNCH_REHEARSAL_HRP,
  REHEARSAL_CHAIN_ID as LAUNCH_REHEARSAL_CHAIN_ID,
  REHEARSAL_NETWORK_ID as LAUNCH_REHEARSAL_NETWORK_ID,
} from '../launch-rehearsal/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

export const ECONOMIC_REHEARSAL_DISPLAY_NAME = 'SunRey Economic Mainnet Rehearsal 1' as const;
export const ECONOMIC_REHEARSAL_ID = 'rehearsal_sunrey_economic_mainnet_1' as const;
export const ECONOMIC_REHEARSAL_NETWORK_ID = 'net_sunrey_economic_mainnet_rehearsal_1' as const;
export const ECONOMIC_REHEARSAL_CHAIN_ID = 'chn_sunrey_economic_mainnet_rehearsal_1' as const;
export const ECONOMIC_REHEARSAL_NETWORK_CLASS = 'REHEARSAL' as const;
export const ECONOMIC_REHEARSAL_ADDRESS_HRP = 'srecr' as const;
export const ECONOMIC_REHEARSAL_BANNER = 'ECONOMIC MAINNET REHEARSAL' as const;
export const ECONOMIC_REHEARSAL_PROTOCOL_VERSION = '1' as const;
export const ECONOMIC_REHEARSAL_GENESIS_VERSION = 'economic-rehearsal-1' as const;
export const ECONOMIC_REHEARSAL_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;
export const ECONOMIC_REHEARSAL_FIXTURE_GENESIS_TIME_UTC = '2026-01-01T00:00:00.000Z' as const;
export const ECONOMIC_RC_ID = 'SUNREY_ECONOMIC_RC_1' as const;

export const FORBIDDEN_ECONOMIC_REHEARSAL_NETWORK_IDS = [
  PRODUCTION_CANDIDATE_NETWORK_ID,
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
] as const;

export const FORBIDDEN_ECONOMIC_REHEARSAL_CHAIN_IDS = [
  PRODUCTION_CANDIDATE_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  LAUNCH_REHEARSAL_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
] as const;

export function assertEconomicRehearsalIdentity(
  networkId: string,
  chainId: string,
  addressHrp: string,
): void {
  if ((FORBIDDEN_ECONOMIC_REHEARSAL_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`economic rehearsal must not reuse network id ${networkId}`);
  }
  if ((FORBIDDEN_ECONOMIC_REHEARSAL_CHAIN_IDS as readonly string[]).includes(chainId)) {
    throw new TypeError(`economic rehearsal must not reuse chain id ${chainId}`);
  }
  if (networkId !== ECONOMIC_REHEARSAL_NETWORK_ID) {
    throw new TypeError(`economic rehearsal network id must be ${ECONOMIC_REHEARSAL_NETWORK_ID}`);
  }
  if (chainId !== ECONOMIC_REHEARSAL_CHAIN_ID) {
    throw new TypeError(`economic rehearsal chain id must be ${ECONOMIC_REHEARSAL_CHAIN_ID}`);
  }
  if (addressHrp === PRODUCTION_ADDRESS_HRP || addressHrp === LAUNCH_REHEARSAL_HRP) {
    throw new TypeError('economic rehearsal must not present production or launch-rehearsal addresses');
  }
  if (addressHrp !== ECONOMIC_REHEARSAL_ADDRESS_HRP) {
    throw new TypeError(`economic rehearsal must use test-class HRP ${ECONOMIC_REHEARSAL_ADDRESS_HRP}`);
  }
}

export function economicRehearsalIsNotProduction(): true {
  return true;
}
