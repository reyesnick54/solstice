/**
 * Canonical platform topology, service catalog, HA, and resource policy.
 * Geographic HA is not claimed. Zone HA is validated in preproduction.
 */

import type { NetworkZone } from '../types.ts';
import { environmentBoundary } from './environments.ts';
import {
  CANONICAL_PLATFORM_SERVICES,
  type CanonicalPlatformService,
  type PlatformDeploymentEnvironment,
  type PlatformServiceSpec,
} from './types.ts';

export const PLATFORM_SERVICE_CATALOG: Readonly<Record<CanonicalPlatformService, PlatformServiceSpec>> =
  Object.freeze({
    api: Object.freeze({
      name: 'api',
      owner: 'services/api',
      entrypoint: 'services/api/src/main.ts',
      zone: 'PUBLIC_EDGE',
      public: true,
      replicas: Object.freeze({ min: 2, max: 8 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '250m', limit: '1000m' }),
      memory: Object.freeze({ request: '512Mi', limit: '1Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    bff: Object.freeze({
      name: 'bff',
      owner: 'services/api',
      entrypoint: 'services/api/src/consumer/orchestrator.ts',
      zone: 'PUBLIC_EDGE',
      public: true,
      replicas: Object.freeze({ min: 2, max: 8 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '250m', limit: '1000m' }),
      memory: Object.freeze({ request: '512Mi', limit: '1Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    workers: Object.freeze({
      name: 'workers',
      owner: 'packages/events',
      entrypoint: 'packages/events/src/dispatcher.ts',
      zone: 'DATA_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 6 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    'event-processor': Object.freeze({
      name: 'event-processor',
      owner: 'packages/events',
      entrypoint: 'packages/events/src/jobs.ts',
      zone: 'DATA_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 6 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    agent: Object.freeze({
      name: 'agent',
      owner: 'packages/sunrey-agent',
      entrypoint: 'packages/sunrey-agent/src/engine.ts',
      zone: 'OPERATIONS_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'CANARY',
      cpu: Object.freeze({ request: '300m', limit: '1500m' }),
      memory: Object.freeze({ request: '512Mi', limit: '2Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    'model-gateway': Object.freeze({
      name: 'model-gateway',
      owner: 'packages/ai-runtime',
      entrypoint: 'packages/ai-runtime/src/runtime.ts',
      zone: 'OPERATIONS_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'CANARY',
      cpu: Object.freeze({ request: '300m', limit: '2000m' }),
      memory: Object.freeze({ request: '1Gi', limit: '4Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    exchange: Object.freeze({
      name: 'exchange',
      owner: 'packages/sunrey-exchange',
      entrypoint: 'packages/sunrey-exchange/src/index.ts',
      zone: 'DATA_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 6 }),
      strategy: 'BLUE_GREEN',
      cpu: Object.freeze({ request: '400m', limit: '2000m' }),
      memory: Object.freeze({ request: '1Gi', limit: '2Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    operations: Object.freeze({
      name: 'operations',
      owner: 'packages/sunrey-chain',
      entrypoint: 'packages/sunrey-chain/src/ops/index.ts',
      zone: 'OPERATIONS_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    treasury: Object.freeze({
      name: 'treasury',
      owner: 'services/treasury',
      entrypoint: 'services/treasury/src/index.ts',
      zone: 'OPERATIONS_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 1, max: 3 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '150m', limit: '500m' }),
      memory: Object.freeze({ request: '256Mi', limit: '512Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    vault: Object.freeze({
      name: 'vault',
      owner: 'packages/personal-data-vault',
      entrypoint: 'packages/personal-data-vault/src/service.ts',
      zone: 'DATA_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    hin: Object.freeze({
      name: 'hin',
      owner: 'packages/information-market',
      entrypoint: 'packages/information-market/src/network/engine.ts',
      zone: 'DATA_PRIVATE',
      public: false,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    rpc: Object.freeze({
      name: 'rpc',
      owner: 'packages/sunrey-chain',
      entrypoint: 'packages/sunrey-chain/rust/crates/rpc',
      zone: 'PUBLIC_RPC',
      public: true,
      replicas: Object.freeze({ min: 2, max: 6 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '500m', limit: '2000m' }),
      memory: Object.freeze({ request: '1Gi', limit: '4Gi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
    explorer: Object.freeze({
      name: 'explorer',
      owner: 'packages/sunrey-explorer',
      entrypoint: 'packages/sunrey-explorer/src/server.ts',
      zone: 'PUBLIC_EDGE',
      public: true,
      replicas: Object.freeze({ min: 2, max: 4 }),
      strategy: 'ROLLING',
      cpu: Object.freeze({ request: '200m', limit: '750m' }),
      memory: Object.freeze({ request: '256Mi', limit: '768Mi' }),
      healthPath: '/health',
      readyPath: '/ready',
    }),
  });

export const EXCLUDED_LEGACY_SERVICES = Object.freeze([
  'strategy-lab',
  'agentic-capital-mesh',
  'consumer-platform-legacy',
]);

export const PLATFORM_NETWORK_PATHS: readonly {
  readonly from: NetworkZone;
  readonly to: NetworkZone;
  readonly purpose: string;
}[] = Object.freeze([
  { from: 'PUBLIC_EDGE', to: 'DATA_PRIVATE', purpose: 'API/BFF → application data plane' },
  { from: 'PUBLIC_EDGE', to: 'OPERATIONS_PRIVATE', purpose: 'BFF → Agent / model gateway (internal hop)' },
  { from: 'PUBLIC_EDGE', to: 'PUBLIC_RPC', purpose: 'public → RPC' },
  { from: 'DATA_PRIVATE', to: 'DATA_PRIVATE', purpose: 'workers / queue / database / cache' },
  { from: 'DATA_PRIVATE', to: 'CUSTODY_PRIVATE', purpose: 'Exchange → custody' },
  { from: 'OPERATIONS_PRIVATE', to: 'DATA_PRIVATE', purpose: 'ops / treasury / agent → journals' },
  { from: 'OPERATIONS_PRIVATE', to: 'BACKUP', purpose: 'backup orchestration' },
  { from: 'OBSERVABILITY', to: 'PUBLIC_EDGE', purpose: 'scrape public API health' },
  { from: 'OBSERVABILITY', to: 'DATA_PRIVATE', purpose: 'scrape workers and database' },
  { from: 'OBSERVABILITY', to: 'OPERATIONS_PRIVATE', purpose: 'scrape ops and agent' },
  { from: 'OBSERVABILITY', to: 'PUBLIC_RPC', purpose: 'scrape RPC' },
  { from: 'BACKUP', to: 'DATA_PRIVATE', purpose: 'database and object backup' },
]);

export const FORBIDDEN_PLATFORM_PATHS: readonly {
  readonly from: NetworkZone;
  readonly to: NetworkZone;
  readonly purpose: string;
}[] = Object.freeze([
  { from: 'PUBLIC_EDGE', to: 'SIGNER_PRIVATE', purpose: 'public → key service' },
  { from: 'PUBLIC_EDGE', to: 'VALIDATOR_PRIVATE', purpose: 'public → validator' },
  { from: 'PUBLIC_RPC', to: 'SIGNER_PRIVATE', purpose: 'RPC → signer' },
  { from: 'PUBLIC_RPC', to: 'VALIDATOR_PRIVATE', purpose: 'RPC → validator admin' },
  { from: 'PUBLIC_EDGE', to: 'CUSTODY_PRIVATE', purpose: 'public → custody HSM' },
  { from: 'OPERATIONS_PRIVATE', to: 'SIGNER_PRIVATE', purpose: 'ops → consensus signer' },
]);

export function replicasFor(
  service: CanonicalPlatformService,
  environment: PlatformDeploymentEnvironment,
): number {
  const spec = PLATFORM_SERVICE_CATALOG[service];
  const boundary = environmentBoundary(environment);
  if (!boundary.haRequired) {
    return 1;
  }
  return spec.replicas.min;
}

export function catalogComplete(): boolean {
  return CANONICAL_PLATFORM_SERVICES.every((name) => PLATFORM_SERVICE_CATALOG[name].name === name);
}

export function autoscalingHook(service: CanonicalPlatformService): {
  readonly enabled: true;
  readonly metric: 'cpu';
  readonly targetUtilization: number;
  readonly minReplicas: number;
  readonly maxReplicas: number;
} {
  const spec = PLATFORM_SERVICE_CATALOG[service];
  return Object.freeze({
    enabled: true,
    metric: 'cpu',
    targetUtilization: 70,
    minReplicas: spec.replicas.min,
    maxReplicas: spec.replicas.max,
  });
}
