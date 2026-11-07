import type { UtcInstant } from '@solstice/domain';
import type {
  HeliosNormalizedBook,
  HeliosNormalizedQuote,
  HeliosNormalizedTrade,
  HeliosOs04VenueId,
} from '@solstice/provider-sdk';
import type { Md09SynchronizationScheme, Md09VenueRawTick } from '@solstice/external-data';
import { HELIOS_MD09_SCHEMA, type Md09MarketDataKind, type Md09VenueHealthState } from './taxonomy.ts';

export type Md09SequenceIntegrity = Readonly<{
  readonly lastSequence: number | null;
  readonly gapDetected: boolean;
  readonly resyncRequired: boolean;
  readonly checksumVerified: boolean | null;
  readonly snapshotAnchorId: string | null;
}>;

export type Md09NormalizedDerivatives = Readonly<{
  readonly fundingRate: string | null;
  readonly markPrice: string | null;
  readonly indexPrice: string | null;
  readonly openInterest: string | null;
  readonly liquidationPrice: string | null;
  readonly liquidationQuantity: string | null;
  readonly liquidationSide: 'buy' | 'sell' | 'unknown' | null;
}>;

export type Md09VenueStatusObservation = Readonly<{
  readonly status: 'online' | 'maintenance' | 'offline' | 'unknown';
  readonly message: string | null;
}>;

export type Md09MarketObservation = Readonly<{
  readonly schemaVersion: typeof HELIOS_MD09_SCHEMA;
  readonly kind: Md09MarketDataKind;
  readonly venueId: HeliosOs04VenueId;
  readonly symbolCanonical: string;
  readonly observedAtUtc: UtcInstant;
  readonly eventTimeUtc: string;
  readonly sequence: number | null;
  readonly quote: HeliosNormalizedQuote | null;
  readonly trade: HeliosNormalizedTrade | null;
  readonly l2Book: HeliosNormalizedBook | null;
  readonly l3BookAvailable: boolean;
  readonly derivatives: Md09NormalizedDerivatives;
  readonly venueStatus: Md09VenueStatusObservation | null;
  readonly synchronization: Md09SynchronizationScheme;
  readonly sequenceIntegrity: Md09SequenceIntegrity;
  readonly venueHealth: Md09VenueHealthState;
}>;

export type Md09CrossVenueState = Readonly<{
  readonly symbolCanonical: string;
  readonly observedAtUtc: UtcInstant;
  readonly bestExecutableBid: Readonly<{ readonly venueId: HeliosOs04VenueId; readonly price: string }> | null;
  readonly bestExecutableAsk: Readonly<{ readonly venueId: HeliosOs04VenueId; readonly price: string }> | null;
  readonly crossVenueSpread: string | null;
  readonly venueBasis: Readonly<Record<string, string>>;
  readonly fundingDispersion: string | null;
  readonly markIndexDivergence: Readonly<Record<string, string>>;
  /** Cross-venue opportunity is never labeled executable without downstream fee/latency/inventory context. */
  readonly executableOpportunity: Readonly<{
    readonly claimed: false;
    readonly reason:
      | 'fees_unknown'
      | 'transfer_restrictions_unknown'
      | 'latency_unknown'
      | 'inventory_unknown'
      | 'venue_health_incomplete';
  }>;
}>;

export type Md09VenueIngestTick = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly rawTick: Md09VenueRawTick;
}>;
