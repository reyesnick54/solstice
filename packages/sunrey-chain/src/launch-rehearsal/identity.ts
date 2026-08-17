/**
 * Distinct rehearsal network identity.
 *
 * Must not reuse the production-candidate network ID, chain ID,
 * genesis hash, or production address HRP as an active production
 * network.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

export const REHEARSAL_DISPLAY_NAME = 'SunRey Mainnet Rehearsal 1' as const;
export const REHEARSAL_ID = 'rehearsal_sunrey_mainnet_1' as const;
export const REHEARSAL_NETWORK_ID = 'net_sunrey_mainnet_rehearsal_1' as const;
export const REHEARSAL_CHAIN_ID = 'chn_sunrey_mainnet_rehearsal_1' as const;
export const REHEARSAL_NETWORK_CLASS = 'RESERVED_TEST' as const;
export const REHEARSAL_ADDRESS_HRP = 'srtst' as const;
export const REHEARSAL_BANNER = 'MAINNET REHEARSAL' as const;
export const REHEARSAL_PROTOCOL_VERSION = '1' as const;
export const REHEARSAL_GENESIS_VERSION = 'rehearsal-1' as const;
export const REHEARSAL_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;
export const REHEARSAL_FIXTURE_GENESIS_TIME_UTC = '2026-01-01T00:00:00.000Z' as const;

export const FORBIDDEN_REHEARSAL_NETWORK_IDS = [
  PRODUCTION_CANDIDATE_NETWORK_ID,
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
] as const;

export const FORBIDDEN_REHEARSAL_CHAIN_IDS = [
  PRODUCTION_CANDIDATE_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
] as const;

export function assertRehearsalIdentity(networkId: string, chainId: string, addressHrp: string): void {
  if ((FORBIDDEN_REHEARSAL_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`rehearsal must not reuse network id ${networkId}`);
  }
  if ((FORBIDDEN_REHEARSAL_CHAIN_IDS as readonly string[]).includes(chainId)) {
    throw new TypeError(`rehearsal must not reuse chain id ${chainId}`);
  }
  if (networkId !== REHEARSAL_NETWORK_ID) {
    throw new TypeError(`rehearsal network id must be ${REHEARSAL_NETWORK_ID}`);
  }
  if (chainId !== REHEARSAL_CHAIN_ID) {
    throw new TypeError(`rehearsal chain id must be ${REHEARSAL_CHAIN_ID}`);
  }
  if (addressHrp === PRODUCTION_ADDRESS_HRP) {
    throw new TypeError('rehearsal must not use production address HRP as an active production network');
  }
  if (addressHrp !== REHEARSAL_ADDRESS_HRP) {
    throw new TypeError(`rehearsal must use test-class HRP ${REHEARSAL_ADDRESS_HRP}`);
  }
}

export function rehearsalIsNotProduction(): true {
  return true;
}
