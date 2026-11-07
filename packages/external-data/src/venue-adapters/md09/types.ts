/**
 * HELIOS MD09 — venue research-plane types (external-data layer).
 * Research and fixture streams only; no live execution.
 */

import type { HeliosOs04VenueId } from '@solstice/provider-sdk';
import type { VenueSequencePolicy } from '@solstice/provider-sdk';

export const HELIOS_MD09_VENUE_RESEARCH_SCHEMA = 'helios.md09-venue-research.v1' as const;

export type Md09VenueRawKind =
  | 'quote'
  | 'trade'
  | 'book'
  | 'funding'
  | 'mark_price'
  | 'index_price'
  | 'open_interest'
  | 'liquidation'
  | 'venue_status';

export type Md09SynchronizationScheme = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly sequencePolicy: VenueSequencePolicy;
  /** Venue-native sequence field when present; null means venue does not expose monotonic sequence ids. */
  readonly sequenceField: 'sequence' | 'update_id' | 'checksum' | 'snapshot_anchor' | 'none';
  readonly snapshotAnchored: boolean;
  readonly checksumSupported: boolean;
}>;

export type Md09VenueRawTick = Readonly<{
  readonly tickId: string;
  readonly symbolCanonical: string;
  readonly kinds: readonly Md09VenueRawKind[];
  readonly quote?: unknown;
  readonly trade?: unknown;
  readonly book?: unknown;
  readonly funding?: unknown;
  readonly markPrice?: unknown;
  readonly indexPrice?: unknown;
  readonly openInterest?: unknown;
  readonly liquidation?: unknown;
  readonly venueStatus?: unknown;
  readonly l3Book?: unknown;
}>;

export type Md09VenueResearchAdapter = Readonly<{
  readonly schemaVersion: typeof HELIOS_MD09_VENUE_RESEARCH_SCHEMA;
  readonly venueId: HeliosOs04VenueId;
  readonly liveExecutionEnabled: false;
  readonly liveOrderPlacementEnabled: false;
  describeSynchronization(): Md09SynchronizationScheme;
  /** Fixture-backed continuous research stream (never live WebSocket in CI posture). */
  readonly referenceStream: readonly Md09VenueRawTick[];
}>;
