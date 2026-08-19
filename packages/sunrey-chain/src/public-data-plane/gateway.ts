import { authenticateSignerClient, publicRpcSignerIdentity } from '../ops/signer.ts';
import {
  containsPrivateKeyMaterial,
  DEFAULT_RPC_QUOTA_POLICY,
  RpcAbuseProtection,
  RpcCachePolicyEngine,
  RpcQuotaPolicyEngine,
  RpcRateLimitPolicyEngine,
  RpcRequestPolicyEngine,
} from './policy.ts';
import { developmentEndpointPool, RpcEndpointPool, RpcHealthRouter } from './routing.ts';
import { RpcSubscriptionGateway } from './subscriptions.ts';
import type {
  DeveloperApiKey,
  FinalityStatus,
  RpcClientIdentity,
  RpcRequest,
  SubmissionEdgeResponse,
} from './types.ts';

export type GatewayHandleResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly cached: boolean;
  readonly endpointId: string | null;
  readonly body: unknown;
  readonly error?: string;
};

export class PublicRpcGateway {
  readonly zone = 'PUBLIC_RPC' as const;
  readonly apiVersion = 'v1' as const;
  readonly pool: RpcEndpointPool;
  readonly router: RpcHealthRouter;
  readonly requests: RpcRequestPolicyEngine;
  readonly quotas: RpcQuotaPolicyEngine;
  readonly limiter: RpcRateLimitPolicyEngine;
  readonly abuse: RpcAbuseProtection;
  readonly cache: RpcCachePolicyEngine;
  readonly subscriptions: RpcSubscriptionGateway;
  readonly metrics: {
    requests: number;
    latencyMsTotal: number;
    errors: number;
    rateLimitEvents: number;
    payloadRejections: number;
    subscriptionCount: number;
    syncLag: number;
    indexerLag: number;
    cacheHits: number;
    cacheMisses: number;
  };
  private readonly knownTx = new Map<string, SubmissionEdgeResponse>();
  private readonly finalized = new Map<string, FinalityStatus>();
  private readonly keys = new Map<string, DeveloperApiKey>();

