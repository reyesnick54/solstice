/**
 * Project MD06 records onto the canonical AAF03 temporal entity graph.
 */

import type { UtcInstant } from '@solstice/domain';

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import type {
  ContractLifecycle,
  InstrumentIdentity,
  InstrumentListing,
  TradingSession,
  VenueInstrument,
} from './types.ts';

export type Md06TemporalBridgeResult = {
  readonly securityNodeId: string | null;
  readonly listingNodeId: string | null;
  readonly venueInstrumentNodeId: string | null;
  readonly sessionNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

function edgeBase(knowableAt: UtcInstant) {
  return Object.freeze({
    evidenceRefs: Object.freeze(['evidence:md06:instrument-master']),
    source: 'fixture:md06-instrument-master',
    confidenceState: 'CONFIRMED' as const,
    ambiguityState: 'UNAMBIGUOUS' as const,
    confidence: null,
    observedAt: knowableAt,
    knowableAt,
    jurisdiction: 'US',
  });
}

export function bindInstrumentIdentityToTemporalGraph(
  graph: TemporalEntityGraphStore,
  identity: InstrumentIdentity,
  listing: InstrumentListing | null,
  venueInstrument: VenueInstrument | null,
  session: TradingSession | null,
  contract: ContractLifecycle | null,
): Md06TemporalBridgeResult {
  const knowableAt = listing?.knowableAt ?? identity.identifiers[0]?.knowableAt ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
  const base = edgeBase(knowableAt);

  const securityNodeId =
    identity.temporalGraphSecurityNodeId ??
    temporalEntityNodeIdFor(`md06:security:${identity.instrumentIdentityId}`);
  graph.upsertNode({
    nodeId: securityNodeId,
    kind: contract ? 'SECURITY' : 'SECURITY',
    displayName: identity.displayName,
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      instrumentIdentityId: identity.instrumentIdentityId,
      assetClass: identity.assetClass,
    }),
  });

  let listingNodeId: string | null = null;
  if (listing) {
    listingNodeId =
      listing.temporalGraphListingNodeId ?? temporalEntityNodeIdFor(`md06:listing:${listing.listingId}`);
    graph.upsertNode({
      nodeId: listingNodeId,
      kind: 'LISTING',
      displayName: `${listing.ticker} listing`,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({ ticker: listing.ticker, mic: listing.mic ?? '' }),
    });
    graph.appendEdge({
      ...base,
      relationshipType: 'LISTS',
      fromNodeId: securityNodeId,
      toNodeId: listingNodeId,
      effectiveFrom: listing.effectiveFrom,
      effectiveTo: listing.effectiveTo,
    });
  }

  let venueInstrumentNodeId: string | null = null;
  if (venueInstrument) {
    venueInstrumentNodeId =
      venueInstrument.temporalGraphVenueInstrumentNodeId ??
      temporalEntityNodeIdFor(`md06:venue_instrument:${venueInstrument.venueInstrumentId}`);
    graph.upsertNode({
      nodeId: venueInstrumentNodeId,
      kind: 'VENUE_INSTRUMENT',
      displayName: `${venueInstrument.exchangeNativeId} @ ${venueInstrument.mic}`,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({
        exchangeNativeId: venueInstrument.exchangeNativeId,
        mic: venueInstrument.mic,
      }),
    });
    if (listingNodeId) {
      graph.appendEdge({
        ...base,
        relationshipType: 'VENUE_INSTRUMENT_FOR',
        fromNodeId: venueInstrumentNodeId,
        toNodeId: listingNodeId,
        effectiveFrom: venueInstrument.effectiveFrom,
        effectiveTo: venueInstrument.effectiveTo,
      });
    }
    graph.registerProviderMapping({
      providerId: 'exchange',
      providerSymbol: venueInstrument.exchangeNativeId,
      providerInstrumentId: venueInstrument.exchangeNativeId,
      targetNodeId: venueInstrumentNodeId,
      ...base,
      effectiveFrom: venueInstrument.effectiveFrom,
      effectiveTo: venueInstrument.effectiveTo,
    });
  }

  let sessionNodeId: string | null = null;
  if (session) {
    sessionNodeId =
      session.temporalGraphSessionNodeId ?? temporalEntityNodeIdFor(`md06:session:${session.sessionId}`);
    graph.upsertNode({
      nodeId: sessionNodeId,
      kind: 'TRADING_SESSION',
      displayName: session.sessionName,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({
        openTimeUtc: session.openTimeUtc,
        closeTimeUtc: session.closeTimeUtc,
        mic: session.mic,
      }),
    });
    const venueNodeId = temporalEntityNodeIdFor(`md06:venue:${session.venueId}`);
    graph.upsertNode({
      nodeId: venueNodeId,
      kind: 'VENUE',
      displayName: session.venueId,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({ mic: session.mic }),
    });
    graph.appendEdge({
      ...base,
      relationshipType: 'HAS_TRADING_SESSION',
      fromNodeId: venueNodeId,
      toNodeId: sessionNodeId,
      effectiveFrom: session.effectiveFrom,
      effectiveTo: session.effectiveTo,
    });
  }

  if (contract) {
    graph.upsertNode({
      nodeId: temporalEntityNodeIdFor(`md06:contract:${contract.contractLifecycleId}`),
      kind: 'SECURITY',
      displayName: identity.displayName,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({
        expiry: contract.expiry,
        multiplier: String(contract.multiplier),
        tickSize: String(contract.tickSize),
      }),
    });
  }

  return Object.freeze({
    securityNodeId,
    listingNodeId,
    venueInstrumentNodeId,
    sessionNodeId,
    grantsExecutionAuthority: false,
  });
}
