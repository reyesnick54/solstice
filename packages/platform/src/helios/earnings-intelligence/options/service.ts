import type { UtcInstant } from '@solstice/domain';
import { assertPreEventEvaluation } from './certification.ts';
import { computeOptionsPreEventMetrics } from './compute.ts';
import { buildOptionsEarningsExpectationState } from './state.ts';
import type {
  HistoricalIvSample,
  OptionChainSnapshot,
  OptionsEarningsExpectationState,
  OptionsVolumeBaseline,
} from './types.ts';
import type { OptionsEarningsIntelligenceStore } from './store.ts';
import { InMemoryOptionsEarningsIntelligenceStore } from './store.ts';

export type HeliosOptionsEarningsIntelligenceServiceOptions = {
  readonly store?: OptionsEarningsIntelligenceStore;
};

export class HeliosOptionsEarningsIntelligenceService {
  readonly #store: OptionsEarningsIntelligenceStore;

  constructor(options: HeliosOptionsEarningsIntelligenceServiceOptions = {}) {
    this.#store = options.store ?? new InMemoryOptionsEarningsIntelligenceStore();
  }

  store(): OptionsEarningsIntelligenceStore {
    return this.#store;
  }

  buildPreEventExpectation(input: {
    readonly snapshot: OptionChainSnapshot;
    readonly evaluationTime: UtcInstant;
    readonly historicalIv?: readonly HistoricalIvSample[];
    readonly volumeBaseline?: OptionsVolumeBaseline | null;
  }): OptionsEarningsExpectationState {
    const pit = assertPreEventEvaluation(input.snapshot, input.evaluationTime);
    if (!pit.ok) {
      throw new Error(`pre_event_pit:${pit.reason}`);
    }
    const metrics = computeOptionsPreEventMetrics(input);
    const state = buildOptionsEarningsExpectationState({
      snapshot: input.snapshot,
      metrics,
    });
    this.#store.saveChain(input.snapshot);
    this.#store.saveExpectationState(state);
    return state;
  }
}

export function createHeliosOptionsEarningsIntelligenceService(
  options: HeliosOptionsEarningsIntelligenceServiceOptions = {},
): HeliosOptionsEarningsIntelligenceService {
  return new HeliosOptionsEarningsIntelligenceService(options);
}
