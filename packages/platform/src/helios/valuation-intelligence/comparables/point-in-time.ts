import type { UtcInstant } from '@solstice/domain';

import { isValuationArtifactKnowableAt } from '../knowable-at.ts';
import type { PeerCandidate, PeerExclusionRecord } from './types.ts';

export function filterPeersKnowableAtValuationTime(
  valuationTimeUtc: UtcInstant,
  universe: readonly PeerCandidate[],
  targetPeerId: string,
): { readonly eligible: readonly PeerCandidate[]; readonly excluded: readonly PeerExclusionRecord[] } {
  const eligible: PeerCandidate[] = [];
  const excluded: PeerExclusionRecord[] = [];

  for (const peer of universe) {
    if (peer.peerId === targetPeerId) continue;
    if (!isValuationArtifactKnowableAt(valuationTimeUtc, peer)) {
      excluded.push(
        Object.freeze({
          peerId: peer.peerId,
          reason: 'NOT_KNOWABLE_AT_VALUATION_TIME',
          detail: `knowableAt ${peer.knowableAt} after valuationTime ${valuationTimeUtc}`,
        }),
      );
      continue;
    }
    const listingMs = Date.parse(peer.listingActiveAt);
    const valuationMs = Date.parse(valuationTimeUtc);
    if (Number.isFinite(listingMs) && Number.isFinite(valuationMs) && listingMs > valuationMs) {
      excluded.push(
        Object.freeze({
          peerId: peer.peerId,
          reason: 'NOT_KNOWABLE_AT_VALUATION_TIME',
          detail: 'listing not active at valuationTime',
        }),
      );
      continue;
    }
    eligible.push(peer);
  }

  return Object.freeze({ eligible: Object.freeze(eligible), excluded: Object.freeze(excluded) });
}
