import type {
  CapacitySliceQuery,
  CapacityQueryOutcome,
  CapacitySliceQueryResult,
  ProductiveCapacityPortSnapshot,
  UtilizationQuery,
  UtilizationQueryOutcome,
} from './types.ts';

/**
 * Access-side port for consuming productive capacity from canonical owners.
 *
 * Implementations must be read-only. Querying must never create, mint, or
 * infer capacity without provenance.
 */
export type ProductiveCapacityPort = {
  readonly sourceClass: import('./taxonomy.ts').CapacitySourceClass;
  queryAvailability(query: CapacitySliceQuery): CapacityQueryOutcome;
  queryUtilization(query: UtilizationQuery): UtilizationQueryOutcome;
  snapshot(): ProductiveCapacityPortSnapshot;
};

export function assertReadOnlyPort(port: ProductiveCapacityPort): void {
  const forbidden = ['create', 'register', 'mint', 'issue', 'post', 'write', 'mutate'];
  for (const key of Object.keys(port)) {
    if (forbidden.some((word) => key.toLowerCase().includes(word))) {
      throw new Error(`ProductiveCapacityPort must not expose mutating method: ${key}`);
    }
  }
}
