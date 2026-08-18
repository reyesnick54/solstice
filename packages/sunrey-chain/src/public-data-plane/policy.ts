import { authorizeNetworkPath } from '../infra/network.ts';
import type { NetworkZone } from '../infra/types.ts';
import {
  FORBIDDEN_PUBLIC_METHODS,
  type AbuseDecision,
  type DeveloperApiKey,
  type RateLimitDecision,
  type RpcCachePolicy,
  type RpcClientIdentity,
  type RpcQuotaPolicy,
  type RpcRateLimitPolicy,
  type RpcRequest,
  type RpcRequestClass,
  type RpcRequestPolicy,
} from './types.ts';

export const DEFAULT_RPC_REQUEST_POLICY: RpcRequestPolicy = Object.freeze({
  allowStaleForMutationEligibility: false,
  staleReadExplicitPolicyRequired: true,
  publicGatewayExposesOperatorMethods: false,
  acceptPrivateKeys: false,
  mempoolAcceptanceIsFinality: false,
});

export const DEFAULT_RPC_QUOTA_POLICY: RpcQuotaPolicy = Object.freeze({
  anonymousRequestsPerMinute: 30,
  apiKeyRequestsPerMinute: 300,
  maxCostUnitsPerMinute: 1_200,
  maxSubscriptionsPerIdentity: 8,
  maxConnectionsPerIdentity: 16,
});

export const DEFAULT_RPC_RATE_LIMIT_POLICY: RpcRateLimitPolicy = Object.freeze({
  windowMs: 60_000,
  byNetworkIdentity: true,
  byApiKey: true,
  byRequestClass: true,
  byMethod: true,
  byCostUnits: true,
  distributedSafe: true,
});

export const DEFAULT_RPC_CACHE_POLICY: RpcCachePolicy = Object.freeze({
  enabled: true,
  ttlMs: 1_000,
  cachePrivateUserData: false,
  cacheDeterministicPublicReadsOnly: true,
});

export const METHOD_COST_UNITS: Readonly<Record<string, number>> = Object.freeze({
  'chain.status': 1,
  'chain.block': 1,
  'chain.transaction': 1,
  'chain.finality': 1,
  'tx.submit': 4,
  'subscribe': 2,
  'archive.scan': 25,
  'archive.range': 16,
  'explorer.search': 8,
});

const EXPENSIVE_METHODS = new Set(['archive.scan', 'archive.range', 'explorer.search']);

export class RpcRequestPolicyEngine {
  readonly policy: RpcRequestPolicy;

  constructor(policy: RpcRequestPolicy = DEFAULT_RPC_REQUEST_POLICY) {
    this.policy = policy;
  }

  classify(method: string, path: string): RpcRequestClass {
    if (method.startsWith('operator.') || path.startsWith('/operator/')) {
      return 'OPERATOR_AUTHENTICATED';
    }
    if (method === 'tx.submit' || path === '/v1/transactions') {
      return 'TRANSACTION_SUBMISSION';
    }
    if (method.startsWith('subscribe') || path === '/v1/events') {
      return 'SUBSCRIPTION';
    }
    if (method.startsWith('archive.') || path.startsWith('/v1/archive/')) {
      return 'ARCHIVE_QUERY';
    }
    return 'PUBLIC_READ';
  }

  costUnits(method: string): number {
    return METHOD_COST_UNITS[method] ?? (EXPENSIVE_METHODS.has(method) ? 16 : 1);
  }

  allowsOperatorMethodOnPublicGateway(method: string): boolean {
    return this.policy.publicGatewayExposesOperatorMethods && !FORBIDDEN_PUBLIC_METHODS.includes(method as (typeof FORBIDDEN_PUBLIC_METHODS)[number]);
  }
}

export class RpcQuotaPolicyEngine {
  readonly policy: RpcQuotaPolicy;

  constructor(policy: RpcQuotaPolicy = DEFAULT_RPC_QUOTA_POLICY) {
    this.policy = policy;
  }

