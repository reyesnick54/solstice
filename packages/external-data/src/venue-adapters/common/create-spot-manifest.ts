import {
  availableField,
  unavailableField,
  type VenueAssetClass,
  type VenueCapabilityManifest,
  type VenueMarketDataType,
  type VenueOrderType,
  type VenuePrecisionDeclaration,
  type VenueRateLimitDeclaration,
  type VenueTimeInForce,
  type HeliosOs04VenueId,
} from '@solstice/provider-sdk';

const CRYPTO_SPOT_ASSET_CLASSES: readonly VenueAssetClass[] = Object.freeze(['crypto_spot']);
const SPOT_MARKET_DATA_TYPES: readonly VenueMarketDataType[] = Object.freeze([
  'ticker',
  'order_book',
  'trades',
  'candles',
]);
const SPOT_ORDER_TYPES: readonly VenueOrderType[] = Object.freeze([
  'MARKET',
  'LIMIT',
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
]);
const SPOT_TIF_TYPES: readonly VenueTimeInForce[] = Object.freeze(['GTC', 'IOC', 'FOK']);

export function createNativeCryptoSpotManifest(input: {
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
  readonly instruments: readonly string[];
  readonly venueSurface: string;
  readonly rateLimits: VenueRateLimitDeclaration;
  readonly precision: VenuePrecisionDeclaration;
  readonly minQuantity: string;
  readonly minNotionalMinor: string;
  readonly qualificationNotes: readonly string[];
}): VenueCapabilityManifest {
  const manifest = {
    venueId: input.venueId,
    displayName: input.displayName,
    assetClasses: availableField(CRYPTO_SPOT_ASSET_CLASSES),
    instruments: availableField(input.instruments),
    venues: availableField(Object.freeze([input.venueSurface])),
    marketData: {
      marketDataTypes: availableField(SPOT_MARKET_DATA_TYPES),
      websocketAvailable: availableField(true),
      restAvailable: availableField(true),
      historicalDataSupport: availableField(true),
      timestampSemantics: availableField('exchange_event_time_ms'),
      rateLimits: availableField(input.rateLimits),
    },
    orders: {
      orderTypes: availableField(SPOT_ORDER_TYPES),
      tifTypes: availableField(SPOT_TIF_TYPES),
      precision: availableField(input.precision),
      minimumQuantity: availableField({ value: input.minQuantity, unit: 'BTC' }),
      minimumNotional: availableField({
        valueMinor: input.minNotionalMinor,
        currency: 'USD',
      }),
      makerTakerFees: availableField({ makerBps: 10, takerBps: 10, currency: 'USD' }),
      reduceOnlySupport: unavailableField<boolean>(),
      postOnlySupport: availableField(true),
      fundingSupport: unavailableField<boolean>(),
    },
    account: {
      sandboxAvailability: unavailableField<boolean>(),
      subAccountSupport: availableField(true),
      portfolioMarginSupport: unavailableField<boolean>(),
    },
    reconciliation: {
      reconciliationSupport: availableField(true),
      fillHistoryAvailable: availableField(true),
      ledgerExportAvailable: unavailableField<boolean>(),
    },
    healthState: 'HEALTHY',
    liveOrderPlacementEnabled: false,
    qualificationNotes: [
      ...input.qualificationNotes,
      'NATIVE05 clean-room TypeScript adapter — fixture qualification in CI',
      'Live execution and credential storage are not enabled',
    ],
  } satisfies VenueCapabilityManifest;
  return Object.freeze(manifest) as VenueCapabilityManifest;
}
