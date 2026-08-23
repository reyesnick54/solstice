/**
 * Explicit configuration boundaries for every platform environment.
 * PREPRODUCTION resembles production topology without live activation.
 */

import {
  PLATFORM_DEPLOYMENT_ENVIRONMENTS,
  type EnvironmentBoundary,
  type PlatformDeploymentEnvironment,
} from './types.ts';

const COMMON = {
  simulationOnly: true as const,
  productionAuthorized: false as const,
  mainnetEnabled: false as const,
  mainnetActive: false as const,
  liveProviders: false as const,
  liveDataMarketplace: false as const,
  nativeIssuanceEnabled: false as const,
  geographicHaClaimed: false as const,
} as const;

export const PLATFORM_ENVIRONMENT_BOUNDARIES: Readonly<
  Record<PlatformDeploymentEnvironment, EnvironmentBoundary>
> = Object.freeze({
  LOCAL: Object.freeze({
    ...COMMON,
    environment: 'LOCAL',
    fixtureSecretsAllowed: true,
    isolatedNonProductionSecrets: true,
    kmsRequired: false,
    hsmRequired: false,
    signedArtifactsRequired: false,
    haRequired: false,
    providerTiers: Object.freeze(['SANDBOX'] as const),
    promotionRequiresHuman: false,
    namespace: 'sunrey-local',
  }),
  TEST: Object.freeze({
    ...COMMON,
    environment: 'TEST',
    fixtureSecretsAllowed: true,
    isolatedNonProductionSecrets: true,
    kmsRequired: false,
    hsmRequired: false,
    signedArtifactsRequired: true,
    haRequired: false,
    providerTiers: Object.freeze(['SANDBOX'] as const),
    promotionRequiresHuman: false,
    namespace: 'sunrey-test',
  }),
  SANDBOX: Object.freeze({
    ...COMMON,
    environment: 'SANDBOX',
    fixtureSecretsAllowed: false,
    isolatedNonProductionSecrets: true,
    kmsRequired: false,
    hsmRequired: false,
    signedArtifactsRequired: true,
    haRequired: false,
    providerTiers: Object.freeze(['SANDBOX', 'CERTIFICATION'] as const),
    promotionRequiresHuman: false,
    namespace: 'sunrey-sandbox',
  }),
  STAGING: Object.freeze({
    ...COMMON,
    environment: 'STAGING',
    fixtureSecretsAllowed: false,
    isolatedNonProductionSecrets: true,
    kmsRequired: false,
    hsmRequired: false,
    signedArtifactsRequired: true,
    haRequired: true,
    providerTiers: Object.freeze(['SANDBOX', 'CERTIFICATION'] as const),
    promotionRequiresHuman: false,
    namespace: 'sunrey-staging',
  }),
  PREPRODUCTION: Object.freeze({
    ...COMMON,
    environment: 'PREPRODUCTION',
    fixtureSecretsAllowed: false,
    isolatedNonProductionSecrets: true,
    kmsRequired: false,
    hsmRequired: false,
    signedArtifactsRequired: true,
    haRequired: true,
    providerTiers: Object.freeze(['SANDBOX', 'CERTIFICATION', 'PREPRODUCTION'] as const),
    promotionRequiresHuman: false,
    namespace: 'sunrey-preproduction',
  }),
  PRODUCTION: Object.freeze({
    ...COMMON,
    environment: 'PRODUCTION',
    fixtureSecretsAllowed: false,
    isolatedNonProductionSecrets: false,
    kmsRequired: true,
    hsmRequired: true,
    signedArtifactsRequired: true,
    haRequired: true,
    providerTiers: Object.freeze(['SANDBOX', 'CERTIFICATION', 'PREPRODUCTION'] as const),
    promotionRequiresHuman: true,
    namespace: 'sunrey-production',
  }),
});

export function environmentBoundary(environment: PlatformDeploymentEnvironment): EnvironmentBoundary {
  return PLATFORM_ENVIRONMENT_BOUNDARIES[environment];
}

export function assertKnownPlatformEnvironment(value: string): PlatformDeploymentEnvironment {
  if (!(PLATFORM_DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(value)) {
    throw new TypeError(`unknown platform deployment environment ${value}`);
  }
  return value as PlatformDeploymentEnvironment;
}

export function refuseLiveActivation(boundary: EnvironmentBoundary): boolean {
  return (
    boundary.productionAuthorized === false &&
    boundary.mainnetEnabled === false &&
    boundary.mainnetActive === false &&
    boundary.liveProviders === false &&
    boundary.liveDataMarketplace === false &&
    boundary.nativeIssuanceEnabled === false
  );
}

export function productionFailsClosedWithoutKms(environment: PlatformDeploymentEnvironment): boolean {
  const boundary = environmentBoundary(environment);
  return environment === 'PRODUCTION' && boundary.kmsRequired && boundary.hsmRequired;
}
