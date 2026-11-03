/**
 * HELIOS OS04 — canonical venue adapter contract.
 *
 * Adapters declare capabilities explicitly. Order placement remains disabled
 * unless a future milestone issues Execution Authority through the Kernel.
 */

import type { HELIOS_VENUE_ADAPTER_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  VenueCapabilityManifest,
  VenueConformanceReport,
  VenueMarketDataProbeRequest,
  VenueMarketDataProbeResult,
} from './types.ts';
import type { HeliosOs04VenueId, VenueConformanceQualificationMode } from './taxonomy.ts';

export type VenueConformanceRunInput = Readonly<{
  readonly qualificationMode: VenueConformanceQualificationMode;
  readonly evaluatedAt: string;
  readonly ciEnvironment: boolean;
}>;

export type HeliosVenueAdapterContract = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly adapterSchemaVersion: typeof HELIOS_VENUE_ADAPTER_SCHEMA_VERSION;
  /** Structural guarantee — OS04 adapters never place live orders. */
  readonly liveOrderPlacementEnabled: false;
  manifest(): VenueCapabilityManifest;
  runConformance(input: VenueConformanceRunInput): Promise<VenueConformanceReport>;
  /**
   * Optional read-only market-data qualification probe.
   * CI uses fixture mode; readonly_live requires explicit caller invocation outside CI.
   */
  probeMarketData?(request: VenueMarketDataProbeRequest): Promise<VenueMarketDataProbeResult>;
}>;

export function createVenueAdapterContract(
  adapter: HeliosVenueAdapterContract,
): HeliosVenueAdapterContract {
  if (adapter.liveOrderPlacementEnabled !== false) {
    throw new Error('HeliosVenueAdapterContract requires liveOrderPlacementEnabled === false');
  }
  return Object.freeze(adapter);
}
