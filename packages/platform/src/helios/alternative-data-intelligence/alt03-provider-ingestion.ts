/**
 * ALT03 — fixture-only provider ingestion port (simulation).
 */
export const HELIOS_ALT03_PROVIDER_INGESTION =
  'packages/platform/src/helios/alternative-data-intelligence/alt03-provider-ingestion.ts' as const;

export type AltProviderFixtureObservation = {
  readonly providerId: string;
  readonly modality: string;
  readonly observationRef: string;
  readonly entitled: boolean;
};
