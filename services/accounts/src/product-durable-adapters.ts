/**
 * Persistence adapters for product-integration durable mode.
 * services/api must not import packages/persistence directly.
 */

import type { Pool } from 'pg';

import { isPersistenceTestEnabled } from '../../../packages/config/src/env.ts';
import {
  listConsumerInternalPayments,
  loadAgentRuntimeState,
  loadConsumerInternalPayment,
  loadConsumerInternalPaymentByIdempotency,
  persistAgentRuntimeState,
  persistConsentState,
  persistConsumerInternalPayment,
  persistenceEnvFromProcess as resolvePersistenceEnv,
  type PersistedConsumerInternalPayment,
  type PersistenceEnv,
} from '../../../packages/persistence/src/index.ts';

export { createPostgresSimulationRuntime, type DurableSimulationRuntime } from './postgres-runtime.ts';
export type { PersistedConsumerInternalPayment };

export async function persistenceEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): Promise<PersistenceEnv> {
  return resolvePersistenceEnv(env);
}

/**
 * Product integration may run durably in two contexts:
 *
 * 1. persistence integration tests (`SUNREY_PERSISTENCE_TEST=1`), and
 * 2. the hosted internal sandbox (`SUNREY_PRODUCT_INTEGRATION_MODE=DURABLE`).
 *
 * The explicit runtime mode exists so a deployed sandbox never has to pretend
 * it is a test process merely to obtain PostgreSQL-backed product state.
 */
export function isProductIntegrationDurableModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const requested = env.SUNREY_PRODUCT_INTEGRATION_MODE?.trim().toUpperCase();
  if (requested === 'DURABLE') {
    return true;
  }
  if (requested === 'IN_MEMORY') {
    return false;
  }
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

export async function persistProductInternalPayment(
  pool: Pool,
  payment: PersistedConsumerInternalPayment,
): Promise<void> {
  await persistConsumerInternalPayment(pool, payment);
}

export async function loadProductInternalPaymentByIdempotency(
  pool: Pool,
  idempotencyKey: string,
): Promise<PersistedConsumerInternalPayment | null> {
  return loadConsumerInternalPaymentByIdempotency(pool, idempotencyKey);
}

export async function loadProductInternalPayment(
  pool: Pool,
  customerId: string,
  paymentId: string,
): Promise<PersistedConsumerInternalPayment | null> {
  return loadConsumerInternalPayment(pool, customerId, paymentId);
}

export async function listProductInternalPayments(
  pool: Pool,
  customerId: string,
): Promise<readonly PersistedConsumerInternalPayment[]> {
  return listConsumerInternalPayments(pool, customerId);
}
