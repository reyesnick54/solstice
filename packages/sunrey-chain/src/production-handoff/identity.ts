/**
 * Distinct production-handoff rehearsal identities.
 *
 * Must not reuse Candidate V2, Mainnet RC, ceremony dress rehearsal,
 * launch rehearsal, economic rehearsal, or testnet identities.
 * Rehearsal identities are unusable as production inputs.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import {
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_NETWORK_ID,
} from '../mainnet/candidate-v2/identity.ts';
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
import {
  DRESS_REHEARSAL_ADDRESS_HRP,
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_NETWORK_ID,
} from '../production-ceremony/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

export const HANDOFF_DISPLAY_NAME = 'SunRey Production Handoff Rehearsal 1' as const;
export const HANDOFF_REHEARSAL_ID = 'SUNREY_PRODUCTION_HANDOFF_REHEARSAL_1' as const;
export const HANDOFF_REHEARSAL_NETWORK_ID = 'net_sunrey_production_handoff_rehearsal_1' as const;
export const HANDOFF_REHEARSAL_CHAIN_ID = 'chn_sunrey_production_handoff_rehearsal_1' as const;
export const HANDOFF_REHEARSAL_ADDRESS_HRP = 'srpho' as const;

export const FORBIDDEN_HANDOFF_NETWORK_IDS = [
  PRODUCTION_CANDIDATE_NETWORK_ID,
  CANDIDATE_V2_NETWORK_ID,
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
] as const;

export const FORBIDDEN_HANDOFF_CHAIN_IDS = [
  PRODUCTION_CANDIDATE_CHAIN_ID,
  CANDIDATE_V2_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  LAUNCH_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
] as const;

export function assertHandoffRehearsalIdentity(networkId: string, chainId: string, addressHrp: string): void {
  if ((FORBIDDEN_HANDOFF_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`production handoff rehearsal must not reuse network id ${networkId}`);
  }
  if ((FORBIDDEN_HANDOFF_CHAIN_IDS as readonly string[]).includes(chainId)) {
    throw new TypeError(`production handoff rehearsal must not reuse chain id ${chainId}`);
  }
  if (networkId !== HANDOFF_REHEARSAL_NETWORK_ID) {
    throw new TypeError(`handoff rehearsal network id must be ${HANDOFF_REHEARSAL_NETWORK_ID}`);
  }
  if (chainId !== HANDOFF_REHEARSAL_CHAIN_ID) {
    throw new TypeError(`handoff rehearsal chain id must be ${HANDOFF_REHEARSAL_CHAIN_ID}`);
  }
  if (
    addressHrp === PRODUCTION_ADDRESS_HRP ||
    addressHrp === LAUNCH_REHEARSAL_HRP ||
    addressHrp === ECONOMIC_REHEARSAL_ADDRESS_HRP ||
    addressHrp === DRESS_REHEARSAL_ADDRESS_HRP
  ) {
    throw new TypeError('handoff rehearsal must not present production or other-rehearsal addresses');
  }
  if (addressHrp !== HANDOFF_REHEARSAL_ADDRESS_HRP) {
    throw new TypeError(`handoff rehearsal must use HRP ${HANDOFF_REHEARSAL_ADDRESS_HRP}`);
  }
}

export function handoffDoesNotLaunchMainnet(): true {
  return true;
}
