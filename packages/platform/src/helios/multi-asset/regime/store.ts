/**
 * In-memory regime transition persistence for Strategy Lab analysis.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  MarketRegime,
  MarketRegimeStoreSnapshot,
  RegimeTransition,
} from './types.ts';
import type { MarketRegimeDimension, MarketRegimeScope } from './taxonomy.ts';

const KEY_SEP = '\u001f';

export class InMemoryMarketRegimeStore {
  readonly #active = new Map<string, RegimeTransition>();
  readonly #completed: RegimeTransition[] = [];
  readonly #latestByScope = new Map<string, MarketRegime>();

  recordRegime(regime: MarketRegime): readonly RegimeTransition[] {
    this.#latestByScope.set(`${regime.scope}:${regime.scopeId}`, regime);
    const changes: RegimeTransition[] = [];
    const activeDimensions = new Set(
      regime.detectedRegimes
        .filter((row) => row.strengthBps > 0)
        .map((row) => row.dimension),
    );

    for (const detected of regime.detectedRegimes) {
      if (detected.strengthBps <= 0) {
        continue;
      }
      const key = activeKey(regime.scope, regime.scopeId, detected.dimension);
      const existing = this.#active.get(key);
      if (!existing) {
        const transition = freezeTransition({
          transitionId: `rt_${regime.scopeId}_${detected.dimension}_${regime.asOf}`,
          scope: regime.scope,
          scopeId: regime.scopeId,
          dimension: detected.dimension,
          startedAt: regime.asOf,
          endedAt: null,
          startStrengthBps: detected.strengthBps,
          endStrengthBps: null,
          startRegimeId: regime.regimeId,
          endRegimeId: null,
        });
        this.#active.set(key, transition);
        changes.push(transition);
      }
    }

    for (const [key, active] of this.#active.entries()) {
      if (active.scopeId !== regime.scopeId || active.scope !== regime.scope) {
        continue;
      }
      if (!activeDimensions.has(active.dimension)) {
        const ended = freezeTransition({
          ...active,
          endedAt: regime.asOf,
          endStrengthBps: 0,
          endRegimeId: regime.regimeId,
        });
        this.#active.delete(key);
        this.#completed.push(ended);
        changes.push(ended);
      }
    }

    return Object.freeze(changes);
  }

  activeTransitions(scopeId?: string): readonly RegimeTransition[] {
    const rows = [...this.#active.values()];
    return Object.freeze(scopeId ? rows.filter((row) => row.scopeId === scopeId) : rows);
  }

  completedTransitions(scopeId?: string): readonly RegimeTransition[] {
    return Object.freeze(
      scopeId ? this.#completed.filter((row) => row.scopeId === scopeId) : [...this.#completed],
    );
  }

  latestRegime(scope: MarketRegimeScope, scopeId: string): MarketRegime | null {
    return this.#latestByScope.get(`${scope}:${scopeId}`) ?? null;
  }

  snapshot(): MarketRegimeStoreSnapshot {
    return Object.freeze({
      activeTransitions: Object.freeze([...this.#active.values()]),
      completedTransitions: Object.freeze([...this.#completed]),
      latestRegimes: Object.freeze([...this.#latestByScope.values()]),
    });
  }

  loadSnapshot(snapshot: MarketRegimeStoreSnapshot): void {
    this.#active.clear();
    this.#completed.length = 0;
    this.#latestByScope.clear();
    for (const transition of snapshot.activeTransitions) {
      this.#active.set(activeKey(transition.scope, transition.scopeId, transition.dimension), transition);
    }
    this.#completed.push(...snapshot.completedTransitions);
    for (const regime of snapshot.latestRegimes) {
      this.#latestByScope.set(`${regime.scope}:${regime.scopeId}`, regime);
    }
  }
}

function activeKey(scope: MarketRegimeScope, scopeId: string, dimension: MarketRegimeDimension): string {
  return `${scope}${KEY_SEP}${scopeId}${KEY_SEP}${dimension}`;
}

function freezeTransition(transition: RegimeTransition): RegimeTransition {
  return Object.freeze(transition);
}
