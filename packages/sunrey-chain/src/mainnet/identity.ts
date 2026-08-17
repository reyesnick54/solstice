/**
 * Production-candidate network identity.
 *
 * Identifiers remain CANDIDATE until human authorization.
 * They must not reuse testnet, local-dev, or simulation IDs.
 */

import {
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
} from '../wallet/types.ts';
import {
  SUNREY_TESTNET_1_CHAIN_ID,
  SUNREY_TESTNET_1_NETWORK_ID as TESTNET_NET,
} from '../testnet/identity.ts';

export const PRODUCTION_CANDIDATE_DISPLAY_NAME = 'SunRey Production Candidate 1' as const;
export const PRODUCTION_CANDIDATE_NETWORK_ID = 'net_sunrey_production_candidate_1' as const;
export const PRODUCTION_CANDIDATE_CHAIN_ID = 'chn_sunrey_production_candidate_1' as const;
export const PRODUCTION_ADDRESS_HRP = 'srprd' as const;
export const PRODUCTION_CANDIDATE_PROTOCOL_VERSION = '1' as const;
export const PRODUCTION_CANDIDATE_GENESIS_VERSION = 'candidate-1' as const;
export const PRODUCTION_CANDIDATE_PREFIX = 'net_sunrey_production_candidate_' as const;
export const PRODUCTION_CANDIDATE_CHAIN_PREFIX = 'chn_sunrey_production_candidate_' as const;

/** Explicit fixture time: 2026-01-01T00:00:00.000Z. Not a launch time. */
export const PRODUCTION_CANDIDATE_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;

export const FORBIDDEN_PRODUCTION_NETWORK_IDS = [
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
  SUNREY_TESTNET_1_NETWORK_ID,
  TESTNET_NET,
] as const;

export const FORBIDDEN_PRODUCTION_CHAIN_IDS = [
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
  SUNREY_TESTNET_1_CHAIN_ID,
] as const;

export function isProductionCandidateNetworkId(networkId: string): boolean {
  return networkId.startsWith(PRODUCTION_CANDIDATE_PREFIX);
}

export function isForbiddenProductionNetworkId(networkId: string): boolean {
  if ((FORBIDDEN_PRODUCTION_NETWORK_IDS as readonly string[]).includes(networkId)) {
    return true;
  }
  return networkId.startsWith('net_sunrey_testnet_');
}

export function isForbiddenProductionChainId(chainId: string): boolean {
  if ((FORBIDDEN_PRODUCTION_CHAIN_IDS as readonly string[]).includes(chainId)) {
    return true;
  }
  return chainId.startsWith('chn_sunrey_testnet_');
}

export function assertCandidateIdentity(networkId: string, chainId: string): void {
  if (isForbiddenProductionNetworkId(networkId)) {
    throw new TypeError(`production candidate must not reuse network id ${networkId}`);
  }
  if (isForbiddenProductionChainId(chainId)) {
    throw new TypeError(`production candidate must not reuse chain id ${chainId}`);
  }
  if (!isProductionCandidateNetworkId(networkId)) {
    throw new TypeError(`production candidate network id must use ${PRODUCTION_CANDIDATE_PREFIX}`);
  }
  if (!chainId.startsWith(PRODUCTION_CANDIDATE_CHAIN_PREFIX)) {
    throw new TypeError(`production candidate chain id must use ${PRODUCTION_CANDIDATE_CHAIN_PREFIX}`);
  }
  if (networkId === RESERVED_PRODUCTION_NETWORK_ID) {
    throw new TypeError('reserved production placeholder is not a candidate identity');
  }
}
