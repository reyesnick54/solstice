import {
  createTemporalEntityGraphStore,
  type TemporalEntityGraphStore,
} from '../../feature-fabric/entity-resolution/graph-store.ts';
import { runAltObservationMatchingCascade } from './matching-cascade.ts';
import type { AltCrosswalkRegistry, AltLlmMatchProposal, AltObservationMatchRecord, AltObservationResolutionInput } from './types.ts';

export type HeliosAlt03EntityAssetGraphFabricOptions = {
  readonly graph?: TemporalEntityGraphStore;
  readonly crosswalk?: AltCrosswalkRegistry;
  readonly llmProposals?: readonly AltLlmMatchProposal[];
};

export type HeliosAlt03EntityAssetGraphFabric = {
  readonly graph: TemporalEntityGraphStore;
  readonly resolveObservation: (input: AltObservationResolutionInput) => AltObservationMatchRecord;
};

export function createHeliosAlt03EntityAssetGraphFabric(
  options: HeliosAlt03EntityAssetGraphFabricOptions = {},
): HeliosAlt03EntityAssetGraphFabric {
  const graph = options.graph ?? createTemporalEntityGraphStore();
  return Object.freeze({
    graph,
    resolveObservation(input) {
      return runAltObservationMatchingCascade(
        {
          graph,
          crosswalk: options.crosswalk,
          llmProposals: options.llmProposals,
        },
        input,
      );
    },
  });
}
