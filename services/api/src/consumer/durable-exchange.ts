import type { Pool } from 'pg';

import type { UtcInstant } from '@solstice/domain';
import {
  captureConsumerAlphaSnapshot,
  hydrateConsumerAlphaLifecycle,
  type ConsumerAlphaIdempotencyRecord,
  type ConsumerAlphaIdempotencyResource,
  type LifecycleMode,
} from '@solstice/sunrey-exchange';
import type { DurableSimulationRuntime } from '../../../accounts/src/product-durable-adapters.ts';
import {
  loadProductExchangeIdempotency,
  loadProductExchangeState,
  persistProductExchangeIdempotency,
  persistProductExchangeState,
} from '../../../accounts/src/product-durable-adapters.ts';
import { ExchangeBffSurface, type ExchangeBffPersistenceHooks } from './exchange.ts';
import type { BffPrincipal } from './ports.ts';

export type DurableExchangeBindingReport = {
  readonly schema: 'sunrey.durable-exchange-binding.v1';
  readonly hydratedCustomers: number;
  readonly productionTradingEnabled: false;
  readonly liveExchangeEnabled: false;
  readonly mainnetActive: false;
};

export type DurableExchangeSurface = ExchangeBffSurface & {
  readonly bindingReport: DurableExchangeBindingReport;
};

/**
 * Durable Internal Alpha exchange composition for the hosted sandbox.
 *
 * Exchange domain state remains authoritative. PostgreSQL stores restart-safe
 * workflow snapshots and idempotency records only.
 */
export async function createDurableExchangeSurface(
  durable: DurableSimulationRuntime,
  now?: () => UtcInstant,
): Promise<DurableExchangeSurface> {
  const pool = durable.session.pools.customer;
  const clock = now ?? (() => durable.runtime.clock.now());
  let hydratedCustomers = 0;
  const preloaded = new Map<string, ReturnType<typeof hydrateConsumerAlphaLifecycle>>();

  for (const customer of durable.runtime.customers.list()) {
    const snapshot = await loadProductExchangeState(pool, customer.id, 'READY');
    if (snapshot) {
      preloaded.set(`${customer.id}:READY`, hydrateConsumerAlphaLifecycle({ snapshot, now: clock() }));
      hydratedCustomers += 1;
    }
  }

  const hooks: ExchangeBffPersistenceHooks = {
    async load(customerId, mode) {
      const key = `${customerId}:${mode}`;
      const cached = preloaded.get(key);
      if (cached) {
        return cached;
      }
      const snapshot = await loadProductExchangeState(pool, customerId, mode);
      if (!snapshot) {
        return null;
      }
      const world = hydrateConsumerAlphaLifecycle({ snapshot, now: clock() });
      preloaded.set(key, world);
      return world;
    },
    async save(customerId, mode, world) {
      await persistProductExchangeState(pool, customerId, mode, captureConsumerAlphaSnapshot(world));
      preloaded.set(`${customerId}:${mode}`, world);
    },
    async loadIdempotency(idempotencyKey) {
      return loadProductExchangeIdempotency(pool, idempotencyKey);
    },
    async saveIdempotency(record) {
      await persistProductExchangeIdempotency(pool, record);
    },
  };

  const surface = new ExchangeBffSurface(clock, hooks, preloaded) as DurableExchangeSurface;
  Object.defineProperty(surface, 'bindingReport', {
    value: Object.freeze({
      schema: 'sunrey.durable-exchange-binding.v1',
      hydratedCustomers,
      productionTradingEnabled: false,
      liveExchangeEnabled: false,
      mainnetActive: false,
    }),
    enumerable: true,
  });
  return surface;
}

export function parseIdempotentExchangeResponse(
  record: ConsumerAlphaIdempotencyRecord,
  customerId: string,
  resourceType: ConsumerAlphaIdempotencyResource,
): Record<string, unknown> | null {
  if (record.customerId !== customerId || record.resourceType !== resourceType) {
    return null;
  }
  return JSON.parse(record.responseCanonical) as Record<string, unknown>;
}
