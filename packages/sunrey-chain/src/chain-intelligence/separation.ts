/**
 * Hard boundary: external chain intelligence is read-only relative to SunRey chain.
 */

import { SUNREY_NATIVE_CHAIN_ID } from './types.ts';

export type SunReyChainSeparationProof = Readonly<{
  readonly externalObservationOnly: true;
  readonly mutatesSunReyConsensus: false;
  readonly mutatesSunReyBlockProduction: false;
  readonly mutatesSunReyLedger: false;
  readonly authorizesSunReyTransactions: false;
  readonly determinesSunReyTxValidity: false;
  readonly determinesSunReyCoinIssuance: false;
  readonly determinesMoonReyCoinIssuance: false;
  readonly overridesInternalValidators: false;
  readonly issuesExecutionAuthority: false;
}>;

export function chainIntelligenceSeparationProof(): SunReyChainSeparationProof {
  return Object.freeze({
    externalObservationOnly: true,
    mutatesSunReyConsensus: false,
    mutatesSunReyBlockProduction: false,
    mutatesSunReyLedger: false,
    authorizesSunReyTransactions: false,
    determinesSunReyTxValidity: false,
    determinesSunReyCoinIssuance: false,
    determinesMoonReyCoinIssuance: false,
    overridesInternalValidators: false,
    issuesExecutionAuthority: false,
  });
}

export function assertExternalChainTarget(chainId: string): void {
  if (chainId === SUNREY_NATIVE_CHAIN_ID || chainId.startsWith('chn_sunrey')) {
    throw new Error('external chain intelligence must not target SunRey native chain state');
  }
}
