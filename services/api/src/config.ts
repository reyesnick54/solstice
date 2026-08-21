/**
 * Validated Platform API runtime configuration.
 *
 * ENVIRONMENT remains simulation. LIVE_* and production activation flags
 * stay false. A deployment tier of "production" only tightens fail-closed
 * validation — it does not activate live production.
 */

import { ENVIRONMENT } from '../../../packages/config/src/flags.ts';

export const CORE_CODE_COMPLETE_CANDIDATE = true as const;
export const PRODUCTION_READY = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const LIVE_CONNECTIVITY_ENABLED = false as const;
export const production_authorized = false as const;

export const DEPLOYMENT_TIERS = ['development', 'preview', 'staging', 'production'] as const;
export type DeploymentTier = (typeof DEPLOYMENT_TIERS)[number];

export const IDEMPOTENCY_BACKENDS = ['postgres', 'injected'] as const;
export type IdempotencyBackend = (typeof IDEMPOTENCY_BACKENDS)[number];

export const RATE_LIMIT_BACKENDS = ['postgres', 'memory', 'injected'] as const;
export type RateLimitBackend = (typeof RATE_LIMIT_BACKENDS)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type FeatureFlags = {
  readonly testRoutes: boolean;
  readonly requirePersistenceForReady: boolean;
};

export type PlatformApiConfig = {
  readonly environment: 'simulation';
  readonly deploymentTier: DeploymentTier;
  readonly host: string;
  readonly port: number;
  readonly apiBasePath: string;
  readonly allowedOrigins: readonly string[];
  readonly allowWildcardCors: boolean;
  readonly logLevel: LogLevel;
  readonly bodyLimitBytes: number;
  readonly requestTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
  readonly rateLimitPerMinute: number;
  readonly rateLimitBackend: RateLimitBackend;
  readonly idempotencyTtlSeconds: number;
  readonly idempotencyBackend: IdempotencyBackend;
  readonly authMode: 'disabled' | 'required';
  readonly databaseConfigured: boolean;
  readonly featureFlags: FeatureFlags;
  readonly CORE_CODE_COMPLETE_CANDIDATE: true;
  readonly PRODUCTION_READY: false;
  readonly PRODUCTION_ACTIVE: false;
  readonly LIVE_CONNECTIVITY_ENABLED: false;
  readonly production_authorized: false;
};

export class ConfigValidationError extends Error {
  readonly fieldErrors: readonly { readonly field: string; readonly message: string }[];

  constructor(fieldErrors: readonly { readonly field: string; readonly message: string }[]) {
    super(`platform API configuration is invalid: ${fieldErrors.map((row) => row.field).join(', ')}`);
    this.name = 'ConfigValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export type PlatformApiConfigInput = {
  readonly host?: string;
  readonly port?: number;
  readonly apiBasePath?: string;
  readonly deploymentTier?: string;
  readonly allowedOrigins?: readonly string[];
  readonly allowWildcardCors?: boolean;
  readonly logLevel?: string;
  readonly bodyLimitBytes?: number;
  readonly requestTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
  readonly rateLimitPerMinute?: number;
  readonly rateLimitBackend?: string;
  readonly idempotencyTtlSeconds?: number;
  readonly idempotencyBackend?: string;
  readonly authMode?: string;
  readonly databaseConfigured?: boolean;
  readonly featureFlags?: Partial<FeatureFlags>;
};

function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const value = env[name];
  return value === undefined || value === '' ? undefined : value;
}

