/**
 * MD06 orchestration — master store, graph bridge, and price-series derivation.
 */

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { buildAdjustedResearchSeries } from './price-series.ts';
import { createInstrumentMasterStore, type InstrumentMasterStore } from './store.ts';
import { bindInstrumentIdentityToTemporalGraph } from './temporal-bridge.ts';
import type { InstrumentMasterSeedBundle, Md06InstrumentMasterFabric } from './fixtures.ts';
import type { PriceSeriesView } from './types.ts';

export type InstrumentMasterFabric = Md06InstrumentMasterFabric;

export function createInstrumentMasterFabric(input?: {
  readonly graph?: TemporalEntityGraphStore;
  readonly seed?: InstrumentMasterSeedBundle;
}): InstrumentMasterFabric {
  const store = createInstrumentMasterStore();
  const graph = input?.graph;

  if (input?.seed) {
    for (const row of input.seed.identities) store.putIdentity(row);
    for (const row of input.seed.listings) store.putListing(row);
    for (const row of input.seed.venueInstruments) store.putVenueInstrument(row);
    for (const row of input.seed.tradingSessions) store.putTradingSession(row);
    for (const row of input.seed.corporateActions) store.putCorporateAction(row);
    for (const row of input.seed.contractLifecycles) store.putContractLifecycle(row);
    for (const row of input.seed.rawPrices) store.appendRawPrice(row);
    if (graph && input.seed.graphBindings) {
      for (const binding of input.seed.graphBindings) {
        bindInstrumentIdentityToTemporalGraph(
          graph,
          binding.identity,
          binding.listing,
          binding.venueInstrument,
          binding.session,
          binding.contract,
        );
      }
    }
  }

  return Object.freeze({
    store,
    graph: graph ?? null,
    adjustedResearchSeries(instrumentIdentityId, asOfKnowableAt): PriceSeriesView {
      const actions = store.listCorporateActions(instrumentIdentityId);
      return buildAdjustedResearchSeries({ store, instrumentIdentityId, corporateActions: actions, asOfKnowableAt });
    },
    grantsExecutionAuthority: false,
  });
}
