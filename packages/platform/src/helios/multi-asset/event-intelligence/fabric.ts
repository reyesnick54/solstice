/**
 * HELIOS M14 Macro Event Intelligence Fabric — ingest, normalize, preserve evidence.
 *
 * Research and opportunity discovery only. Does not execute trades.
 */

import type { UtcInstant } from '@solstice/domain';
import { deriveBlackoutWindow } from './blackout.ts';
import { mergeLateArrivingActual, normalizeMacroEvent } from './normalize.ts';
import { createMacroEventIntelligenceStore, type MacroEventIntelligenceStore } from './store.ts';
import type {
  IngestMacroEventInput,
  IngestMacroEventResult,
  MacroEventImpact,
  MacroEventInferenceProposal,
  MacroEventStoreSnapshot,
  SealedMacroEvent,
} from './types.ts';

export type MacroEventIntelligenceFabricOptions = {
  readonly store?: MacroEventIntelligenceStore;
  readonly autoBlackout?: boolean;
};

export class MacroEventIntelligenceFabric {
  readonly #store: MacroEventIntelligenceStore;
  readonly #autoBlackout: boolean;

  constructor(options: MacroEventIntelligenceFabricOptions = {}) {
    this.#store = options.store ?? createMacroEventIntelligenceStore();
    this.#autoBlackout = options.autoBlackout ?? true;
  }

  store(): MacroEventIntelligenceStore {
    return this.#store;
  }

  ingest(input: IngestMacroEventInput, sealedAt: UtcInstant): IngestMacroEventResult {
    const existing = this.#store.get(input.eventId);
    if (existing) {
      return Object.freeze({ ok: false, reason: 'DUPLICATE_EVENT_ID' });
    }

    try {
      const { artifact, surprise } = normalizeMacroEvent(input, sealedAt);
      const sealed: SealedMacroEvent = Object.freeze({ artifact, sealedAt });
      this.#store.put(sealed);

      if (this.#autoBlackout) {
        const blackout = deriveBlackoutWindow({
          event: artifact,
          blackoutId: `blackout_${artifact.eventId}`,
        });
        if (blackout) this.#store.putBlackout(blackout);
      }

      return Object.freeze({ ok: true, sealed, surprise });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'INGEST_FAILED';
      return Object.freeze({ ok: false, reason });
    }
  }

  ingestLateActual(input: {
    readonly eventId: string;
    readonly actualValues: IngestMacroEventInput['actualValues'];
    readonly knowableAt: UtcInstant;
    readonly arrivalTime: UtcInstant;
    readonly sealedAt: UtcInstant;
  }): IngestMacroEventResult {
    const existing = this.#store.get(input.eventId);
    if (!existing) {
      return Object.freeze({ ok: false, reason: 'EVENT_NOT_FOUND' });
    }

    const artifact = mergeLateArrivingActual({
      existing: existing.artifact,
      actualValues: Object.freeze([...(input.actualValues ?? [])]),
      knowableAt: input.knowableAt,
      arrivalTime: input.arrivalTime,
      sealedAt: input.sealedAt,
    });

    this.#store.update(input.eventId, artifact);
    return Object.freeze({
      ok: true,
      sealed: Object.freeze({ artifact, sealedAt: input.sealedAt }),
      surprise: artifact.surprise,
    });
  }

  attachImpact(impact: MacroEventImpact): void {
    if (!this.#store.get(impact.eventId)) {
      throw new Error('EVENT_NOT_FOUND');
    }
    this.#store.putImpact(impact);
  }

  attachProposal(proposal: MacroEventInferenceProposal): void {
    if (!this.#store.get(proposal.eventId)) {
      throw new Error('EVENT_NOT_FOUND');
    }
    this.#store.putProposal(proposal);
  }

  snapshot(): MacroEventStoreSnapshot {
    return this.#store.snapshot();
  }

  restore(snapshot: MacroEventStoreSnapshot): void {
    this.#store.restore(snapshot);
  }
}

export function createMacroEventIntelligenceFabric(
  options?: MacroEventIntelligenceFabricOptions,
): MacroEventIntelligenceFabric {
  return new MacroEventIntelligenceFabric(options);
}
