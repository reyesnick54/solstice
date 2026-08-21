import type { PlatformApiConfig } from './config.ts';

export type CorsDecision = {
  readonly allowed: boolean;
  readonly allowOrigin: string | null;
  readonly varyOrigin: boolean;
};

export function resolveCors(config: PlatformApiConfig, origin: string | undefined): CorsDecision {
  if (!origin) {
    return { allowed: true, allowOrigin: null, varyOrigin: false };
  }
  if (config.allowedOrigins.includes(origin)) {
    return { allowed: true, allowOrigin: origin, varyOrigin: true };
  }
  if (config.allowWildcardCors && config.allowedOrigins.includes('*')) {
    if (config.deploymentTier === 'production' || config.deploymentTier === 'staging') {
      return { allowed: false, allowOrigin: null, varyOrigin: true };
    }
    return { allowed: true, allowOrigin: origin, varyOrigin: true };
  }
  if (
    (config.deploymentTier === 'development' || config.deploymentTier === 'preview') &&
    config.allowedOrigins.length === 0 &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return { allowed: true, allowOrigin: origin, varyOrigin: true };
  }
  return { allowed: false, allowOrigin: null, varyOrigin: true };
}

export function corsHeaders(decision: CorsDecision): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (decision.allowOrigin) {
    headers['access-control-allow-origin'] = decision.allowOrigin;
    headers['access-control-allow-credentials'] = 'true';
    headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    headers['access-control-allow-headers'] =
      'authorization,content-type,idempotency-key,x-request-id,x-correlation-id,x-sunrey-client';
    headers['access-control-expose-headers'] = 'x-request-id,x-correlation-id,x-sunrey-api-version,retry-after';
    headers['access-control-max-age'] = '600';
  }
  if (decision.varyOrigin) {
    headers.vary = 'Origin';
  }
  return Object.freeze(headers);
}
