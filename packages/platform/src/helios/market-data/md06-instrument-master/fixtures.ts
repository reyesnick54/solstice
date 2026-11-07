/**
 * MD06 reference instrument master fixtures — symbol change, split, futures, options.
 */

import { asUtcInstant } from '@solstice/domain';

import { createTemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { seedReferenceTemporalEntityGraph } from '../../feature-fabric/entity-resolution/fixtures.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import { instrumentIdentityIdFromPermanentIdentifier } from './identifiers.ts';
import { createInstrumentMasterStore, type InstrumentMasterStore } from './master-store.ts';
import {
  anchorInstrumentIdentityOnGraph,
  anchorListingOnGraph,
  anchorTradingSessionOnGraph,
} from './graph-bridge.ts';
import { HELIOS_MD06_AUTHORITY, HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA } from './taxonomy.ts';
import type { InstrumentIdentity } from './types.ts';

const T = (iso: string) => asUtcInstant(iso);

export type Md06ReferenceFixture = {
  readonly store: InstrumentMasterStore;
  readonly graph: ReturnType<typeof createTemporalEntityGraphStore>;
  readonly metaIdentityId: string;
  readonly metaFbListingId: string;
  readonly metaMetaListingId: string;
  readonly nvdaIdentityId: string;
  readonly clContractIdentityId: string;
  readonly nvdaCallIdentityId: string;
};

function identity(
  permanentKind: InstrumentIdentity['permanentIdentifierKind'],
  permanentValue: string,
  displayName: string,
  extra: InstrumentIdentity['identifiers'],
): InstrumentIdentity {
  const instrumentIdentityId = instrumentIdentityIdFromPermanentIdentifier(permanentKind, permanentValue);
  return Object.freeze({
    schema: HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
    authority: HELIOS_MD06_AUTHORITY,
    instrumentIdentityId,
    displayName,
    jurisdiction: 'US',
    permanentIdentifierKind: permanentKind,
    permanentIdentifierValue: permanentValue,
    identifiers: Object.freeze(extra),
    temporalGraphNodeId: temporalEntityNodeIdFor(`imid:${instrumentIdentityId}`),
    grantsExecutionAuthority: false,
  });
}

export function seedMd06ReferenceInstrumentMaster(): Md06ReferenceFixture {
  const store = createInstrumentMasterStore();
  const graph = createTemporalEntityGraphStore();
  seedReferenceTemporalEntityGraph(graph);

  const metaIdentity = identity('FIGI', 'BBG000MM2P62', 'Meta Platforms Inc.', Object.freeze([
    { kind: 'FIGI', value: 'BBG000MM2P62', effectiveFrom: T('2012-05-18T00:00:00.000Z'), effectiveTo: null, knowableAt: T('2012-05-19T00:00:00.000Z') },
    { kind: 'TICKER', value: 'FB', effectiveFrom: T('2012-05-18T00:00:00.000Z'), effectiveTo: T('2022-06-09T00:00:00.000Z'), knowableAt: T('2012-05-19T00:00:00.000Z') },
    { kind: 'TICKER', value: 'META', effectiveFrom: T('2022-06-09T00:00:00.000Z'), effectiveTo: null, knowableAt: T('2022-06-10T00:00:00.000Z') },
    { kind: 'CIK', value: '0001326801', effectiveFrom: T('2012-05-18T00:00:00.000Z'), effectiveTo: null, knowableAt: T('2012-05-19T00:00:00.000Z') },
  ]));
  store.putIdentity(metaIdentity);

  const metaIdentityNode = anchorInstrumentIdentityOnGraph(graph, metaIdentity, T('2012-05-18T00:00:00.000Z'), T('2012-05-19T00:00:00.000Z'));

  const fbListing = Object.freeze({
    listingId: 'listing:meta:fb:xnas',
    instrumentIdentityId: metaIdentity.instrumentIdentityId,
    canonicalInstrumentId: null,
    venueMic: 'XNAS',
    ticker: 'FB',
    effectiveFrom: T('2012-05-18T00:00:00.000Z'),
    effectiveTo: T('2022-06-09T00:00:00.000Z'),
    knowableAt: T('2012-05-19T00:00:00.000Z'),
    temporalGraphNodeId: temporalEntityNodeIdFor('listing:meta:fb:xnas'),
  });
  store.putListing(fbListing);
  anchorListingOnGraph(graph, fbListing, metaIdentityNode, T('2012-05-18T00:00:00.000Z'), T('2012-05-19T00:00:00.000Z'));

  const metaListing = Object.freeze({
    listingId: 'listing:meta:meta:xnas',
    instrumentIdentityId: metaIdentity.instrumentIdentityId,
    canonicalInstrumentId: null,
    venueMic: 'XNAS',
    ticker: 'META',
    effectiveFrom: T('2022-06-09T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
    temporalGraphNodeId: temporalEntityNodeIdFor('listing:meta:meta:xnas'),
  });
  store.putListing(metaListing);
  anchorListingOnGraph(graph, metaListing, metaIdentityNode, T('2022-06-09T00:00:00.000Z'), T('2022-06-10T00:00:00.000Z'));

  store.putCorporateAction(
    Object.freeze({
      actionId: 'corp:meta:symbol_change',
      instrumentIdentityId: metaIdentity.instrumentIdentityId,
      kind: 'SYMBOL_CHANGE',
      schedule: Object.freeze({
        announcementTime: T('2022-03-01T00:00:00.000Z'),
        exDate: T('2022-06-09T00:00:00.000Z'),
        recordDate: null,
        paymentDate: null,
        knowableAt: T('2022-06-10T00:00:00.000Z'),
      }),
      splitNumerator: null,
      splitDenominator: null,
      cashDividendMinorPerShare: null,
      newTicker: 'META',
      spinOffInstrumentIdentityId: null,
      mergerTargetInstrumentIdentityId: null,
      evidenceRefs: Object.freeze(['evidence:sec:meta:symbol']),
    }),
  );

  const nvdaIdentity = identity('FIGI', 'BBG000BBJQV0', 'NVIDIA Corporation', Object.freeze([
    { kind: 'FIGI', value: 'BBG000BBJQV0', effectiveFrom: T('1999-01-01T00:00:00.000Z'), effectiveTo: null, knowableAt: T('1999-01-02T00:00:00.000Z') },
    { kind: 'TICKER', value: 'NVDA', effectiveFrom: T('1999-01-01T00:00:00.000Z'), effectiveTo: null, knowableAt: T('1999-01-02T00:00:00.000Z') },
  ]));
  store.putIdentity(nvdaIdentity);
  anchorInstrumentIdentityOnGraph(graph, nvdaIdentity, T('1999-01-01T00:00:00.000Z'), T('1999-01-02T00:00:00.000Z'));

  store.putCorporateAction(
    Object.freeze({
      actionId: 'corp:nvda:split_2024',
      instrumentIdentityId: nvdaIdentity.instrumentIdentityId,
      kind: 'SPLIT',
      schedule: Object.freeze({
        announcementTime: T('2024-05-01T00:00:00.000Z'),
        exDate: T('2024-06-10T00:00:00.000Z'),
        recordDate: T('2024-06-11T00:00:00.000Z'),
        paymentDate: T('2024-06-14T00:00:00.000Z'),
        knowableAt: T('2024-06-10T12:00:00.000Z'),
      }),
      splitNumerator: 10,
      splitDenominator: 1,
      cashDividendMinorPerShare: null,
      newTicker: null,
      spinOffInstrumentIdentityId: null,
      mergerTargetInstrumentIdentityId: null,
      evidenceRefs: Object.freeze(['evidence:fixture:nvda:split']),
    }),
  );

  store.appendRawBar({
    instrumentIdentityId: nvdaIdentity.instrumentIdentityId,
    barTime: T('2024-06-09T21:00:00.000Z'),
    openMinor: 120_000n,
    highMinor: 121_000n,
    lowMinor: 119_500n,
    closeMinor: 120_500n,
    volume: 50_000_000n,
    observationId: 'obs:nvda:raw:pre_split',
    knowableAt: T('2024-06-09T22:00:00.000Z'),
  });
  store.appendRawBar({
    instrumentIdentityId: nvdaIdentity.instrumentIdentityId,
    barTime: T('2024-06-10T21:00:00.000Z'),
    openMinor: 121_000n,
    highMinor: 122_000n,
    lowMinor: 120_000n,
    closeMinor: 121_500n,
    volume: 48_000_000n,
    observationId: 'obs:nvda:raw:post_split',
    knowableAt: T('2024-06-10T22:00:00.000Z'),
  });
  store.rebuildAdjustedResearch(nvdaIdentity.instrumentIdentityId, T('2024-12-01T00:00:00.000Z'));

  const clIdentity = identity('EXCHANGE_NATIVE_ID', 'CLH24', 'WTI Crude Mar 2024', Object.freeze([
    { kind: 'EXCHANGE_NATIVE_ID', value: 'CLH24', effectiveFrom: T('2024-01-01T00:00:00.000Z'), effectiveTo: T('2024-03-20T00:00:00.000Z'), knowableAt: T('2024-01-01T00:00:00.000Z') },
    { kind: 'MIC', value: 'XNYM', effectiveFrom: T('2024-01-01T00:00:00.000Z'), effectiveTo: null, knowableAt: T('2024-01-01T00:00:00.000Z') },
  ]));
  store.putIdentity(clIdentity);
  store.putContractLifecycle(
    Object.freeze({
      contractLifecycleId: 'lifecycle:clh24',
      instrumentIdentityId: clIdentity.instrumentIdentityId,
      underlyingInstrumentIdentityId: null,
      expiry: T('2024-03-19T00:00:00.000Z'),
      firstNotice: T('2024-02-01T00:00:00.000Z'),
      lastTrade: T('2024-03-18T00:00:00.000Z'),
      delivery: T('2024-03-22T00:00:00.000Z'),
      multiplierMinorUnits: 1000_00n,
      multiplierScale: 2,
      tickSizeMinorUnits: 1n,
      tickSizeScale: 2,
      optionStrikeMinorUnits: null,
      optionStrikeScale: 0,
      putCall: null,
      knowableAt: T('2024-01-01T00:00:00.000Z'),
    }),
  );

  const nvdaCallIdentity = identity('FIGI', 'BBG00NVDAOPT1', 'NVDA Call Option', Object.freeze([
    { kind: 'FIGI', value: 'BBG00NVDAOPT1', effectiveFrom: T('2024-01-01T00:00:00.000Z'), effectiveTo: null, knowableAt: T('2024-01-01T00:00:00.000Z') },
  ]));
  store.putIdentity(nvdaCallIdentity);
  store.putContractLifecycle(
    Object.freeze({
      contractLifecycleId: 'lifecycle:nvda:call',
      instrumentIdentityId: nvdaCallIdentity.instrumentIdentityId,
      underlyingInstrumentIdentityId: nvdaIdentity.instrumentIdentityId,
      expiry: T('2024-09-20T00:00:00.000Z'),
      firstNotice: null,
      lastTrade: T('2024-09-20T00:00:00.000Z'),
      delivery: null,
      multiplierMinorUnits: 100n,
      multiplierScale: 0,
      tickSizeMinorUnits: 5n,
      tickSizeScale: 2,
      optionStrikeMinorUnits: 900_00n,
      optionStrikeScale: 2,
      putCall: 'CALL',
      knowableAt: T('2024-01-01T00:00:00.000Z'),
    }),
  );

  const nasdaqVenue = graph.getNode(temporalEntityNodeIdFor('venue:xnas'));
  if (nasdaqVenue) {
    store.putTradingSession(
      Object.freeze({
        sessionId: 'session:xnas:2024-06-10',
        venueMic: 'XNAS',
        calendarDate: '2024-06-10',
        sessionOpen: T('2024-06-10T13:30:00.000Z'),
        sessionClose: T('2024-06-10T20:00:00.000Z'),
        knowableAt: T('2024-06-10T00:00:00.000Z'),
        temporalGraphNodeId: temporalEntityNodeIdFor('session:xnas:2024-06-10'),
      }),
    );
    const session = store.listTradingSessions()[0]!;
    anchorTradingSessionOnGraph(graph, session, nasdaqVenue.nodeId, session.sessionOpen, session.knowableAt);
  }

  store.putVenueInstrument(
    Object.freeze({
      venueInstrumentId: 'vi:nvda:xnas',
      instrumentIdentityId: nvdaIdentity.instrumentIdentityId,
      venueMic: 'XNAS',
      exchangeNativeId: 'NVDA',
      providerNativeId: 'polygon:nvda',
      effectiveFrom: T('1999-01-01T00:00:00.000Z'),
      effectiveTo: null,
      knowableAt: T('1999-01-02T00:00:00.000Z'),
    }),
  );

  return Object.freeze({
    store,
    graph,
    metaIdentityId: metaIdentity.instrumentIdentityId,
    metaFbListingId: fbListing.listingId,
    metaMetaListingId: metaListing.listingId,
    nvdaIdentityId: nvdaIdentity.instrumentIdentityId,
    clContractIdentityId: clIdentity.instrumentIdentityId,
    nvdaCallIdentityId: nvdaCallIdentity.instrumentIdentityId,
  });
}
