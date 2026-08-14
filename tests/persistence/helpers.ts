import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  bootstrapPersistence,
  isPersistenceTestEnabled,
  migrateAll,
  persistenceEnvFromProcess,
  resetPersistedData,
  type PersistenceEnv,
} from '../../packages/persistence/src/index.ts';
import {
  createPostgresSimulationRuntime,
  type DurableSimulationRuntime,
} from '../../services/accounts/src/postgres-runtime.ts';
import { FrozenClock } from '../../services/accounts/src/runtime.ts';

export const PERSISTENCE_NOW = asUtcInstant('2026-08-14T09:00:00.000Z');

export function persistenceAvailable(): boolean {
  return isPersistenceTestEnabled();
}

export async function preparePersistence(): Promise<PersistenceEnv> {
  const env = persistenceEnvFromProcess();
  await bootstrapPersistence(env);
  await migrateAll(env, process.cwd());
  await resetPersistedData(env);
  return env;
}

export async function createDurableRuntime(
  env: PersistenceEnv,
): Promise<DurableSimulationRuntime> {
  return createPostgresSimulationRuntime(env, {
    clock: new FrozenClock(PERSISTENCE_NOW),
  });
}
