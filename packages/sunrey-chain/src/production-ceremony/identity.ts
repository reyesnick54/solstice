/**
 * Distinct production-genesis-ceremony identities.
 *
 * Dress-rehearsal network ID, chain ID, genesis, keys, and approvals
 * must not reuse production-candidate, testnet, launch-rehearsal, or
 * economic-rehearsal identities, and are unusable as production inputs.
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
import {
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
} from '../economic-rehearsal/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

export const PRODUCTION_CEREMONY_DISPLAY_NAME = 'SunRey Production Genesis Ceremony' as const;
export const DRESS_REHEARSAL_DISPLAY_NAME = 'SunRey Production Genesis Ceremony Dress Rehearsal 1' as const;
export const DRESS_REHEARSAL_ID = 'rehearsal_sunrey_production_genesis_ceremony_1' as const;
export const DRESS_REHEARSAL_NETWORK_ID = 'net_sunrey_production_genesis_ceremony_rehearsal_1' as const;
export const DRESS_REHEARSAL_CHAIN_ID = 'chn_sunrey_production_genesis_ceremony_rehearsal_1' as const;
export const DRESS_REHEARSAL_ADDRESS_HRP = 'srpgc' as const;
export const DRESS_REHEARSAL_PROTOCOL_VERSION = '1' as const;
export const DRESS_REHEARSAL_GENESIS_VERSION = 'production-ceremony-rehearsal-1' as const;
export const DRESS_REHEARSAL_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;
export const DRESS_REHEARSAL_FIXTURE_GENESIS_TIME_UTC = '2026-01-01T00:00:00.000Z' as const;

export const EXPECTED_CANDIDATE_V2_ID = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2' as const;
export const EXPECTED_MAINNET_RC_ID = 'SUNREY_MAINNET_RC_1' as const;
export const REHEARSAL_CANDIDATE_V2_ID = 'SUNREY_PGC_REHEARSAL_CANDIDATE_V2' as const;
export const REHEARSAL_MAINNET_RC_ID = 'SUNREY_PGC_REHEARSAL_MAINNET_RC' as const;

export const PRODUCTION_GENESIS_AUTHORITY_ID = 'auth.sunrey.genesis.v1' as const;
export const PRODUCTION_PROTOCOL_AUTHORITY_ID = 'auth.sunrey.protocol.v1' as const;
export const PRODUCTION_SECURITY_AUTHORITY_ID = 'auth.sunrey.security.v1' as const;
export const PRODUCTION_RELEASE_AUTHORITY_ID = 'auth.sunrey.release.v1' as const;

export const FORBIDDEN_CEREMONY_NETWORK_IDS = [
  PRODUCTION_CANDIDATE_NETWORK_ID,
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
] as const;

export const FORBIDDEN_CEREMONY_CHAIN_IDS = [
  PRODUCTION_CANDIDATE_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  LAUNCH_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
] as const;

export const FORBIDDEN_PRODUCTION_INPUT_IDENTITIES = [
  DRESS_REHEARSAL_NETWORK_ID,
  DRESS_REHEARSAL_CHAIN_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
] as const;

export function assertDressRehearsalIdentity(networkId: string, chainId: string, addressHrp: string): void {
  if ((FORBIDDEN_CEREMONY_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`production ceremony dress rehearsal must not reuse network id ${networkId}`);
  }
  if ((FORBIDDEN_CEREMONY_CHAIN_IDS as readonly string[]).includes(chainId)) {
    throw new TypeError(`production ceremony dress rehearsal must not reuse chain id ${chainId}`);
  }
  if (networkId !== DRESS_REHEARSAL_NETWORK_ID) {
    throw new TypeError(`dress rehearsal network id must be ${DRESS_REHEARSAL_NETWORK_ID}`);
  }
  if (chainId !== DRESS_REHEARSAL_CHAIN_ID) {
    throw new TypeError(`dress rehearsal chain id must be ${DRESS_REHEARSAL_CHAIN_ID}`);
  }
  if (
    addressHrp === PRODUCTION_ADDRESS_HRP ||
    addressHrp === LAUNCH_REHEARSAL_HRP ||
    addressHrp === ECONOMIC_REHEARSAL_ADDRESS_HRP
  ) {
    throw new TypeError('dress rehearsal must not present production or other-rehearsal addresses');
  }
  if (addressHrp !== DRESS_REHEARSAL_ADDRESS_HRP) {
    throw new TypeError(`dress rehearsal must use HRP ${DRESS_REHEARSAL_ADDRESS_HRP}`);
  }
}

export function rehearsalIdentityUnusableForProduction(value: string): boolean {
  return (FORBIDDEN_PRODUCTION_INPUT_IDENTITIES as readonly string[]).includes(value);
}

export function productionCeremonyDoesNotLaunchMainnet(): true {
  return true;
}
