/**
 * Bind MD06 instrument master records to the AAF03 temporal entity graph.
 */

import type { UtcInstant } from '@solstice/domain';

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import type { InstrumentIdentity, InstrumentListing, TradingSession } from './types.ts';

export type Md06GraphBridgeResult = {
  readonly identityNodeId: string;
  readonly listingNodeId: string | null;
  readonly sessionNodeId: string | null;
};

export function anchorInstrumentIdentityOnGraph(
  store: TemporalEntityGraphStore,
  identity: InstrumentIdentity,
  observedAt: UtcInstant,
  knowableAt: UtcInstant,
): string {
  const nodeId = identity.temporalGraphNodeId ?? temporalEntityNodeIdFor(`imid:${identity.instrumentIdentityId}`);
  store.upsertNode({
    nodeId,
    kind: 'INSTRUMENT_IDENTITY',
    displayName: identity.displayName,
    jurisdiction: identity.jurisdiction,
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      instrumentIdentityId: identity.instrumentIdentityId,
      permanentKind: identity.permanentIdentifierKind,
      permanentValue: identity.permanentIdentifierValue,
      figi: identity.identifiers.find((row) => row.kind === 'FIGI')?.value ?? '',
      isin: identity.identifiers.find((row) => row.kind === 'ISIN')?.value ?? '',
    }),
  });
  return nodeId;
}

export function anchorListingOnGraph(
  store: TemporalEntityGraphStore,
  listing: InstrumentListing,
  identityNodeId: string,
  observedAt: UtcInstant,
  knowableAt: UtcInstant,
): string {
  const nodeId = listing.temporalGraphNodeId ?? temporalEntityNodeIdFor(`listing:${listing.listingId}`);
  store.upsertNode({
    nodeId,
    kind: 'LISTING',
    displayName: `${listing.ticker} @ ${listing.venueMic}`,
    jurisdiction: null,
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      ticker: listing.ticker,
      mic: listing.venueMic,
      instrumentIdentityId: listing.instrumentIdentityId,
      canonicalInstrumentId: listing.canonicalInstrumentId ?? '',
    }),
  });
  store.appendEdge({
    relationshipType: 'HAS_INSTRUMENT_IDENTITY',
    fromNodeId: nodeId,
    toNodeId: identityNodeId,
    evidenceRefs: Object.freeze(['evidence:md06:listing-identity']),
    source: 'helios:md06:instrument-master',
    confidenceState: 'CONFIRMED',
    ambiguityState: 'UNAMBIGUOUS',
    confidence: null,
    effectiveFrom: listing.effectiveFrom,
    effectiveTo: listing.effectiveTo,
    observedAt,
    knowableAt,
    jurisdiction: null,
  });
  store.registerProviderMapping({
    providerId: 'md06_fixture',
    providerSymbol: listing.ticker,
    providerInstrumentId: listing.listingId,
    targetNodeId: nodeId,
    evidenceRefs: Object.freeze(['evidence:md06:provider-map']),
    source: 'helios:md06:instrument-master',
    confidenceState: 'CONFIRMED',
    ambiguityState: 'UNAMBIGUOUS',
    confidence: null,
    effectiveFrom: listing.effectiveFrom,
    effectiveTo: listing.effectiveTo,
    observedAt,
    knowableAt,
    jurisdiction: null,
  });
  return nodeId;
}

export function anchorTradingSessionOnGraph(
  store: TemporalEntityGraphStore,
  session: TradingSession,
  venueNodeId: string,
  observedAt: UtcInstant,
  knowableAt: UtcInstant,
): string {
  const nodeId = session.temporalGraphNodeId ?? temporalEntityNodeIdFor(`session:${session.sessionId}`);
  store.upsertNode({
    nodeId,
    kind: 'TRADING_SESSION',
    displayName: `Session ${session.calendarDate} @ ${session.venueMic}`,
    jurisdiction: null,
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      sessionId: session.sessionId,
      mic: session.venueMic,
      calendarDate: session.calendarDate,
    }),
  });
  store.appendEdge({
    relationshipType: 'SESSION_AT_VENUE',
    fromNodeId: nodeId,
    toNodeId: venueNodeId,
    evidenceRefs: Object.freeze(['evidence:md06:session']),
    source: 'helios:md06:instrument-master',
    confidenceState: 'CONFIRMED',
    ambiguityState: 'UNAMBIGUOUS',
    confidence: null,
    effectiveFrom: session.sessionOpen,
    effectiveTo: session.sessionClose,
    observedAt,
    knowableAt,
    jurisdiction: null,
  });
  return nodeId;
}
