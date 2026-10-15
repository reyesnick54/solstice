import { asUtcInstant } from '../../../../../domain/src/time.ts';
import {
  heliosIssuerCanonicalEntityId,
} from '../../../../../economic-asset-registry/src/knowledge-graph/helios-temporal-bridge.ts';
import type { TemporalEntityGraphStore } from './graph-store.ts';
import { temporalEntityNodeIdFor } from './ids.ts';

const T = (iso: string) => asUtcInstant(iso);

export type ReferenceGraphHandles = {
  readonly appleListingNasdaq: string;
  readonly aaplCommon: string;
  readonly metaReuseSymbol: string;
  readonly dualListingHk: string;
  readonly googClassC: string;
  readonly delistedSecurity: string;
  readonly ambiguousProviderSymbol: string;
  readonly clContinuous: string;
  readonly clContract: string;
  readonly btcUsd: string;
  readonly btcUsdt: string;
};

export function seedReferenceTemporalEntityGraph(store: TemporalEntityGraphStore): ReferenceGraphHandles {
  const appleEkg = heliosIssuerCanonicalEntityId('apple_inc');
  const appleLegal = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('legal:apple_inc'),
    kind: 'LEGAL_ENTITY',
    displayName: 'Apple Inc.',
    jurisdiction: 'US',
    economicKnowledgeEntityId: appleEkg,
    payload: Object.freeze({ cik: '0000320193' }),
  });
  const appleIssuer = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('issuer:apple_inc'),
    kind: 'ISSUER',
    displayName: 'Apple Inc. (issuer)',
    jurisdiction: 'US',
    economicKnowledgeEntityId: appleEkg,
    payload: Object.freeze({}),
  });
  const aapl = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('security:aapl_common'),
    kind: 'SECURITY',
    displayName: 'AAPL Common Stock',
    jurisdiction: 'US',
    economicKnowledgeEntityId: appleEkg,
    payload: Object.freeze({ symbol: 'AAPL', shareClass: 'COMMON' }),
  });
  const nasdaq = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('venue:xnas'),
    kind: 'VENUE',
    displayName: 'NASDAQ',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ mic: 'XNAS' }),
  });
  const appleListing = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:aapl_xnas'),
    kind: 'LISTING',
    displayName: 'AAPL @ NASDAQ',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'AAPL' }),
  });

  const edgeBase = {
    evidenceRefs: Object.freeze(['evidence:sec-edgar:apple']),
    source: 'fixture:sec-edgar',
    confidenceState: 'CONFIRMED' as const,
    ambiguityState: 'UNAMBIGUOUS' as const,
    observedAt: T('2010-01-01T00:00:00.000Z'),
    knowableAt: T('2010-01-02T00:00:00.000Z'),
    jurisdiction: 'US',
  };

  store.appendEdge({
    ...edgeBase,
    relationshipType: 'IDENTIFIED_BY',
    fromNodeId: appleLegal.nodeId,
    toNodeId: appleIssuer.nodeId,
    effectiveFrom: T('1980-12-12T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'ISSUES',
    fromNodeId: appleIssuer.nodeId,
    toNodeId: aapl.nodeId,
    effectiveFrom: T('1980-12-12T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'LISTS',
    fromNodeId: aapl.nodeId,
    toNodeId: appleListing.nodeId,
    effectiveFrom: T('1980-12-12T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'TRADES_ON',
    fromNodeId: appleListing.nodeId,
    toNodeId: nasdaq.nodeId,
    effectiveFrom: T('1980-12-12T00:00:00.000Z'),
    effectiveTo: null,
  });

  store.registerProviderMapping({
    providerId: 'polygon',
    providerSymbol: 'AAPL',
    providerInstrumentId: 'poly:aapl',
    targetNodeId: appleListing.nodeId,
    ...edgeBase,
    effectiveFrom: T('2015-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Ticker reuse — FB (2012) vs META (2022)
  const metaEkg = heliosIssuerCanonicalEntityId('meta_platforms');
  const metaIssuer = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('issuer:meta'),
    kind: 'ISSUER',
    displayName: 'Meta Platforms',
    jurisdiction: 'US',
    economicKnowledgeEntityId: metaEkg,
    payload: Object.freeze({}),
  });
  const fbListing = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:fb'),
    kind: 'LISTING',
    displayName: 'FB @ NASDAQ',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'FB' }),
  });
  const metaListing = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:meta'),
    kind: 'LISTING',
    displayName: 'META @ NASDAQ',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'META' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'LISTS',
    fromNodeId: metaIssuer.nodeId,
    toNodeId: fbListing.nodeId,
    effectiveFrom: T('2012-05-18T00:00:00.000Z'),
    effectiveTo: T('2022-06-09T00:00:00.000Z'),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'REPLACED_BY',
    fromNodeId: fbListing.nodeId,
    toNodeId: metaListing.nodeId,
    effectiveFrom: T('2022-06-09T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
  });
  store.registerProviderMapping({
    providerId: 'polygon',
    providerSymbol: 'FB',
    providerInstrumentId: 'poly:fb',
    targetNodeId: fbListing.nodeId,
    ...edgeBase,
    effectiveFrom: T('2012-05-18T00:00:00.000Z'),
    effectiveTo: T('2022-06-09T00:00:00.000Z'),
  });
  store.registerProviderMapping({
    providerId: 'polygon',
    providerSymbol: 'META',
    providerInstrumentId: 'poly:meta',
    targetNodeId: metaListing.nodeId,
    ...edgeBase,
    effectiveFrom: T('2022-06-09T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
  });

  // Merger — acquiredCo absorbed
  const acquirer = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Acquirer Corp',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('acquirer_corp'),
    payload: Object.freeze({}),
  });
  const acquired = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Acquired Co',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('acquired_co'),
    payload: Object.freeze({}),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'MERGED_INTO',
    fromNodeId: acquired.nodeId,
    toNodeId: acquirer.nodeId,
    effectiveFrom: T('2019-07-01T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2019-07-02T00:00:00.000Z'),
  });

  // Spin-off
  const parentSpin = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Spin Parent',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('spin_parent'),
    payload: Object.freeze({}),
  });
  const spinChild = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Spin Child Co',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('spin_child'),
    payload: Object.freeze({}),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'SPIN_OFF_FROM',
    fromNodeId: spinChild.nodeId,
    toNodeId: parentSpin.nodeId,
    effectiveFrom: T('2020-11-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Dual listing
  const dualIssuer = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Dual Listed PLC',
    jurisdiction: 'GB',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('dual_listed_plc'),
    payload: Object.freeze({}),
  });
  const dualNy = store.upsertNode({
    kind: 'LISTING',
    displayName: 'DL @ NYSE',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'DL' }),
  });
  const dualHk = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:dl_hk'),
    kind: 'LISTING',
    displayName: 'DL @ HKEX',
    jurisdiction: 'HK',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: '1234' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'DUAL_LISTED_AS',
    fromNodeId: dualNy.nodeId,
    toNodeId: dualHk.nodeId,
    effectiveFrom: T('2005-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'LISTS',
    fromNodeId: dualIssuer.nodeId,
    toNodeId: dualHk.nodeId,
    effectiveFrom: T('2005-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Share classes GOOG / GOOGL
  const alphabet = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Alphabet Inc.',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('alphabet_inc'),
    payload: Object.freeze({}),
  });
  const googC = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('security:goog_c'),
    kind: 'SECURITY',
    displayName: 'GOOG Class C',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('alphabet_inc'),
    payload: Object.freeze({ symbol: 'GOOG', shareClass: 'C', variant: 'CLASS_C' }),
  });
  const googA = store.upsertNode({
    kind: 'SECURITY',
    displayName: 'GOOGL Class A',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('alphabet_inc'),
    payload: Object.freeze({ symbol: 'GOOGL', shareClass: 'A', variant: 'CLASS_A' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'SHARE_CLASS_OF',
    fromNodeId: googC.nodeId,
    toNodeId: googA.nodeId,
    effectiveFrom: T('2014-04-03T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'ISSUES',
    fromNodeId: alphabet.nodeId,
    toNodeId: googC.nodeId,
    effectiveFrom: T('2014-04-03T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Brand vs parent
  const brandParent = store.upsertNode({
    kind: 'LEGAL_ENTITY',
    displayName: 'Conglomerate Holdings',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('conglomerate_holdings'),
    payload: Object.freeze({}),
  });
  const consumerBrand = store.upsertNode({
    kind: 'BRAND',
    displayName: 'Famous Brand',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({}),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'OWNS_BRAND',
    fromNodeId: brandParent.nodeId,
    toNodeId: consumerBrand.nodeId,
    effectiveFrom: T('2000-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Delisted security
  const delisted = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('security:delisted_xyz'),
    kind: 'SECURITY',
    displayName: 'XYZ Delisted',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('xyz_corp'),
    payload: Object.freeze({ symbol: 'XYZ' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'DELISTED_AS_OF',
    fromNodeId: delisted.nodeId,
    toNodeId: nasdaq.nodeId,
    effectiveFrom: T('2018-03-01T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2018-03-02T00:00:00.000Z'),
  });
  store.registerProviderMapping({
    providerId: 'polygon',
    providerSymbol: 'XYZ',
    providerInstrumentId: 'poly:xyz',
    targetNodeId: delisted.nodeId,
    ...edgeBase,
    effectiveFrom: T('2010-01-01T00:00:00.000Z'),
    effectiveTo: T('2018-03-01T00:00:00.000Z'),
  });

  // Ambiguous provider symbol — two active mappings
  const ambA = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:amb_a'),
    kind: 'LISTING',
    displayName: 'Ambiguous A',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'AMB' }),
  });
  const ambB = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('listing:amb_b'),
    kind: 'LISTING',
    displayName: 'Ambiguous B',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ ticker: 'AMB' }),
  });
  for (const target of [ambA, ambB]) {
    store.registerProviderMapping({
      providerId: 'fixture',
      providerSymbol: 'AMB',
      providerInstrumentId: `fix:${target.nodeId}`,
      targetNodeId: target.nodeId,
      ...edgeBase,
      ambiguityState: 'AMBIGUOUS',
      effectiveFrom: T('2021-01-01T00:00:00.000Z'),
      effectiveTo: null,
    });
  }

  // Futures contract vs continuous research series
  const clContract = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('future:cl_2024h1'),
    kind: 'SECURITY',
    displayName: 'CL H24',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'CLH24', venueId: 'NYMEX', variant: 'CONTRACT' }),
  });
  const clContinuous = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('series:cl_continuous'),
    kind: 'ECONOMIC_SERIES',
    displayName: 'CL Continuous (research)',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'CL1!', venueId: 'RESEARCH', variant: 'CONTINUOUS' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'CONTINUOUS_SERIES_FOR',
    fromNodeId: clContinuous.nodeId,
    toNodeId: clContract.nodeId,
    effectiveFrom: T('2024-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.registerProviderMapping({
    providerId: 'refinitiv',
    providerSymbol: 'CL1!',
    providerInstrumentId: 'ref:cl_continuous',
    targetNodeId: clContinuous.nodeId,
    ...edgeBase,
    effectiveFrom: T('2024-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.registerProviderMapping({
    providerId: 'refinitiv',
    providerSymbol: 'CLH24',
    providerInstrumentId: 'ref:clh24',
    targetNodeId: clContract.nodeId,
    ...edgeBase,
    effectiveFrom: T('2024-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // Crypto BTC/USD vs BTC/USDT
  const btcAsset = store.upsertNode({
    kind: 'CRYPTO_ASSET',
    displayName: 'Bitcoin',
    jurisdiction: 'GLOBAL',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ asset: 'BTC' }),
  });
  const btcUsd = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('crypto:btc_usd'),
    kind: 'CRYPTO_VENUE_INSTRUMENT',
    displayName: 'BTC/USD',
    jurisdiction: 'GLOBAL',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'BTCUSD', providerId: 'coinbase', quote: 'USD' }),
  });
  const btcUsdt = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('crypto:btc_usdt'),
    kind: 'CRYPTO_VENUE_INSTRUMENT',
    displayName: 'BTC/USDT',
    jurisdiction: 'GLOBAL',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'BTCUSDT', providerId: 'binance', quote: 'USDT' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'TRADES_ON',
    fromNodeId: btcUsd.nodeId,
    toNodeId: btcAsset.nodeId,
    effectiveFrom: T('2015-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'TRADES_ON',
    fromNodeId: btcUsdt.nodeId,
    toNodeId: btcAsset.nodeId,
    effectiveFrom: T('2017-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.registerProviderMapping({
    providerId: 'coinbase',
    providerSymbol: 'BTC/USD',
    providerInstrumentId: 'cb:btc-usd',
    targetNodeId: btcUsd.nodeId,
    ...edgeBase,
    effectiveFrom: T('2015-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });
  store.registerProviderMapping({
    providerId: 'binance',
    providerSymbol: 'BTC/USDT',
    providerInstrumentId: 'bn:btc-usdt',
    targetNodeId: btcUsdt.nodeId,
    ...edgeBase,
    effectiveFrom: T('2017-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // ETF sponsor vs fund
  const sponsor = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'ETF Sponsor LLC',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('etf_sponsor'),
    payload: Object.freeze({}),
  });
  const etf = store.upsertNode({
    kind: 'SECURITY',
    displayName: 'Sandbox ETF',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('etf_sponsor'),
    payload: Object.freeze({ symbol: 'SIMETF', assetClass: 'ETF' }),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'SPONSORS',
    fromNodeId: sponsor.nodeId,
    toNodeId: etf.nodeId,
    effectiveFrom: T('2016-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  // ADR example
  const adr = store.upsertNode({
    kind: 'SECURITY',
    displayName: 'Toyota ADR',
    jurisdiction: 'US',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('toyota_adr'),
    payload: Object.freeze({ symbol: 'TM', isAdr: 'true' }),
  });
  const toyotaJp = store.upsertNode({
    kind: 'ISSUER',
    displayName: 'Toyota Motor Corp',
    jurisdiction: 'JP',
    economicKnowledgeEntityId: heliosIssuerCanonicalEntityId('toyota_motor'),
    payload: Object.freeze({}),
  });
  store.appendEdge({
    ...edgeBase,
    relationshipType: 'ADR_OF',
    fromNodeId: adr.nodeId,
    toNodeId: toyotaJp.nodeId,
    effectiveFrom: T('2000-01-01T00:00:00.000Z'),
    effectiveTo: null,
  });

  return Object.freeze({
    appleListingNasdaq: appleListing.nodeId,
    aaplCommon: aapl.nodeId,
    metaReuseSymbol: metaListing.nodeId,
    dualListingHk: dualHk.nodeId,
    googClassC: googC.nodeId,
    delistedSecurity: delisted.nodeId,
    ambiguousProviderSymbol: ambA.nodeId,
    clContinuous: clContinuous.nodeId,
    clContract: clContract.nodeId,
    btcUsd: btcUsd.nodeId,
    btcUsdt: btcUsdt.nodeId,
  });
}
