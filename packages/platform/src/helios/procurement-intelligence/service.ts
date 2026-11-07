/**
 * HELIOS ALT10 procurement intelligence service — ingest, compile PIT demand state.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProcurementDataPorts, ProcurementExternalObservation } from '@solstice/external-data';

import { compileGovernmentDemandState } from './snapshot.ts';
import { createProcurementIntelligenceStore, type ProcurementIntelligenceStore } from './store.ts';
import type { CompileGovernmentDemandSnapshotInput, GovernmentDemandState } from './types.ts';

export type ProcurementIntelligenceServiceOptions = {
  readonly store?: ProcurementIntelligenceStore;
  readonly ports?: ProcurementDataPorts;
};

export class ProcurementIntelligenceService {
  readonly #store: ProcurementIntelligenceStore;
  readonly #ports: ProcurementDataPorts;

  constructor(options: ProcurementIntelligenceServiceOptions = {}) {
    this.#store = options.store ?? createProcurementIntelligenceStore();
    this.#ports = options.ports ?? {};
  }

  store(): ProcurementIntelligenceStore {
    return this.#store;
  }

  ingestObservation(observation: ProcurementExternalObservation, sealedAt: UtcInstant = observation.provenance.sunreyArrivalTime): void {
    this.#store.ingest(observation, sealedAt);
  }

  ingestMany(observations: readonly ProcurementExternalObservation[], sealedAt: UtcInstant): void {
    for (const row of observations) {
      this.ingestObservation(row, sealedAt);
    }
  }

  async syncFromPorts(input: {
    readonly attributionEntityId?: string;
    readonly asOfKnowableCutoff: UtcInstant;
    readonly sealedAt: UtcInstant;
  }): Promise<readonly ProcurementExternalObservation[]> {
    const collected: ProcurementExternalObservation[] = [];
    if (this.#ports.federalProcurementApi) {
      const rows = await this.#ports.federalProcurementApi.fetchAwards({
        attributionEntityId: input.attributionEntityId,
        asOfKnowableCutoff: input.asOfKnowableCutoff,
      });
      collected.push(...rows);
    }
    this.ingestMany(collected, input.sealedAt);
    return Object.freeze(collected);
  }

  demandStateAt(input: CompileGovernmentDemandSnapshotInput): GovernmentDemandState | null {
    return compileGovernmentDemandState(this.#store, input);
  }
}

export function createProcurementIntelligenceService(
  options: ProcurementIntelligenceServiceOptions = {},
): ProcurementIntelligenceService {
  return new ProcurementIntelligenceService(options);
}
