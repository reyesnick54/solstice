import type { RpcEndpoint, RpcNodeHealth, RpcRequest, RpcRequestClass } from './types.ts';
import { DEFAULT_RPC_REQUEST_POLICY, type RpcRequestPolicy } from './policy.ts';

export class RpcEndpointPool {
  private readonly endpoints: RpcEndpoint[];

  constructor(endpoints: readonly RpcEndpoint[]) {
    this.endpoints = endpoints.map((endpoint) => Object.freeze({ ...endpoint }));
  }

  list(): readonly RpcEndpoint[] {
    return this.endpoints;
  }

  byId(endpointId: string): RpcEndpoint | undefined {
    return this.endpoints.find((endpoint) => endpoint.endpointId === endpointId);
  }

  mark(endpointId: string, patch: Partial<RpcEndpoint>): void {
    const index = this.endpoints.findIndex((endpoint) => endpoint.endpointId === endpointId);
    if (index < 0) {
      return;
    }
    this.endpoints[index] = Object.freeze({ ...this.endpoints[index]!, ...patch });
  }
}

export class RpcHealthRouter {
  readonly pool: RpcEndpointPool;
  readonly policy: RpcRequestPolicy;

  constructor(pool: RpcEndpointPool, policy: RpcRequestPolicy = DEFAULT_RPC_REQUEST_POLICY) {
    this.pool = pool;
    this.policy = policy;
  }

  route(request: RpcRequest): RpcEndpoint | null {
    const candidates = this.pool.list().filter((endpoint) => this.eligible(endpoint, request));
    if (candidates.length === 0) {
      return null;
    }
    return [...candidates].sort((left, right) => {
      const health = healthRank(left.health) - healthRank(right.health);
      if (health !== 0) {
        return health;
      }
      const lag = syncLag(left) - syncLag(right);
      if (lag !== 0) {
        return lag;
      }
      return left.load - right.load;
    })[0] ?? null;
  }

  eligible(endpoint: RpcEndpoint, request: RpcRequest): boolean {
    if (endpoint.health === 'DOWN') {
      return false;
    }
    if (endpoint.canSign || endpoint.canReachSigner || endpoint.canReachValidatorAdmin) {
      return false;
    }
    if (request.requiresArchive && !endpoint.archive) {
      return false;
    }
    if (!supportsClass(endpoint, request.requestClass)) {
      return false;
    }
    if (request.mutationEligibility && this.isStale(endpoint) && !this.policy.allowStaleForMutationEligibility) {
      return false;
    }
    if (sensitiveClass(request.requestClass) && this.isStale(endpoint)) {
      return false;
    }
    return endpoint.health !== 'UNSYNCED';
  }

  isStale(endpoint: RpcEndpoint): boolean {
    return !endpoint.synced || endpoint.health === 'STALE' || syncLag(endpoint) > 2;
  }
}

function supportsClass(endpoint: RpcEndpoint, requestClass: RpcRequestClass): boolean {
  if (requestClass === 'ARCHIVE_QUERY') {
    return endpoint.archive;
  }
  if (requestClass === 'OPERATOR_AUTHENTICATED') {
    return false;
  }
  return endpoint.role === 'RPC' || endpoint.role === 'ARCHIVE' || endpoint.role === 'SENTRY_READ';
}

function sensitiveClass(requestClass: RpcRequestClass): boolean {
  return requestClass === 'TRANSACTION_SUBMISSION' || requestClass === 'OPERATOR_AUTHENTICATED';
}

function syncLag(endpoint: RpcEndpoint): number {
  return Math.max(0, endpoint.networkFinalizedHeight - endpoint.finalizedHeight);
}

function healthRank(health: RpcNodeHealth): number {
  switch (health) {
    case 'HEALTHY':
      return 0;
    case 'DEGRADED':
      return 1;
    case 'STALE':
      return 2;
    case 'UNSYNCED':
      return 3;
    case 'DOWN':
      return 4;
    default:
      return 5;
  }
}

export function developmentEndpointPool(): RpcEndpointPool {
  return new RpcEndpointPool([
    fixtureEndpoint('rpc-a', 'HEALTHY', 40, 40, 10, false),
    fixtureEndpoint('rpc-b', 'HEALTHY', 40, 40, 20, false),
    fixtureEndpoint('rpc-archive', 'HEALTHY', 40, 40, 5, true),
    fixtureEndpoint('rpc-stale', 'STALE', 30, 40, 1, false),
  ]);
}

export function fixtureEndpoint(
  endpointId: string,
  health: RpcNodeHealth,
  finalizedHeight: number,
  networkFinalizedHeight: number,
  load: number,
  archive: boolean,
): RpcEndpoint {
  return Object.freeze({
    endpointId,
    url: `https://${endpointId}.public-rpc.sunrey.invalid/v1`,
    zone: 'PUBLIC_RPC',
    role: archive ? 'ARCHIVE' : 'RPC',
    health,
    synced: health === 'HEALTHY' || health === 'DEGRADED',
    finalizedHeight,
    networkFinalizedHeight,
    load,
    archive,
    canSign: false,
    canReachSigner: false,
    canReachValidatorAdmin: false,
    canReachCustodySigning: false,
    canReachGovernanceKeys: false,
  });
}
