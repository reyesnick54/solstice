/**
 * Multi-vintage search series retention (revision tracking).
 */

import type { SearchSeriesVintage } from '../types.ts';

export type SearchVintageStoreSnapshot = {
  readonly vintages: readonly SearchSeriesVintage[];
};

export class SearchVintageStore {
  readonly #vintages = new Map<string, SearchSeriesVintage>();

  upsertVintage(vintage: SearchSeriesVintage): void {
    this.#vintages.set(vintage.vintageId, vintage);
  }

  listVintages(entityProviderKey: string): readonly SearchSeriesVintage[] {
    return Object.freeze(
      [...this.#vintages.values()]
        .filter((v) => v.vintageId.startsWith(entityProviderKey))
        .sort((a, b) => a.revisionSequence - b.revisionSequence),
    );
  }

  snapshot(): SearchVintageStoreSnapshot {
    return Object.freeze({ vintages: Object.freeze([...this.#vintages.values()]) });
  }
}
