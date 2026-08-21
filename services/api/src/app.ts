/**
 * Composition root for the SunRey Platform API.
 *
 * Handlers orchestrate. They do not import Ledger, Kernel, or
 * Execution Authority. Domain mutation stays in canonical services.
 */

import type { Clock } from '../../../packages/config/src/clock.ts';

import {
  loadValidatedPlatformApiConfig,
  validatePlatformApiConfig,
  type PlatformApiConfig,
  type PlatformApiConfigInput,
} from './config.ts';
import { type Authenticator, nullAuthenticator } from './context.ts';
import {
  MemoryIdempotencyRepository,
  PostgresIdempotencyRepository,
  type IdempotencyRepository,
  type SqlClient,
} from './idempotency.ts';
import { configurationCheck, evaluateReadiness, persistenceCheck, type ReadinessCheck } from './readiness.ts';
import { MemoryRateLimitRepository, PostgresRateLimitRepository, type RateLimitRepository } from './rate-limit.ts';
import { createRoutes } from './routes.ts';
import { startPlatformApi, type RunningPlatformApi } from './server.ts';

export type PlatformApiAppOptions = {
  readonly config?: PlatformApiConfig | PlatformApiConfigInput;
  readonly env?: NodeJS.ProcessEnv;
  readonly idempotency?: IdempotencyRepository;
  readonly rateLimit?: RateLimitRepository;
  readonly authenticator?: Authenticator;
  readonly clock?: Clock;
  readonly sql?: SqlClient;
  readonly persistenceProbe?: () => Promise<boolean>;
  readonly extraReadinessChecks?: readonly ReadinessCheck[];
  readonly logSink?: (line: string) => void;
};

export async function createPlatformApi(options: PlatformApiAppOptions = {}): Promise<RunningPlatformApi> {
  const config = resolveConfig(options);
  const sql = options.sql;
  const idempotency = options.idempotency ?? defaultIdempotency(config, sql);
  const rateLimit = options.rateLimit ?? defaultRateLimit(config, sql);
  const probe = options.persistenceProbe ?? (sql ? async () => probeSql(sql) : undefined);
  const checks = [
    configurationCheck(config),
    persistenceCheck({
      configured: config.databaseConfigured || sql !== undefined,
      required: config.featureFlags.requirePersistenceForReady,
      ...(probe ? { probe } : {}),
    }),
    ...(options.extraReadinessChecks ?? []),
  ];

  return startPlatformApi({
    config,
    routes: createRoutes({
      config,
      readiness: () => evaluateReadiness(config, checks),
    }),
    idempotency,
    rateLimit,
    authenticator: options.authenticator ?? nullAuthenticator,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.logSink ? { logSink: options.logSink } : {}),
  });
}

function resolveConfig(options: PlatformApiAppOptions): PlatformApiConfig {
  if (options.config && 'PRODUCTION_READY' in options.config) {
    return options.config;
  }
  if (options.config) {
    return validatePlatformApiConfig(options.config);
  }
  return loadValidatedPlatformApiConfig(options.env);
}

function defaultIdempotency(config: PlatformApiConfig, sql: SqlClient | undefined): IdempotencyRepository {
  if (config.idempotencyBackend === 'postgres') {
    if (!sql) {
      throw new Error('PostgreSQL idempotency backend requires an injected SQL client');
    }
    return new PostgresIdempotencyRepository(sql);
  }
  return new MemoryIdempotencyRepository();
}

function defaultRateLimit(config: PlatformApiConfig, sql: SqlClient | undefined): RateLimitRepository {
  if (config.rateLimitBackend === 'postgres') {
    if (!sql) {
      throw new Error('PostgreSQL rate-limit backend requires an injected SQL client');
    }
    return new PostgresRateLimitRepository(sql);
  }
  return new MemoryRateLimitRepository();
}

async function probeSql(sql: SqlClient): Promise<boolean> {
  const result = await sql.query<{ ok: number }>('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}