function parseInteger(raw: string | undefined, fallback: number): number | typeof Number.NaN {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function loadPlatformApiConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PlatformApiConfigInput {
  const portRaw = readEnv('SUNREY_API_PORT', env);
  const bodyRaw = readEnv('SUNREY_API_BODY_LIMIT_BYTES', env);
  const timeoutRaw = readEnv('SUNREY_API_REQUEST_TIMEOUT_MS', env);
  const shutdownRaw = readEnv('SUNREY_API_SHUTDOWN_TIMEOUT_MS', env);
  const rateRaw = readEnv('SUNREY_API_RATE_LIMIT_PER_MINUTE', env);
  const ttlRaw = readEnv('SUNREY_API_IDEMPOTENCY_TTL_SECONDS', env);
  const host = readEnv('SUNREY_API_HOST', env);
  const apiBasePath = readEnv('SUNREY_API_BASE_PATH', env);
  const deploymentTier = readEnv('SUNREY_API_TIER', env);
  const logLevel = readEnv('SUNREY_API_LOG_LEVEL', env);
  const rateLimitBackend = readEnv('SUNREY_API_RATE_LIMIT_BACKEND', env);
  const idempotencyBackend = readEnv('SUNREY_API_IDEMPOTENCY_BACKEND', env);
  const authMode = readEnv('SUNREY_API_AUTH_MODE', env);
  return {
    ...(host ? { host } : {}),
    ...(portRaw !== undefined ? { port: Number(portRaw) } : {}),
    ...(apiBasePath ? { apiBasePath } : {}),
    ...(deploymentTier ? { deploymentTier } : {}),
    allowedOrigins: parseOrigins(readEnv('SUNREY_API_ALLOWED_ORIGINS', env)),
    allowWildcardCors: readEnv('SUNREY_API_ALLOW_WILDCARD_CORS', env) === 'true',
    ...(logLevel ? { logLevel } : {}),
    ...(bodyRaw !== undefined ? { bodyLimitBytes: Number(bodyRaw) } : {}),
    ...(timeoutRaw !== undefined ? { requestTimeoutMs: Number(timeoutRaw) } : {}),
    ...(shutdownRaw !== undefined ? { shutdownTimeoutMs: Number(shutdownRaw) } : {}),
    ...(rateRaw !== undefined ? { rateLimitPerMinute: Number(rateRaw) } : {}),
    ...(rateLimitBackend ? { rateLimitBackend } : {}),
    ...(ttlRaw !== undefined ? { idempotencyTtlSeconds: Number(ttlRaw) } : {}),
    ...(idempotencyBackend ? { idempotencyBackend } : {}),
    ...(authMode ? { authMode } : {}),
    databaseConfigured: Boolean(readEnv('SUNREY_PG_HOST', env) ?? readEnv('SUNREY_API_DATABASE_CONFIGURED', env)),
    featureFlags: {
      testRoutes: readEnv('SUNREY_API_TEST_ROUTES', env) === 'true',
      requirePersistenceForReady: readEnv('SUNREY_API_REQUIRE_PERSISTENCE', env) === 'true',
    },
  };
}

export function validatePlatformApiConfig(input: PlatformApiConfigInput = {}): PlatformApiConfig {
  if (ENVIRONMENT !== 'simulation') {
    throw new ConfigValidationError([{ field: 'environment', message: 'ENVIRONMENT must remain simulation' }]);
  }

  const errors: { field: string; message: string }[] = [];
  const deploymentTier = (input.deploymentTier ?? 'development') as string;
  if (!DEPLOYMENT_TIERS.includes(deploymentTier as DeploymentTier)) {
    errors.push({ field: 'deploymentTier', message: `must be one of ${DEPLOYMENT_TIERS.join(', ')}` });
  }

  const host = input.host ?? '127.0.0.1';
  if (host.length === 0) {
    errors.push({ field: 'host', message: 'host is required' });
  }

  const port = input.port ?? 8787;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    errors.push({ field: 'port', message: 'port must be an integer 0-65535' });
  }

  const apiBasePath = input.apiBasePath ?? '/api/v1';
  if (apiBasePath !== '/api/v1') {
    errors.push({ field: 'apiBasePath', message: 'canonical application API namespace is /api/v1' });
  }

  const logLevel = (input.logLevel ?? 'info') as string;
  if (!LOG_LEVELS.includes(logLevel as LogLevel)) {
    errors.push({ field: 'logLevel', message: `must be one of ${LOG_LEVELS.join(', ')}` });
  }

  const bodyLimitBytes = input.bodyLimitBytes ?? 16_384;
  if (!Number.isInteger(bodyLimitBytes) || bodyLimitBytes < 256 || bodyLimitBytes > 1_048_576) {
    errors.push({ field: 'bodyLimitBytes', message: 'bodyLimitBytes must be an integer 256-1048576' });
  }

  const requestTimeoutMs = input.requestTimeoutMs ?? 10_000;
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 120_000) {
    errors.push({ field: 'requestTimeoutMs', message: 'requestTimeoutMs must be an integer 100-120000' });
  }

  const shutdownTimeoutMs = input.shutdownTimeoutMs ?? 5_000;
  if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 100 || shutdownTimeoutMs > 60_000) {
    errors.push({ field: 'shutdownTimeoutMs', message: 'shutdownTimeoutMs must be an integer 100-60000' });
  }

  const rateLimitPerMinute = input.rateLimitPerMinute ?? 60;
  if (!Number.isInteger(rateLimitPerMinute) || rateLimitPerMinute < 1 || rateLimitPerMinute > 100_000) {
    errors.push({ field: 'rateLimitPerMinute', message: 'rateLimitPerMinute must be an integer 1-100000' });
  }

  const idempotencyTtlSeconds = input.idempotencyTtlSeconds ?? 86_400;
  if (!Number.isInteger(idempotencyTtlSeconds) || idempotencyTtlSeconds < 30 || idempotencyTtlSeconds > 2_592_000) {
    errors.push({ field: 'idempotencyTtlSeconds', message: 'idempotencyTtlSeconds must be an integer 30-2592000' });
  }

  const idempotencyBackend = (input.idempotencyBackend ?? 'injected') as string;
  if (!IDEMPOTENCY_BACKENDS.includes(idempotencyBackend as IdempotencyBackend)) {
    errors.push({ field: 'idempotencyBackend', message: 'must be postgres or injected' });
  }

  const rateLimitBackend = (input.rateLimitBackend ?? 'memory') as string;
  if (!RATE_LIMIT_BACKENDS.includes(rateLimitBackend as RateLimitBackend)) {
    errors.push({ field: 'rateLimitBackend', message: 'must be postgres, memory, or injected' });
  }

  const authMode = (input.authMode ?? 'disabled') as string;
  if (authMode !== 'disabled' && authMode !== 'required') {
    errors.push({ field: 'authMode', message: 'must be disabled or required' });
  }

  const allowedOrigins = input.allowedOrigins ?? [];
  const allowWildcardCors = input.allowWildcardCors ?? false;
  if (allowedOrigins.includes('*') || allowWildcardCors) {
    if (deploymentTier === 'production' || deploymentTier === 'staging') {
      errors.push({
        field: 'allowedOrigins',
        message: 'wildcard CORS is forbidden for staging and production authenticated APIs',
      });
    }
  }
  for (const origin of allowedOrigins) {
    if (origin !== '*' && !/^https?:\/\/[A-Za-z0-9._:-]+(?::\d+)?$/.test(origin) && origin !== 'null') {
      errors.push({ field: 'allowedOrigins', message: `invalid origin ${origin}` });
    }
  }

  const featureFlags: FeatureFlags = {
    testRoutes: input.featureFlags?.testRoutes ?? false,
    requirePersistenceForReady: input.featureFlags?.requirePersistenceForReady ?? false,
  };

  if ((deploymentTier === 'production' || deploymentTier === 'staging') && featureFlags.testRoutes) {
    errors.push({ field: 'featureFlags.testRoutes', message: 'test routes are forbidden outside development/preview' });
  }

  if ((deploymentTier === 'production' || deploymentTier === 'staging') && idempotencyBackend !== 'postgres') {
    errors.push({
      field: 'idempotencyBackend',
      message: 'staging and production must use the PostgreSQL idempotency backend',
    });
  }

  if (PRODUCTION_READY !== false || PRODUCTION_ACTIVE !== false || LIVE_CONNECTIVITY_ENABLED !== false || production_authorized !== false) {
    errors.push({ field: 'production', message: 'production activation flags must remain false' });
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  return Object.freeze({
    environment: 'simulation',
    deploymentTier: deploymentTier as DeploymentTier,
    host,
    port,
    apiBasePath,
    allowedOrigins: Object.freeze([...allowedOrigins]),
    allowWildcardCors,
    logLevel: logLevel as LogLevel,
    bodyLimitBytes,
    requestTimeoutMs,
    shutdownTimeoutMs,
    rateLimitPerMinute,
    rateLimitBackend: rateLimitBackend as RateLimitBackend,
    idempotencyTtlSeconds,
    idempotencyBackend: idempotencyBackend as IdempotencyBackend,
    authMode: authMode as 'disabled' | 'required',
    databaseConfigured: input.databaseConfigured ?? false,
    featureFlags: Object.freeze(featureFlags),
    CORE_CODE_COMPLETE_CANDIDATE,
    PRODUCTION_READY,
    PRODUCTION_ACTIVE,
    LIVE_CONNECTIVITY_ENABLED,
    production_authorized,
  });
}

export function loadValidatedPlatformApiConfig(env: NodeJS.ProcessEnv = process.env): PlatformApiConfig {
  return validatePlatformApiConfig(loadPlatformApiConfigFromEnv(env));
}

export { parseInteger as parseOptionalInteger };