  requestsPerMinute(identity: RpcClientIdentity, key: DeveloperApiKey | null): number {
    if (identity.kind === 'API_KEY' && key) {
      return this.policy.apiKeyRequestsPerMinute * key.quotaMultiplier;
    }
    return this.policy.anonymousRequestsPerMinute;
  }
}

type Bucket = {
  resetAt: number;
  count: number;
  cost: number;
};

/**
 * Distributed-safe rate limiter: decisions are keyed and commutative.
 * In a multi-node edge the same key+window produces the same remaining
 * budget when counters are merged by max(count) within the window.
 */
export class RpcRateLimitPolicyEngine {
  readonly policy: RpcRateLimitPolicy;
  private readonly buckets = new Map<string, Bucket>();

  constructor(policy: RpcRateLimitPolicy = DEFAULT_RPC_RATE_LIMIT_POLICY) {
    this.policy = policy;
  }

  consume(input: {
    readonly request: RpcRequest;
    readonly limit: number;
    readonly nowMs: number;
  }): RateLimitDecision {
    const key = this.keyOf(input.request);
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= input.nowMs) {
      this.buckets.set(key, {
        resetAt: input.nowMs + this.policy.windowMs,
        count: 1,
        cost: input.request.costUnits,
      });
      return {
        allowed: true,
        remaining: input.limit - 1,
        retryAfterMs: 0,
        costUnitsCharged: input.request.costUnits,
        identity: key,
      };
    }
    const nextCount = existing.count + 1;
    const nextCost = existing.cost + input.request.costUnits;
    if (nextCount > input.limit || nextCost > input.limit * 4) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: existing.resetAt - input.nowMs,
        costUnitsCharged: 0,
        identity: key,
      };
    }
    existing.count = nextCount;
    existing.cost = nextCost;
    return {
      allowed: true,
      remaining: input.limit - nextCount,
      retryAfterMs: 0,
      costUnitsCharged: input.request.costUnits,
      identity: key,
    };
  }

  mergeRemote(key: string, count: number, cost: number, resetAt: number): void {
    const local = this.buckets.get(key);
    if (!local || local.resetAt !== resetAt) {
      this.buckets.set(key, { resetAt, count, cost });
      return;
    }
    local.count = Math.max(local.count, count);
    local.cost = Math.max(local.cost, cost);
  }

  private keyOf(request: RpcRequest): string {
    const parts = ['rl'];
    if (this.policy.byNetworkIdentity) {
      parts.push(request.identity.networkIdentity);
    }
    if (this.policy.byApiKey) {
      parts.push(request.identity.apiKeyId ?? 'anon');
    }
    if (this.policy.byRequestClass) {
      parts.push(request.requestClass);
    }
    if (this.policy.byMethod) {
      parts.push(request.method);
    }
    return parts.join(':');
  }
}

export class RpcAbuseProtection {
  readonly maxPayloadBytes: number;
  readonly maxInvalidTxPerMinute: number;
  private readonly invalidTx = new Map<string, Bucket>();
  private readonly connections = new Map<string, number>();
  private readonly subscriptions = new Map<string, number>();

  constructor(options: { readonly maxPayloadBytes?: number; readonly maxInvalidTxPerMinute?: number } = {}) {
    this.maxPayloadBytes = options.maxPayloadBytes ?? 16_384;
    this.maxInvalidTxPerMinute = options.maxInvalidTxPerMinute ?? 8;
  }

