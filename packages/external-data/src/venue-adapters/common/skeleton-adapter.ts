/**
 * Provider-neutral venue adapter skeleton for OS04 conformance registration.
 */

import {
  createVenueAdapterContract,
  runVenueAdapterConformanceSync,
  SKELETON_OS04_QUALIFICATION_PROFILE,
  HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
  type HeliosVenueAdapterContract,
  type VenueConformanceRunInput,
  type HeliosOs04VenueId,
} from '@solstice/provider-sdk';
import { createSkeletonVenueManifest } from './skeleton-manifest.ts';

export function createSkeletonVenueAdapter(input: {
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
}): HeliosVenueAdapterContract {
  const manifest = createSkeletonVenueManifest(input);
  const adapter: HeliosVenueAdapterContract = {
    venueId: input.venueId,
    adapterSchemaVersion: HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
    liveOrderPlacementEnabled: false,
    manifest() {
      return manifest;
    },
    runConformance(runInput: VenueConformanceRunInput) {
      return Promise.resolve(
        runVenueAdapterConformanceSync(adapter, runInput, SKELETON_OS04_QUALIFICATION_PROFILE),
      );
    },
  };
  return createVenueAdapterContract(adapter);
}
