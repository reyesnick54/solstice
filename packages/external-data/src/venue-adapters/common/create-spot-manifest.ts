import {
  availableField,
  unavailableField,
  type VenueCapabilityManifest,
  type VenuePrecisionDeclaration,
  type VenueRateLimitDeclaration,
  type HeliosOs04VenueId,
} from '@solstice/provider-sdk';

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
  return Object.freeze({
    venueId: input.venueId,
    displayName: input.displayName,
    assetClasses: availableField(Object.freeze(['crypto_spot'] as const)),
    instruments: availableField(input.instruments),
    venues: availableField(Object.freeze([input.venueSurface])),
    marketData: Object.freeze({
      marketDataTypes: availableField(
        Object.freeze(['ticker', 'order_book', 'trades', 'candles'] as const),
      ),
      websocketAvailable: availableField(true),
      restAvailable: availableField(true),
      historicalDataSupport: availableField(true),
      timestampSemantics: availableField('exchange_event_time_ms'),
      rateLimits: availableField(input.rateLimits),
    }),
    orders: Object.freeze({
      orderTypes: availableField(
        Object.freeze(['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_LIMIT'] as const),
      ),
      tifTypes: availableField(Object.freeze(['GTC', 'IOC', 'FOK'] as const)),
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
    }),
    account: Object.freeze({
      sandboxAvailability: unavailableField<boolean>(),
      subAccountSupport: availableField(true),
      portfolioMarginSupport: unavailableField<boolean>(),
    }),
    reconciliation: Object.freeze({
      reconciliationSupport: availableField(true),
      fillHistoryAvailable: availableField(true),
      ledgerExportAvailable: unavailableField<boolean>(),
    }),
    healthState: 'HEALTHY',
    liveOrderPlacementEnabled: false,
    qualificationNotes: Object.freeze([
      ...input.qualificationNotes,
      'NATIVE05 clean-room TypeScript adapter — fixture qualification in CI',
      'Live execution and credential storage are not enabled',
    ]),
  });
}
