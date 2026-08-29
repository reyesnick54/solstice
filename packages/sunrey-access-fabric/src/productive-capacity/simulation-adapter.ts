import { filterCapacitySlices, sortSlicesByAvailability, validateQueryWindow } from './query.ts';
import type { ProductiveCapacityPort } from './port.ts';
import type {
  CapacityQueryOutcome,
  CapacitySlice,
  CapacitySliceQuery,
  UtilizationQuery,
  UtilizationQueryOutcome,
} from './types.ts';
import { simulationCapacityFixtures } from './fixtures.ts';

export type SimulationProductiveCapacityAdapterOptions = {
  readonly slices?: readonly CapacitySlice[];
};

/**
 * Deterministic simulation adapter for ACCESS-03 testing only.
 *
 * Read-only. Querying never creates or mutates capacity slices.
 */
export class SimulationProductiveCapacityAdapter implements ProductiveCapacityPort {
  readonly sourceClass = 'SIMULATION_FIXTURE' as const;
  readonly #slices: readonly CapacitySlice[];

  constructor(options: SimulationProductiveCapacityAdapterOptions = {}) {
    this.#slices = Object.freeze([...(options.slices ?? simulationCapacityFixtures())]);
  }

  queryAvailability(query: CapacitySliceQuery): CapacityQueryOutcome {
    const window = validateQueryWindow(query);
    if (!window.ok) {
      return { ok: false, code: 'INVALID_TIME_WINDOW', message: window.message };
    }
    const filtered = sortSlicesByAvailability(filterCapacitySlices(this.#slices, query));
    return {
      ok: true,
      slices: filtered,
      queriedAtUnixSeconds: query.nowUnixSeconds,
      sourceCount: filtered.length,
    };
  }

  queryUtilization(query: UtilizationQuery): UtilizationQueryOutcome {
    const slice = this.#slices.find((row) => row.productiveObjectRef === query.productiveObjectRef);
    if (!slice) {
      return { ok: false, code: 'UNKNOWN_SLICE', message: 'productive object not found in simulation adapter' };
    }
    if (!slice.utilization || !slice.utilization.independentlyEvidenced) {
      return { ok: false, code: 'UNPROVENANCED_SOURCE', message: 'utilization requires independently evidenced basis' };
    }
    const period = query.measurementPeriod;
    if (period.validUntilUnixSeconds <= period.validFromUnixSeconds) {
      return { ok: false, code: 'INVALID_TIME_WINDOW', message: 'measurement period is undefined' };
    }
    if (
      slice.availabilityStartUnixSeconds > period.validFromUnixSeconds ||
      slice.availabilityEndUnixSeconds < period.validUntilUnixSeconds
    ) {
      return { ok: false, code: 'INVALID_TIME_WINDOW', message: 'measurement period outside slice availability window' };
    }
    return {
      ok: true,
      utilization: slice.utilization,
      sliceId: slice.sliceId,
      provenance: slice.provenance,
    };
  }

  snapshot() {
    return Object.freeze({
      sliceCount: this.#slices.length,
      sourceClass: this.sourceClass,
    });
  }

  /** Exposes fixture count for tests proving queries do not create capacity. */
  fixtureCount(): number {
    return this.#slices.length;
  }
}

export function createSimulationProductiveCapacityAdapter(): SimulationProductiveCapacityAdapter {
  return new SimulationProductiveCapacityAdapter();
}
