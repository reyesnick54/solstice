/**
 * HELIOS M13 market regime engine — classification and transition tracking.
 *
 * Does not choose trades and does not receive financial authority.
 */

import { evaluateMarketRegime } from './evaluate.ts';
import { InMemoryMarketRegimeStore } from './store.ts';
import type {
  MarketRegime,
  MarketRegimeEvaluationInput,
  MarketRegimeEvaluationResult,
  MarketRegimeStoreSnapshot,
  RegimeTransition,
} from './types.ts';
import type { MarketRegimeScope } from './taxonomy.ts';

export type MarketRegimeEnginePorts = {
  readonly store?: InMemoryMarketRegimeStore;
};

export class MarketRegimeEngine {
  readonly #store: InMemoryMarketRegimeStore;

  constructor(ports: MarketRegimeEnginePorts = {}) {
    this.#store = ports.store ?? new InMemoryMarketRegimeStore();
  }

  evaluate(input: MarketRegimeEvaluationInput): MarketRegimeEvaluationResult & {
    readonly transitions: readonly RegimeTransition[];
  } {
    const result = evaluateMarketRegime(input);
    const transitions = this.#store.recordRegime(result.regime);
    return Object.freeze({ ...result, transitions });
  }

  latestRegime(scope: MarketRegimeScope, scopeId: string): MarketRegime | null {
    return this.#store.latestRegime(scope, scopeId);
  }

  activeTransitions(scopeId?: string): readonly RegimeTransition[] {
    return this.#store.activeTransitions(scopeId);
  }

  completedTransitions(scopeId?: string): readonly RegimeTransition[] {
    return this.#store.completedTransitions(scopeId);
  }

  snapshot(): MarketRegimeStoreSnapshot {
    return this.#store.snapshot();
  }

  loadSnapshot(snapshot: MarketRegimeStoreSnapshot): void {
    this.#store.loadSnapshot(snapshot);
  }
}
