import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { createTemporalEntityGraphStore, type TemporalEntityGraphStore } from './graph-store.ts';
import { resolveProviderSymbol } from './resolver.ts';
import type { ResolveProviderSymbolInput, ResolvedEntityBinding, TemporalEntityGraphSnapshot } from './types.ts';

export type TemporalEntityResolutionService = {
  readonly store: TemporalEntityGraphStore;
  readonly resolveProviderSymbol: (input: ResolveProviderSymbolInput) => ResolvedEntityBinding;
  readonly snapshot: (sealedAt: UtcInstant) => TemporalEntityGraphSnapshot;
  readonly restore: (snapshot: TemporalEntityGraphSnapshot) => void;
};

export function createTemporalEntityResolutionService(
  initial?: TemporalEntityGraphSnapshot,
): TemporalEntityResolutionService {
  const store = createTemporalEntityGraphStore();
  if (initial) {
    store.restore(initial);
  }
  return Object.freeze({
    store,
    resolveProviderSymbol: (input) => resolveProviderSymbol(store, input),
    snapshot: (sealedAt) => store.snapshot(sealedAt),
    restore: (snapshot) => store.restore(snapshot),
  });
}
