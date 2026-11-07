/**
 * Market-state gating — halted books must not masquerade as executable.
 */

import type { BookMarketState } from './taxonomy.ts';

export function marketStatePermitsExecutableBook(state: BookMarketState): boolean {
  return state === 'OPEN' || state === 'PRE_OPEN' || state === 'AUCTION';
}
