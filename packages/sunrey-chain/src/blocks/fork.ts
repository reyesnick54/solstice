/**
 * Fork and conflicting-history behavior for deterministic-finality BFT.
 *
 * Competing finalized histories are detected and rejected. There is no
 * probabilistic confirmation count — commit certificates are authoritative.
 */

import type { FinalizedBlock } from './types.ts';

export type ForkResolution =
  | { readonly outcome: 'ACCEPT_FIRST_FINALIZED'; readonly block: FinalizedBlock }
  | { readonly outcome: 'REJECT_INCOMPATIBLE_FINALIZED'; readonly existingHash: string; readonly conflictingHash: string }
  | { readonly outcome: 'IGNORE_NON_FINALIZED'; readonly reason: string };

export function resolveFinalizedConflict(
  existing: FinalizedBlock | null,
  candidate: FinalizedBlock,
): ForkResolution {
  if (!existing) {
    return { outcome: 'ACCEPT_FIRST_FINALIZED', block: candidate };
  }
  if (existing.header.height !== candidate.header.height) {
    return { outcome: 'IGNORE_NON_FINALIZED', reason: 'height mismatch is not a same-height fork' };
  }
  if (existing.blockHash === candidate.blockHash) {
    return { outcome: 'ACCEPT_FIRST_FINALIZED', block: existing };
  }
  return {
    outcome: 'REJECT_INCOMPATIBLE_FINALIZED',
    existingHash: existing.blockHash,
    conflictingHash: candidate.blockHash,
  };
}

export function rejectNonFinalizedAsCanonical(stage: string): void {
  throw new Error(`non-finalized ${stage} state must not be exposed as canonical monetary truth`);
}
