// @ts-nocheck
/**
 * Genesis canonical protocol state factory.
 */

import { nativeAssetConstitution } from '../economics/constitution.ts';
import { emptyBook } from '../economics/supply.ts';
import type { MonetaryPolicyState } from '../economics/types.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import { bookToCanonical } from './books.ts';
import type { CanonicalProtocolState } from './types.ts';
import { CANONICAL_STATE_SCHEMA_VERSION } from './types.ts';

export type GenesisStateInput = {
  readonly protocolVersion?: number;
  readonly networkId?: string;
  readonly chainId?: string;
  readonly policyState?: MonetaryPolicyState;
  readonly governanceAuthorizationRefs?: readonly string[];
};

export function createGenesisState(input: GenesisStateInput = {}): CanonicalProtocolState {
  const policyState = input.policyState ?? 'DEVELOPMENT_ACTIVE';
  const constitution = nativeAssetConstitution(policyState);
  const sunreyBook = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
  const moonreyBook = emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);
  const governanceAuthorizationRefs = [...(input.governanceAuthorizationRefs ?? [])].sort();
  return Object.freeze({
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION,
    protocolVersion: input.protocolVersion ?? 1,
    networkId: input.networkId ?? PROTOCOL_NETWORK_ID,
    chainId: input.chainId ?? PROTOCOL_CHAIN_ID,
    height: 0n,
    finalizedBlockId: null,
    policyState,
    supplies: Object.freeze([bookToCanonical(sunreyBook), bookToCanonical(moonreyBook)]),
    accountNonces: Object.freeze([]),
    executedTransactionIds: Object.freeze([]),
    executedIssuanceAuthorizationIds: Object.freeze([]),
    governanceAuthorizationRefs: Object.freeze(governanceAuthorizationRefs),
  });
}

export function cloneCanonicalState(state: CanonicalProtocolState): CanonicalProtocolState {
  return Object.freeze({
    ...state,
    supplies: Object.freeze([state.supplies[0], state.supplies[1]]),
    accountNonces: Object.freeze([...state.accountNonces]),
    executedTransactionIds: Object.freeze([...state.executedTransactionIds]),
    executedIssuanceAuthorizationIds: Object.freeze([...state.executedIssuanceAuthorizationIds]),
    governanceAuthorizationRefs: Object.freeze([...state.governanceAuthorizationRefs]),
  });
}
