export const RPC_PLANES = ['PUBLIC_RPC', 'VALIDATOR_RPC', 'ADMIN_RPC'] as const;
export type RpcPlane = (typeof RPC_PLANES)[number];

export const PUBLIC_RPC_METHODS = [
  'GET /v1/chain/status',
  'GET /v1/network/status',
  'GET /v1/chain/blocks/{height}',
  'GET /v1/transactions/{id}',
  'GET /v1/accounts/{id}',
  'GET /v1/assets',
  'GET /v1/fees/estimate',
  'GET /v1/validators',
  'POST /v1/transactions',
] as const;

export const FORBIDDEN_PUBLIC_RPC_METHODS = [
  'POST /admin/produce-block',
  'GET /v1/validator/admin',
  'POST /v1/validator/sign',
  'POST /validator/unsafe-reset',
] as const;

export type RpcSecurityPolicy = {
  readonly plane: RpcPlane;
  readonly ratePerWindow: number;
  readonly windowMs: number;
  readonly maxRequestBytes: number;
  readonly corsOrigins: readonly string[];
  readonly requireRequestId: true;
};

export const PUBLIC_RPC_SECURITY: RpcSecurityPolicy = {
  plane: 'PUBLIC_RPC',
  ratePerWindow: 32,
  windowMs: 1_000,
  maxRequestBytes: 65_536,
  corsOrigins: ['https://explorer.sunrey.test'],
  requireRequestId: true,
};

export function methodAllowedOnPlane(plane: RpcPlane, method: string, path: string): boolean {
  const privileged =
    path.startsWith('/admin') ||
    path.includes('produce-block') ||
    path.startsWith('/v1/validator/admin') ||
    path.includes('/sign');
  if (privileged) {
    return plane !== 'PUBLIC_RPC';
  }
  return true;
}

export type RateLimitState = {
  count: number;
  windowStartMs: number;
};

export function allowRequest(
  state: RateLimitState,
  nowMs: number,
  policy: RpcSecurityPolicy = PUBLIC_RPC_SECURITY,
): { readonly allowed: boolean; readonly next: RateLimitState } {
  if (nowMs - state.windowStartMs >= policy.windowMs) {
    return { allowed: true, next: { count: 1, windowStartMs: nowMs } };
  }
  if (state.count >= policy.ratePerWindow) {
    return { allowed: false, next: state };
  }
  return { allowed: true, next: { ...state, count: state.count + 1 } };
}
