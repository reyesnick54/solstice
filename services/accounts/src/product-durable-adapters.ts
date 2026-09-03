/**
 * Persistence adapters for product-integration durable mode.
 * services/api must not import packages/persistence directly.
 */

import type { Pool } from 'pg';

import { isPersistenceTestEnabled } from '../../../packages/config/src/env.ts';

export { createPostgresSimulationRuntime, type DurableSimulationRuntime } from './postgres-runtime.ts';

export async function persistenceEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): Promise<import('../../../packages/persistence/src/env.ts').PersistenceEnv> {
  const { persistenceEnvFromProcess: resolve } = await import(
    '../../../packages/persistence/src/env.ts'
  );
  return resolve(env);
}

export function isProductIntegrationDurableModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPersistenceTestEnabled(env);
}

export async function loadProductAgentRuntimeState(pool: Pool): Promise<unknown | null> {
  const { loadAgentRuntimeState } = await import(
    '../../../packages/persistence/src/agent/pg-agent-runtime-store.ts'
  );
  return loadAgentRuntimeState(pool);
}

export async function persistProductAgentRuntimeState(pool: Pool, state: unknown): Promise<void> {
  const { persistAgentRuntimeState } = await import(
    '../../../packages/persistence/src/agent/pg-agent-runtime-store.ts'
  );
  await persistAgentRuntimeState(pool, state as never);
}

export async function persistProductConsentState(pool: Pool, state: unknown): Promise<void> {
  const { persistConsentState } = await import(
    '../../../packages/persistence/src/consent/pg-consent-store.ts'
  );
  await persistConsentState(pool, state as never);
}
