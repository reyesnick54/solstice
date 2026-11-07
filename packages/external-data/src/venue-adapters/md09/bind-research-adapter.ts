/**
 * Upgrade NATIVE05 venue adapters into MD09 fixture-backed research planes.
 */

import type { HeliosVenueAdapter } from '@solstice/provider-sdk';
import { HELIOS_MD09_VENUE_RESEARCH_SCHEMA, type Md09VenueResearchAdapter } from './types.ts';
import { describeMd09Synchronization } from './synchronization.ts';
import { buildMd09ReferenceStream } from './streams.ts';

export function bindMd09VenueResearchAdapter(adapter: HeliosVenueAdapter): Md09VenueResearchAdapter {
  if (adapter.liveExecutionEnabled !== false || adapter.liveOrderPlacementEnabled !== false) {
    throw new Error('MD09 research adapter requires live execution disabled');
  }
  const stream = buildMd09ReferenceStream(adapter);

  return Object.freeze({
    schemaVersion: HELIOS_MD09_VENUE_RESEARCH_SCHEMA,
    venueId: adapter.venueId,
    liveExecutionEnabled: false,
    liveOrderPlacementEnabled: false,
    describeSynchronization() {
      return describeMd09Synchronization(adapter);
    },
    referenceStream: Object.freeze(stream),
  });
}

export function bindAllMd09VenueResearchAdapters(
  adapters: readonly HeliosVenueAdapter[],
): readonly Md09VenueResearchAdapter[] {
  return Object.freeze(adapters.map((adapter) => bindMd09VenueResearchAdapter(adapter)));
}
