/**
 * Production Network Candidate V2 identity.
 *
 * Reuses the approved Chunk 65 production-candidate prefix and HRP.
 * Does not reuse testnet, rehearsal, or Candidate V1 network/chain IDs.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_CHAIN_PREFIX,
  PRODUCTION_CANDIDATE_NETWORK_ID,
  PRODUCTION_CANDIDATE_PREFIX,
  assertCandidateIdentity,
  isForbiddenProductionChainId,
  isForbiddenProductionNetworkId,
} from '../identity.ts';
import {
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
} from '../../economic-rehearsal/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../../testnet/identity.ts';

export const CANDIDATE_V2_ID = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_2' as const;
export const CANDIDATE_V2_DISPLAY_NAME = 'SunRey Production Candidate 2' as const;
export const CANDIDATE_V2_NETWORK_ID = 'net_sunrey_production_candidate_2' as const;
export const CANDIDATE_V2_CHAIN_ID = 'chn_sunrey_production_candidate_2' as const;
export const CANDIDATE_V2_ADDRESS_HRP = PRODUCTION_ADDRESS_HRP;
export const CANDIDATE_V2_PROTOCOL_VERSION = '1' as const;
export const CANDIDATE_V2_GENESIS_FORMAT_VERSION = 'candidate-2' as const;
export const CANDIDATE_V2_API_VERSION = 'v1' as const;
export const CANDIDATE_V2_DOMAIN = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2' as const;
export const CANDIDATE_V2_STATUS = 'CANDIDATE' as const;

export function assertCandidateV2Identity(networkId: string, chainId: string): void {
  assertCandidateIdentity(networkId, chainId);
  if (networkId === PRODUCTION_CANDIDATE_NETWORK_ID || chainId === PRODUCTION_CANDIDATE_CHAIN_ID) {
    throw new TypeError('candidate v2 must not reuse candidate v1 identity');
  }
  if (networkId === ECONOMIC_REHEARSAL_NETWORK_ID || chainId === ECONOMIC_REHEARSAL_CHAIN_ID) {
    throw new TypeError('candidate v2 must not reuse economic rehearsal identity');
  }
  if (networkId === SUNREY_TESTNET_1_NETWORK_ID || isForbiddenProductionNetworkId(networkId)) {
    throw new TypeError(`testnet network id rejected: ${networkId}`);
  }
  if (chainId === SUNREY_TESTNET_1_CHAIN_ID || isForbiddenProductionChainId(chainId)) {
    throw new TypeError(`wrong chain id rejected: ${chainId}`);
  }
  if (!networkId.startsWith(PRODUCTION_CANDIDATE_PREFIX) || !chainId.startsWith(PRODUCTION_CANDIDATE_CHAIN_PREFIX)) {
    throw new TypeError('candidate v2 must keep the approved production-candidate prefix');
  }
  if (networkId !== CANDIDATE_V2_NETWORK_ID) {
    throw new TypeError(`candidate v2 network id must be ${CANDIDATE_V2_NETWORK_ID}`);
  }
  if (chainId !== CANDIDATE_V2_CHAIN_ID) {
    throw new TypeError(`candidate v2 chain id must be ${CANDIDATE_V2_CHAIN_ID}`);
  }
}
