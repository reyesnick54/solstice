/**
 * Destructive testnet reset produces a new network identifier/version.
 * Genesis is never silently replaced while retaining the same identity.
 */

import {
  chainIdForTestnetVersion,
  displayNameForTestnetVersion,
  networkIdForTestnetVersion,
  testnetVersionFromNetworkId,
} from './identity.ts';

export type ResetDecision =
  | { readonly ok: false; readonly code: 'SILENT_REPLACE_FORBIDDEN' }
  | {
      readonly ok: true;
      readonly previousNetworkId: string;
      readonly nextNetworkId: string;
      readonly nextChainId: string;
      readonly nextDisplayName: string;
      readonly nextVersion: number;
    };

export function planNetworkReset(currentNetworkId: string): ResetDecision {
  const version = testnetVersionFromNetworkId(currentNetworkId);
  if (version === null) {
    return { ok: false, code: 'SILENT_REPLACE_FORBIDDEN' };
  }
  const next = version + 1;
  return {
    ok: true,
    previousNetworkId: currentNetworkId,
    nextNetworkId: networkIdForTestnetVersion(next),
    nextChainId: chainIdForTestnetVersion(next),
    nextDisplayName: displayNameForTestnetVersion(next),
    nextVersion: next,
  };
}

export function refuseSilentGenesisReplace(currentNetworkId: string, replacementNetworkId: string): boolean {
  return currentNetworkId === replacementNetworkId;
}
