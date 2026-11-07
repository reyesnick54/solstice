/**
 * MD06 instrument master fabric — resolves tickers to stable identity at a point in time.
 */

import type { UtcInstant } from '@solstice/domain';

import { resolveProviderSymbol } from '../../feature-fabric/entity-resolution/resolver.ts';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import type { InstrumentMasterStore } from './master-store.ts';
import { resolveIdentifierAt } from './identifiers.ts';

export type HeliosMd06InstrumentMasterFabric = {
  readonly resolveTicker: (input: {
    readonly ticker: string;
    readonly venueMic: string;
    readonly asOf: UtcInstant;
    readonly knowableAtCutoff: UtcInstant;
  }) => {
    readonly instrumentIdentityId: string | null;
    readonly listingId: string | null;
    readonly canonicalInstrumentId: string | null;
    readonly providerResolutionState: string;
  };
  readonly resolveProviderTicker: (input: {
    readonly providerId: string;
    readonly providerSymbol: string;
    readonly asOf: UtcInstant;
    readonly knowableAtCutoff: UtcInstant;
  }) => ReturnType<typeof resolveProviderSymbol>;
};

export type HeliosMd06InstrumentMasterFabricOptions = {
  readonly master: InstrumentMasterStore;
  readonly graph: TemporalEntityGraphStore;
};

export function createHeliosMd06InstrumentMasterFabric(
  options: HeliosMd06InstrumentMasterFabricOptions,
): HeliosMd06InstrumentMasterFabric {
  const { master, graph } = options;

  return Object.freeze({
    resolveTicker(input) {
      const listing = master.resolveListingByTicker(
        input.ticker,
        input.venueMic,
        input.asOf,
        input.knowableAtCutoff,
      );
      if (!listing) {
        return Object.freeze({
          instrumentIdentityId: null,
          listingId: null,
          canonicalInstrumentId: null,
          providerResolutionState: 'UNRESOLVED',
        });
      }
      const identity = master.getIdentity(listing.instrumentIdentityId);
      const figi = identity
        ? resolveIdentifierAt(identity.identifiers, 'FIGI', input.asOf, input.knowableAtCutoff)
        : null;
      return Object.freeze({
        instrumentIdentityId: listing.instrumentIdentityId,
        listingId: listing.listingId,
        canonicalInstrumentId: listing.canonicalInstrumentId,
        providerResolutionState: figi ? 'RESOLVED' : 'UNRESOLVED',
      });
    },
    resolveProviderTicker(input) {
      return resolveProviderSymbol(graph, input);
    },
  });
}