  constructor(options: { readonly pool?: RpcEndpointPool } = {}) {
    this.pool = options.pool ?? developmentEndpointPool();
    this.router = new RpcHealthRouter(this.pool);
    this.requests = new RpcRequestPolicyEngine();
    this.quotas = new RpcQuotaPolicyEngine();
    this.limiter = new RpcRateLimitPolicyEngine();
    this.abuse = new RpcAbuseProtection();
    this.cache = new RpcCachePolicyEngine();
    this.subscriptions = new RpcSubscriptionGateway(this.abuse);
    this.metrics = {
      requests: 0,
      latencyMsTotal: 0,
      errors: 0,
      rateLimitEvents: 0,
      payloadRejections: 0,
      subscriptionCount: 0,
      syncLag: 0,
      indexerLag: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  registerApiKey(key: DeveloperApiKey): void {
    this.keys.set(key.apiKeyId, key);
  }

  handle(input: {
    readonly requestId: string;
    readonly method: string;
    readonly path: string;
    readonly identity: RpcClientIdentity;
    readonly payload?: unknown;
    readonly payloadBytes?: number;
    readonly requiresArchive?: boolean;
    readonly mutationEligibility?: boolean;
    readonly invalidTransaction?: boolean;
    readonly nowUtc?: string;
    readonly nowMs?: number;
    readonly staleReadPolicy?: 'REQUIRED' | 'FORBIDDEN';
  }): GatewayHandleResult {
    const started = input.nowMs ?? 0;
    this.metrics.requests += 1;
    const requestClass = this.requests.classify(input.method, input.path);
    const request: RpcRequest = {
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      requestClass,
      identity: input.identity,
      payloadBytes: input.payloadBytes ?? 0,
      costUnits: this.requests.costUnits(input.method),
      requiresArchive: input.requiresArchive ?? requestClass === 'ARCHIVE_QUERY',
      mutationEligibility: input.mutationEligibility ?? requestClass === 'TRANSACTION_SUBMISSION',
      nowUtc: input.nowUtc ?? '2026-08-18T00:00:00.000Z',
    };
    const abuse = this.abuse.inspect({
      request,
      containsPrivateKey: containsPrivateKeyMaterial(input.payload),
      invalidTransaction: input.invalidTransaction ?? false,
      nowMs: input.nowMs ?? 0,
      quota: DEFAULT_RPC_QUOTA_POLICY,
    });
    if (!abuse.allowed) {
      this.metrics.errors += 1;
      if (abuse.reason === 'OVERSIZED_PAYLOAD') {
        this.metrics.payloadRejections += 1;
      }
      return { ok: false, status: abuse.reason === 'OVERSIZED_PAYLOAD' ? 413 : 403, cached: false, endpointId: null, body: null, error: abuse.reason };
    }
    const key = input.identity.apiKeyId ? this.keys.get(input.identity.apiKeyId) ?? null : null;
    if (input.identity.kind === 'API_KEY' && key && (key.canAuthorizeCustody || key.canAuthorizeExchange || key.grantsFinancialAuthority)) {
      return { ok: false, status: 403, cached: false, endpointId: null, body: null, error: 'API_KEY_NO_FINANCIAL_AUTHORITY' };
    }
    const limit = this.quotas.requestsPerMinute(input.identity, key);
    const rate = this.limiter.consume({ request, limit, nowMs: input.nowMs ?? 0 });
    if (!rate.allowed) {
      this.metrics.rateLimitEvents += 1;
      return { ok: false, status: 429, cached: false, endpointId: null, body: { retryAfterMs: rate.retryAfterMs }, error: 'RATE_LIMITED' };
    }
    if (request.mutationEligibility && input.staleReadPolicy !== 'REQUIRED') {
      const endpoint = this.router.route(request);
      if (!endpoint) {
        this.metrics.errors += 1;
        return { ok: false, status: 503, cached: false, endpointId: null, body: null, error: 'STALE_NODE_EXCLUDED' };
      }
    }
    const cacheKey = `${request.method}:${request.path}`;
    if (this.cache.cacheable(request, input.identity)) {
      const cached = this.cache.get(cacheKey, input.nowMs ?? 0);
      if (cached !== undefined) {
        this.metrics.cacheHits += 1;
        this.metrics.latencyMsTotal += (input.nowMs ?? 0) - started;
        return { ok: true, status: 200, cached: true, endpointId: 'cache', body: cached };
      }
      this.metrics.cacheMisses += 1;
    }
    const endpoint = this.router.route(request);
    if (!endpoint) {
      this.metrics.errors += 1;
      return { ok: false, status: 503, cached: false, endpointId: null, body: null, error: 'NO_HEALTHY_ENDPOINT' };
    }
    const body =
      requestClass === 'TRANSACTION_SUBMISSION'
        ? this.submit(input.payload)
        : request.method === 'chain.finality'
          ? this.finality(typeof input.payload === 'object' && input.payload && 'transactionId' in input.payload ? String((input.payload as { transactionId: string }).transactionId) : null)
          : { ok: true, endpointId: endpoint.endpointId, finalized: request.method === 'chain.finality' };
    if (this.cache.cacheable(request, input.identity)) {
      this.cache.set(cacheKey, body, input.nowMs ?? 0);
    }
    this.metrics.latencyMsTotal += 1;
    return { ok: true, status: 200, cached: false, endpointId: endpoint.endpointId, body };
  }

  submit(payload: unknown): SubmissionEdgeResponse {
    const signed = payload && typeof payload === 'object' ? (payload as { signedBytes?: string; transactionId?: string }) : {};
    const transactionId = signed.transactionId ?? hashId(signed.signedBytes ?? '');
    const existing = this.knownTx.get(transactionId);
    if (existing) {
      return existing;
    }
    if (!signed.signedBytes || signed.signedBytes.length === 0) {
      const rejected: SubmissionEdgeResponse = {
        transactionId,
        state: 'REJECTED',
        finalized: false,
        mempoolAcceptanceIsFinality: false,
        privateKeyReceived: false,
      };
      return rejected;
    }
    const accepted: SubmissionEdgeResponse = {
      transactionId,
      state: 'ACCEPTED_FOR_MEMPOOL',
      finalized: false,
      mempoolAcceptanceIsFinality: false,
      privateKeyReceived: false,
    };
    this.knownTx.set(transactionId, accepted);
    this.finalized.set(transactionId, {
      transactionId,
      blockId: null,
      height: null,
      state: 'IN_MEMPOOL',
      finalized: false,
      source: 'CANONICAL_CHAIN',
    });
    return accepted;
  }

  finalize(transactionId: string, blockId: string, height: number): FinalityStatus {
    const status: FinalityStatus = {
      transactionId,
      blockId,
      height,
      state: 'FINALIZED',
      finalized: true,
      source: 'CANONICAL_CHAIN',
    };
    this.finalized.set(transactionId, status);
    return status;
  }

  finality(transactionId: string | null): FinalityStatus {
    if (!transactionId) {
      return { transactionId: null, blockId: null, height: null, state: 'UNKNOWN', finalized: false, source: 'CANONICAL_CHAIN' };
    }
    return (
      this.finalized.get(transactionId) ?? {
        transactionId,
        blockId: null,
        height: null,
        state: this.knownTx.has(transactionId) ? 'IN_MEMPOOL' : 'UNKNOWN',
        finalized: false,
        source: 'CANONICAL_CHAIN',
      }
    );
  }

  temporarilyUnavailable(transactionId: string): SubmissionEdgeResponse {
    return {
      transactionId,
      state: 'TEMPORARILY_UNAVAILABLE',
      finalized: false,
      mempoolAcceptanceIsFinality: false,
      privateKeyReceived: false,
    };
  }

  assertNoSignerAccess(): { readonly ok: false; readonly code: 'PUBLIC_RPC_CANNOT_REACH_SIGNER' } {
    const decision = authenticateSignerClient(publicRpcSignerIdentity(), {
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      validatorId: 'val_dev_a',
      cryptoSuiteId: 'sunrey-ed25519-v1',
      validatorSetVersion: 1n,
      allowedClientIds: [],
    });
    if (decision.ok) {
      throw new Error('public RPC must not authenticate to the signer');
    }
    return { ok: false, code: 'PUBLIC_RPC_CANNOT_REACH_SIGNER' };
  }
}

function hashId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `tx_${hash.toString(16).padStart(8, '0')}`;
}
