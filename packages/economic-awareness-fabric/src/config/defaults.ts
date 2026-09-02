import type { FabricConfig } from './loader.ts';

export const DEFAULT_FABRIC_CONFIG: FabricConfig = Object.freeze({
  schemaVersion: '1.0.0',
  fabricId: 'sunrey-economic-awareness-fabric',
  environment: 'simulation',
  providerRegistry: Object.freeze({
    catalogPath: 'config/providers/free-api-catalog.yaml',
    requireCatalogEntry: true,
    unknownProviderTrust: 'untrusted',
  }),
  connectorActivation: Object.freeze({
    defaultMode: 'fixture',
    allowedModes: Object.freeze(['fixture', 'preview', 'simulation']),
    blockedInCi: 'live',
  }),
  failClosed: Object.freeze({
    unknownProviderIsUntrusted: true,
    configuredNotTrusted: true,
    apiResponseNotVerifiedFact: true,
    multipleResponsesNotConsensus: true,
    rawObservationNotClaim: true,
    claimNotMonetaryAuthorization: true,
  }),
});
