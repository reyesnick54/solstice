/**
 * Persistence adapters for product-integration durable mode.
 * services/api must not import packages/persistence directly.
 */

import type { Pool } from 'pg';

import { isPersistenceTestEnabled } from '../../../packages/config/src/env.ts';
import {
  loadAgentRuntimeState,
  persistAgentRuntimeState,
  persistConsentState,
  persistenceEnvFromProcess as resolvePersistenceEnv,
  type PersistenceEnv,
} from '../../../packages/persistence/src/index.ts';

export { createPostgresSimulationRuntime, type DurableSimulationRuntime } from './postgres-runtime.ts';

export async function persistenceEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): Promise<PersistenceEnv> {
  return resolvePersistenceEnv(env);
}

export function isProductIntegrationDurableModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPersistenceTestEnabled(env);
}

export async function loadProductAgentRuntimeState(pool: Pool): Promise<unknown | null> {
  return loadAgentRuntimeState(pool);
}

export async function persistProductAgentRuntimeState(pool: Pool, state: unknown): Promise<void> {
  await persistAgentRuntimeState(pool, state as never);
}

export async function persistProductConsentState(pool: Pool, state: unknown): Promise<void> {
  await persistConsentState(pool, state as never);
}
