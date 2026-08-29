import type { ProductiveCapacityPort } from './port.ts';
import type { CapacityQueryOutcome, CapacitySliceQuery, UtilizationQuery, UtilizationQueryOutcome } from './types.ts';

export type ProductiveCapacityDiscoveryOptions = {
  readonly port: ProductiveCapacityPort;
};

/**
 * Access Fabric discovery service for productive capacity.
 *
 * Orchestrates read-only queries against a ProductiveCapacityPort.
 * Never creates supply, never acts as an oracle.
 */
export class ProductiveCapacityDiscovery {
  readonly #port: ProductiveCapacityPort;

  constructor(options: ProductiveCapacityDiscoveryOptions) {
    this.#port = options.port;
  }

  get port(): ProductiveCapacityPort {
    return this.#port;
  }

  findAvailable(query: CapacitySliceQuery): CapacityQueryOutcome {
    const before = this.#port.snapshot().sliceCount;
    const result = this.#port.queryAvailability({ ...query, kind: 'AVAILABILITY' });
    const after = this.#port.snapshot().sliceCount;
    if (before !== after) {
      return {
        ok: false,
        code: 'PORT_READ_ONLY',
        message: 'query must not mutate underlying capacity source',
      };
    }
    return result;
  }

  queryUtilization(query: UtilizationQuery): UtilizationQueryOutcome {
    const before = this.#port.snapshot().sliceCount;
    const result = this.#port.queryUtilization(query);
    const after = this.#port.snapshot().sliceCount;
    if (before !== after) {
      return {
        ok: false,
        code: 'PORT_READ_ONLY',
        message: 'utilization query must not mutate underlying capacity source',
      };
    }
    return result;
  }

  snapshot() {
    return this.#port.snapshot();
  }
}

export function createProductiveCapacityDiscovery(port: ProductiveCapacityPort): ProductiveCapacityDiscovery {
  return new ProductiveCapacityDiscovery({ port });
}
