/**
 * AAF02 ↔ AAF03 integration — features must bind resolved canonical IDs, not raw provider symbols.
 */

import { computeFeatureObservation } from './compute.ts';
import type { ComputeFeatureInput, ComputeFeatureResult } from './types.ts';
import { assertFeatureFabricEntityRefs, resolveProviderSymbol } from './entity-resolution/resolver.ts';
import type { TemporalEntityGraphStore } from './entity-resolution/graph-store.ts';
import type { ResolveProviderSymbolInput } from './entity-resolution/types.ts';

export type ComputeFeatureWithResolutionInput = {
  readonly graph: TemporalEntityGraphStore;
  readonly providerResolution: ResolveProviderSymbolInput;
  readonly compute: Omit<ComputeFeatureInput, 'canonicalEntityId' | 'canonicalInstrumentId'>;
};

export function computeFeatureWithResolvedEntity(input: ComputeFeatureWithResolutionInput): ComputeFeatureResult {
  const binding = resolveProviderSymbol(input.graph, input.providerResolution);
  const gate = assertFeatureFabricEntityRefs(binding);
  if (!gate.ok) {
    return { ok: false, code: gate.code, message: gate.message };
  }
  return computeFeatureObservation({
    ...input.compute,
    canonicalEntityId: binding.canonicalEntityId!,
    canonicalInstrumentId: binding.canonicalInstrumentId,
  });
}
