/**
 * Monetary State Root — deterministic commitment over canonical protocol state.
 */

import { sha256Hex } from '../../../security/src/hash.ts';
import { domainSeparatedHash } from '../protocol/hash.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID, PROTOCOL_SCHEMA_VERSION } from '../protocol/constants.ts';
import { encodeCanonicalState } from './serialization.ts';
import type { CanonicalProtocolState } from './types.ts';

export const MONETARY_STATE_HASH_DOMAIN = 'SUNREY_MONETARY_STATE_V1' as const;

export function monetaryStateRoot(state: CanonicalProtocolState): string {
  const payload = encodeCanonicalState(state);
  return domainSeparatedHash(
    MONETARY_STATE_HASH_DOMAIN,
    state.networkId,
    state.chainId,
    PROTOCOL_SCHEMA_VERSION,
    payload,
  );
}

export function monetaryStateRootWithContext(
  state: CanonicalProtocolState,
  networkId: string,
  chainId: string,
): string {
  const payload = encodeCanonicalState(state);
  return domainSeparatedHash(MONETARY_STATE_HASH_DOMAIN, networkId, chainId, PROTOCOL_SCHEMA_VERSION, payload);
}

/** Development helper: hash using default simulation network identifiers. */
export function simulationMonetaryStateRoot(state: CanonicalProtocolState): string {
  return monetaryStateRootWithContext(state, PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID);
}

export function verifyMonetaryStateRoot(state: CanonicalProtocolState, expectedRoot: string): boolean {
  return monetaryStateRoot(state) === expectedRoot;
}

export function stateFingerprint(state: CanonicalProtocolState): string {
  return sha256Hex(monetaryStateRoot(state));
}
