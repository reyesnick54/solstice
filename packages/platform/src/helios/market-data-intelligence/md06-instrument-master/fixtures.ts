/**
 * Reference instrument master fixtures — symbol change, split, futures, venue mapping.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import {
  corporateActionIdFor,
  contractLifecycleIdFor,
  instrumentIdentityIdFor,
  listingIdFor,
  tradingSessionIdFor,
  venueInstrumentIdFor,
} from './ids.ts';
import type { InstrumentMasterStore } from './store.ts';
import type {
  ContractLifecycle,
  CorporateAction,
  InstrumentIdentity,
  InstrumentListing,
  RawPriceObservation,
  TradingSession,
  VenueInstrument,
} from './types.ts';
import type { PriceSeriesView } from './types.ts';

const T = (iso: string): UtcInstant => asUtcInstant(iso);

export const MD06_FIXTURE_META_IDENTITY = instrumentIdentityIdFor('isin:US30303M1027');
export const MD06_FIXTURE_META_FIGI = 'BBG000MM2P62';
export const MD06_FIXTURE_NVDA_IDENTITY = instrumentIdentityIdFor('isin:US67066G1040');
export const MD06_FIXTURE_CLH24_IDENTITY = instrumentIdentityIdFor('figi:BBG00CLH24NYM');

export type InstrumentMasterGraphBinding = {
  readonly identity: InstrumentIdentity;
  readonly listing: InstrumentListing | null;
  readonly venueInstrument: VenueInstrument | null;
  readonly session: TradingSession | null;
  readonly contract: ContractLifecycle | null;
};

export type InstrumentMasterSeedBundle = {
  readonly identities: readonly InstrumentIdentity[];
  readonly listings: readonly InstrumentListing[];
  readonly venueInstruments: readonly VenueInstrument[];
  readonly tradingSessions: readonly TradingSession[];
  readonly corporateActions: readonly CorporateAction[];
  readonly contractLifecycles: readonly ContractLifecycle[];
  readonly rawPrices: readonly RawPriceObservation[];
  readonly graphBindings: readonly InstrumentMasterGraphBinding[];
};

export type Md06InstrumentMasterFabric = {
  readonly store: InstrumentMasterStore;
  readonly graph: TemporalEntityGraphStore | null;
  readonly adjustedResearchSeries: (
    instrumentIdentityId: string,
    asOfKnowableAt: UtcInstant,
  ) => PriceSeriesView;
  readonly grantsExecutionAuthority: false;
};

export function md06ReferenceSeedBundle(): InstrumentMasterSeedBundle {
  const metaIdentity: InstrumentIdentity = Object.freeze({
    instrumentIdentityId: MD06_FIXTURE_META_IDENTITY,
    displayName: 'Meta Platforms Inc.',
    assetClass: 'equity',
    identifiers: Object.freeze([
      Object.freeze({
        system: 'figi',
        value: MD06_FIXTURE_META_FIGI,
        effectiveFrom: T('2012-05-18T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('2012-05-19T00:00:00.000Z'),
      }),
      Object.freeze({
        system: 'isin',
        value: 'US30303M1027',
        effectiveFrom: T('2012-05-18T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('2012-05-19T00:00:00.000Z'),
      }),
      Object.freeze({
        system: 'cik',
        value: '0001326801',
        effectiveFrom: T('2012-05-18T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('2012-05-19T00:00:00.000Z'),
      }),
    ]),
    temporalGraphSecurityNodeId: null,
    grantsExecutionAuthority: false,
  });

  const fbListing: InstrumentListing = Object.freeze({
    listingId: listingIdFor('meta:fb:xnas'),
    instrumentIdentityId: MD06_FIXTURE_META_IDENTITY,
    ticker: 'FB',
    mic: 'XNAS',
    currency: 'USD',
    effectiveFrom: T('2012-05-18T00:00:00.000Z'),
    effectiveTo: T('2022-06-09T00:00:00.000Z'),
    knowableAt: T('2012-05-19T00:00:00.000Z'),
    temporalGraphListingNodeId: null,
    grantsExecutionAuthority: false,
  });

  const metaListing: InstrumentListing = Object.freeze({
    listingId: listingIdFor('meta:meta:xnas'),
    instrumentIdentityId: MD06_FIXTURE_META_IDENTITY,
    ticker: 'META',
    mic: 'XNAS',
    currency: 'USD',
    effectiveFrom: T('2022-06-09T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
    temporalGraphListingNodeId: null,
    grantsExecutionAuthority: false,
  });

  const metaVenue: VenueInstrument = Object.freeze({
    venueInstrumentId: venueInstrumentIdFor('xnas:meta:meta'),
    instrumentIdentityId: MD06_FIXTURE_META_IDENTITY,
    listingId: metaListing.listingId,
    venueId: 'NASDAQ',
    mic: 'XNAS',
    exchangeNativeId: 'META',
    effectiveFrom: T('2022-06-09T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
    temporalGraphVenueInstrumentNodeId: null,
    grantsExecutionAuthority: false,
  });

  const nasdaqRegular: TradingSession = Object.freeze({
    sessionId: tradingSessionIdFor('xnas:regular'),
    venueId: 'NASDAQ',
    mic: 'XNAS',
    sessionName: 'NASDAQ Regular',
    openTimeUtc: '14:30',
    closeTimeUtc: '21:00',
    effectiveFrom: T('2000-01-01T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('2000-01-02T00:00:00.000Z'),
    temporalGraphSessionNodeId: null,
    grantsExecutionAuthority: false,
  });

  const symbolChange: CorporateAction = Object.freeze({
    corporateActionId: corporateActionIdFor('meta:symbol_change'),
    instrumentIdentityId: MD06_FIXTURE_META_IDENTITY,
    kind: 'symbol_change',
    announcementTime: T('2022-02-15T00:00:00.000Z'),
    exDate: T('2022-06-09T00:00:00.000Z'),
    recordDate: null,
    paymentDate: null,
    knowableAt: T('2022-06-10T00:00:00.000Z'),
    ratioNumerator: null,
    ratioDenominator: null,
    cashAmountMinor: null,
    currency: null,
    fromTicker: 'FB',
    toTicker: 'META',
    grantsExecutionAuthority: false,
  });

  const nvdaIdentity: InstrumentIdentity = Object.freeze({
    instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
    displayName: 'NVIDIA Corporation',
    assetClass: 'equity',
    identifiers: Object.freeze([
      Object.freeze({
        system: 'isin',
        value: 'US67066G1040',
        effectiveFrom: T('1999-01-01T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('1999-01-02T00:00:00.000Z'),
      }),
      Object.freeze({
        system: 'ticker',
        value: 'NVDA',
        effectiveFrom: T('1999-01-01T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('1999-01-02T00:00:00.000Z'),
      }),
    ]),
    temporalGraphSecurityNodeId: null,
    grantsExecutionAuthority: false,
  });

  const nvdaListing: InstrumentListing = Object.freeze({
    listingId: listingIdFor('nvda:xnas'),
    instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
    ticker: 'NVDA',
    mic: 'XNAS',
    currency: 'USD',
    effectiveFrom: T('1999-01-01T00:00:00.000Z'),
    effectiveTo: null,
    knowableAt: T('1999-01-02T00:00:00.000Z'),
    temporalGraphListingNodeId: null,
    grantsExecutionAuthority: false,
  });

  const split: CorporateAction = Object.freeze({
    corporateActionId: corporateActionIdFor('nvda:split:2024'),
    instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
    kind: 'split',
    announcementTime: T('2024-05-01T00:00:00.000Z'),
    exDate: T('2024-06-10T00:00:00.000Z'),
    recordDate: T('2024-06-11T00:00:00.000Z'),
    paymentDate: T('2024-06-12T00:00:00.000Z'),
    knowableAt: T('2024-05-02T00:00:00.000Z'),
    ratioNumerator: 10,
    ratioDenominator: 1,
    cashAmountMinor: null,
    currency: null,
    fromTicker: null,
    toTicker: null,
    grantsExecutionAuthority: false,
  });

  const clContract: ContractLifecycle = Object.freeze({
    contractLifecycleId: contractLifecycleIdFor('nymex:cl:2024-03'),
    instrumentIdentityId: MD06_FIXTURE_CLH24_IDENTITY,
    underlyingInstrumentIdentityId: null,
    expiry: T('2024-02-20T00:00:00.000Z'),
    firstNotice: T('2024-01-20T00:00:00.000Z'),
    lastTrade: T('2024-02-19T00:00:00.000Z'),
    delivery: T('2024-02-29T00:00:00.000Z'),
    multiplier: 1000,
    tickSize: 0.01,
    optionStrike: null,
    putCall: null,
    knowableAt: T('2023-01-01T00:00:00.000Z'),
    grantsExecutionAuthority: false,
  });

  const clIdentity: InstrumentIdentity = Object.freeze({
    instrumentIdentityId: MD06_FIXTURE_CLH24_IDENTITY,
    displayName: 'WTI Crude Mar 2024',
    assetClass: 'future',
    identifiers: Object.freeze([
      Object.freeze({
        system: 'figi',
        value: 'BBG00CLH24NYM',
        effectiveFrom: T('2023-01-01T00:00:00.000Z'),
        effectiveTo: null,
        knowableAt: T('2023-01-02T00:00:00.000Z'),
      }),
      Object.freeze({
        system: 'exchange_native_id',
        value: 'CLH24',
        effectiveFrom: T('2023-01-01T00:00:00.000Z'),
        effectiveTo: T('2024-02-20T00:00:00.000Z'),
        knowableAt: T('2023-01-02T00:00:00.000Z'),
      }),
    ]),
    temporalGraphSecurityNodeId: null,
    grantsExecutionAuthority: false,
  });

  const rawNvda: readonly RawPriceObservation[] = Object.freeze([
    Object.freeze({
      observationId: 'raw:nvda:2024-06-09',
      instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
      seriesKind: 'RAW' as const,
      eventTime: T('2024-06-09T00:00:00.000Z'),
      knowableAt: T('2024-06-09T01:00:00.000Z'),
      closeMinor: 120_000n,
      volume: 1_000_000n,
      immutable: true as const,
    }),
    Object.freeze({
      observationId: 'raw:nvda:2024-06-10',
      instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
      seriesKind: 'RAW' as const,
      eventTime: T('2024-06-10T00:00:00.000Z'),
      knowableAt: T('2024-06-10T01:00:00.000Z'),
      closeMinor: 12_000n,
      volume: 5_000_000n,
      immutable: true as const,
    }),
  ]);

  return Object.freeze({
    identities: Object.freeze([metaIdentity, nvdaIdentity, clIdentity]),
    listings: Object.freeze([fbListing, metaListing, nvdaListing]),
    venueInstruments: Object.freeze([metaVenue]),
    tradingSessions: Object.freeze([nasdaqRegular]),
    corporateActions: Object.freeze([symbolChange, split]),
    contractLifecycles: Object.freeze([clContract]),
    rawPrices: rawNvda,
    graphBindings: Object.freeze([
      Object.freeze({
        identity: metaIdentity,
        listing: metaListing,
        venueInstrument: metaVenue,
        session: nasdaqRegular,
        contract: null,
      }),
      Object.freeze({
        identity: nvdaIdentity,
        listing: nvdaListing,
        venueInstrument: null,
        session: null,
        contract: null,
      }),
      Object.freeze({
        identity: clIdentity,
        listing: null,
        venueInstrument: null,
        session: null,
        contract: clContract,
      }),
    ]),
  });
}
