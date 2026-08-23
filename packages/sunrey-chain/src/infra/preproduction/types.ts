/**
 * Phase I Prompt 4 — platform deployment environment model.
 *
 * Extends Chunk 66/86. Does not create a second deployment owner.
 * PRODUCTION remains human-gated. LIVE_* and ENVIRONMENT are unchanged.
 */

import type { NetworkZone } from '../types.ts';

export const PREPRODUCTION_SCHEMA_VERSION = 1 as const;
export const PREPRODUCTION_TOOL_VERSION = 'sunrey-infra/preproduction/1' as const;

export const PLATFORM_DEPLOYMENT_ENVIRONMENTS = [
  'LOCAL',
  'TEST',
  'SANDBOX',
  'STAGING',
  'PREPRODUCTION',
  'PRODUCTION',
] as const;
export type PlatformDeploymentEnvironment = (typeof PLATFORM_DEPLOYMENT_ENVIRONMENTS)[number];

export const PROMOTION_STAGES = [
  'BUILD',
  'TEST',
  'SIGN',
  'STAGING',
  'PREPRODUCTION',
  'HUMAN_APPROVAL',
  'FUTURE_PRODUCTION',
] as const;
export type PromotionStage = (typeof PROMOTION_STAGES)[number];

export const CANONICAL_PLATFORM_SERVICES = [
  'api',
  'bff',
  'workers',
  'event-processor',
  'agent',
  'model-gateway',
  'exchange',
  'operations',
  'treasury',
  'vault',
  'hin',
  'rpc',
  'explorer',
] as const;
export type CanonicalPlatformService = (typeof CANONICAL_PLATFORM_SERVICES)[number];

export const PLATFORM_INFRA_WORKLOADS = [
  'postgres',
  'queue',
  'cache',
  'object-storage',
  'monitoring',
  'backup',
  'migration',
] as const;
export type PlatformInfraWorkload = (typeof PLATFORM_INFRA_WORKLOADS)[number];

export const PROVIDER_ADAPTER_TIERS = ['SANDBOX', 'CERTIFICATION', 'PREPRODUCTION'] as const;
export type ProviderAdapterTier = (typeof PROVIDER_ADAPTER_TIERS)[number];

export const DEPLOYMENT_STRATEGIES = ['ROLLING', 'BLUE_GREEN', 'CANARY'] as const;
export type DeploymentStrategy = (typeof DEPLOYMENT_STRATEGIES)[number];

export const DATABASE_ROLLBACK_POLICIES = ['FORWARD_FIX_ONLY', 'COMPATIBLE_DOWN_MIGRATION'] as const;
export type DatabaseRollbackPolicy = (typeof DATABASE_ROLLBACK_POLICIES)[number];

export type PlatformServiceSpec = {
  readonly name: CanonicalPlatformService;
  readonly owner: string;
  readonly entrypoint: string;
  readonly zone: NetworkZone;
  readonly public: boolean;
  readonly replicas: { readonly min: number; readonly max: number };
  readonly strategy: DeploymentStrategy;
  readonly cpu: { readonly request: string; readonly limit: string };
  readonly memory: { readonly request: string; readonly limit: string };
  readonly healthPath: string;
  readonly readyPath: string;
};

export type EnvironmentBoundary = {
  readonly environment: PlatformDeploymentEnvironment;
  readonly simulationOnly: true;
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly mainnetActive: false;
  readonly liveProviders: false;
  readonly liveDataMarketplace: false;
  readonly nativeIssuanceEnabled: false;
  readonly fixtureSecretsAllowed: boolean;
  readonly isolatedNonProductionSecrets: boolean;
  readonly kmsRequired: boolean;
  readonly hsmRequired: boolean;
  readonly signedArtifactsRequired: boolean;
  readonly haRequired: boolean;
  readonly geographicHaClaimed: false;
  readonly providerTiers: readonly ProviderAdapterTier[];
  readonly promotionRequiresHuman: boolean;
  readonly namespace: string;
};

export type VersionedReleaseConfiguration = {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly environment: PlatformDeploymentEnvironment;
  readonly applicationVersion: string;
  readonly containerDigest: string;
  readonly databaseMigrationVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly agentPolicyVersion: string;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly providerConfigReferences: readonly string[];
  readonly chainConfig: {
    readonly networkId: string;
    readonly chainId: string;
    readonly mainnetEnabled: false;
    readonly testnetBound: boolean;
  };
  readonly productionAuthorized: false;
  readonly signed: true;
  readonly signatureRef: string;
  readonly configurationHash: string;
};
