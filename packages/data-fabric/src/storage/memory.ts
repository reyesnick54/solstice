import { PERSONAL_DATA_CATEGORIES, type PersonalDataCategory } from '@solstice/kernel';

import type { CategoryStore, StoredEnvelope, VaultStorage } from './interface.ts';

class MemoryCategoryStore implements CategoryStore {
  readonly #rows: StoredEnvelope[] = [];

  append(row: StoredEnvelope): void {
    this.#rows.push(Object.freeze({ ...row, envelope: Object.freeze({ ...row.envelope }) }));
  }

  list(): readonly StoredEnvelope[] {
    return this.#rows.slice();
  }
}

/**
 * In-process adapter. Not durable. ADR-0008 remains PROPOSED; swapping this
 * for a cell-local database does not change vault or firewall call sites.
 */
export class InMemoryVaultStorage implements VaultStorage {
  readonly persistenceDecision = 'ADR-0008-PROPOSED-INTERFACE-ONLY' as const;
  readonly #stores = new Map<PersonalDataCategory, MemoryCategoryStore>();

  constructor() {
    for (const category of PERSONAL_DATA_CATEGORIES) {
      this.#stores.set(category, new MemoryCategoryStore());
    }
  }

  storeFor(category: PersonalDataCategory): CategoryStore {
    const store = this.#stores.get(category);
    if (!store) {
      throw new Error(`no store for category ${category}`);
    }
    return store;
  }
}