  inspect(input: {
    readonly request: RpcRequest;
    readonly containsPrivateKey: boolean;
    readonly invalidTransaction: boolean;
    readonly nowMs: number;
    readonly quota: RpcQuotaPolicy;
  }): AbuseDecision {
    if ((FORBIDDEN_PUBLIC_METHODS as readonly string[]).includes(input.request.method)) {
      return { allowed: false, reason: 'FORBIDDEN_METHOD' };
    }
    if (input.request.requestClass === 'OPERATOR_AUTHENTICATED') {
      return { allowed: false, reason: 'OPERATOR_METHOD_FORBIDDEN' };
    }
    if (input.containsPrivateKey) {
      return { allowed: false, reason: 'PRIVATE_KEY_REJECTED' };
    }
    if (input.request.payloadBytes > this.maxPayloadBytes) {
      return { allowed: false, reason: 'OVERSIZED_PAYLOAD' };
    }
    const identity = input.request.identity.networkIdentity;
    if ((this.connections.get(identity) ?? 0) >= input.quota.maxConnectionsPerIdentity) {
      return { allowed: false, reason: 'CONNECTION_EXHAUSTED' };
    }
    if (
      input.request.requestClass === 'SUBSCRIPTION' &&
      (this.subscriptions.get(identity) ?? 0) >= input.quota.maxSubscriptionsPerIdentity
    ) {
      return { allowed: false, reason: 'SUBSCRIPTION_EXHAUSTED' };
    }
    if (EXPENSIVE_METHODS.has(input.request.method) && input.request.identity.kind === 'ANONYMOUS') {
      return { allowed: false, reason: 'EXPENSIVE_QUERY' };
    }
    if (input.invalidTransaction) {
      const bucket = this.invalidTx.get(identity);
      if (!bucket || bucket.resetAt <= input.nowMs) {
        this.invalidTx.set(identity, { resetAt: input.nowMs + 60_000, count: 1, cost: 0 });
      } else {
        bucket.count += 1;
        if (bucket.count > this.maxInvalidTxPerMinute) {
          return { allowed: false, reason: 'INVALID_TX_FLOOD' };
        }
      }
    }
    return { allowed: true, reason: 'OK' };
  }

  openConnection(identity: string): void {
    this.connections.set(identity, (this.connections.get(identity) ?? 0) + 1);
  }

  closeConnection(identity: string): void {
    const current = this.connections.get(identity) ?? 0;
    this.connections.set(identity, Math.max(0, current - 1));
  }

  openSubscription(identity: string): void {
    this.subscriptions.set(identity, (this.subscriptions.get(identity) ?? 0) + 1);
  }

  closeSubscription(identity: string): void {
    const current = this.subscriptions.get(identity) ?? 0;
    this.subscriptions.set(identity, Math.max(0, current - 1));
  }
}

export class RpcCachePolicyEngine {
  readonly policy: RpcCachePolicy;
  private readonly store = new Map<string, { readonly expiresAt: number; readonly value: unknown }>();

  constructor(policy: RpcCachePolicy = DEFAULT_RPC_CACHE_POLICY) {
    this.policy = policy;
  }

  cacheable(request: RpcRequest, identity: RpcClientIdentity): boolean {
    return (
      this.policy.enabled &&
      this.policy.cacheDeterministicPublicReadsOnly &&
      !this.policy.cachePrivateUserData &&
      request.requestClass === 'PUBLIC_READ' &&
      identity.kind !== 'OPERATOR' &&
      !request.mutationEligibility
    );
  }

  get(key: string, nowMs: number): unknown | undefined {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= nowMs) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: unknown, nowMs: number): void {
    if (!this.policy.enabled) {
      return;
    }
    this.store.set(key, { expiresAt: nowMs + this.policy.ttlMs, value });
  }

  disable(): void {
    this.store.clear();
    (this as { policy: RpcCachePolicy }).policy = { ...this.policy, enabled: false };
  }
}

export function publicRpcCannotReach(target: NetworkZone): boolean {
  return !authorizeNetworkPath('PUBLIC_RPC', target).ok;
}

export function containsPrivateKeyMaterial(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower.includes('private_key') || lower.includes('privatekey=') || lower.includes('begin private');
  }
  if (typeof value !== 'object') {
    return false;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/-/g, '_');
    if (
      normalized === 'private_key' ||
      normalized === 'privatekey' ||
      normalized === 'seed' ||
      normalized === 'mnemonic' ||
      normalized === 'hsm_secret'
    ) {
      return true;
    }
    if (containsPrivateKeyMaterial(nested)) {
      return true;
    }
  }
  return false;
}
