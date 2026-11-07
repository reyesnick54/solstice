import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_NATIVE_VENUE_ADAPTERS,
  bindAllMd09VenueResearchAdapters,
  bindMd09VenueResearchAdapter,
  type Md09VenueResearchAdapter,
} from '@solstice/external-data';
import type { HeliosVenueAdapter } from '@solstice/provider-sdk';
import { HELIOS_OS04_VENUE_IDS } from '@solstice/provider-sdk';
import { ingestMd09VenueSession, type Md09VenueSession } from './ingest.ts';
import { computeMd09CrossVenueState } from './cross-venue.ts';
import type { Md09CrossVenueState, Md09MarketObservation } from './types.ts';
import type { Md09VenueHealthState } from './taxonomy.ts';

export type Md09CryptoMarketFabricSnapshot = Readonly<{
  readonly observedAtUtc: UtcInstant;
  readonly venueSessions: readonly Md09VenueSession[];
  readonly observations: readonly Md09MarketObservation[];
  readonly venueHealth: Readonly<Record<string, Md09VenueHealthState>>;
  readonly crossVenue: Md09CrossVenueState;
  readonly grantsExecutionAuthority: false;
  readonly liveExecutionEnabled: false;
}>;

export type Md09CryptoMarketFabricOptions = Readonly<{
  readonly adapters?: readonly HeliosVenueAdapter[];
  readonly researchPlanes?: readonly Md09VenueResearchAdapter[];
}>;

export class Md09CryptoMarketFabric {
  readonly #adapters: readonly HeliosVenueAdapter[];
  readonly #research: readonly Md09VenueResearchAdapter[];

  constructor(options: Md09CryptoMarketFabricOptions = {}) {
    this.#adapters = options.adapters ?? HELIOS_NATIVE_VENUE_ADAPTERS;
    this.#research =
      options.researchPlanes ??
      bindAllMd09VenueResearchAdapters(this.#adapters);
  }

  listVenueIds(): readonly string[] {
    return Object.freeze([...HELIOS_OS04_VENUE_IDS]);
  }

  refresh(nowUtc: UtcInstant, symbolCanonical = 'BTC/USD'): Md09CryptoMarketFabricSnapshot {
    const sessions: Md09VenueSession[] = [];
    const observations: Md09MarketObservation[] = [];
    const venueHealth: Record<string, Md09VenueHealthState> = {};

    for (const adapter of this.#adapters) {
      const research =
        this.#research.find((row) => row.venueId === adapter.venueId) ??
        bindMd09VenueResearchAdapter(adapter);
      const session = ingestMd09VenueSession({ adapter, research, nowUtc });
      sessions.push(session);
      for (const obs of session.observations) {
        observations.push(obs);
      }
      const lastHealth = session.observations[session.observations.length - 1]?.venueHealth ?? 'UNAVAILABLE';
      venueHealth[adapter.venueId] = lastHealth;
    }

    const crossVenue = computeMd09CrossVenueState({
      symbolCanonical,
      observedAtUtc: nowUtc,
      observations,
      venueHealth,
    });

    return Object.freeze({
      observedAtUtc: nowUtc,
      venueSessions: Object.freeze(sessions),
      observations: Object.freeze(observations),
      venueHealth: Object.freeze(venueHealth),
      crossVenue,
      grantsExecutionAuthority: false,
      liveExecutionEnabled: false,
    });
  }
}
