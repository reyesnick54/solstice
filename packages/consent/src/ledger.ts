import { sha256Hex } from '../../security/src/hash.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { ConsentId, ConsentVersion } from './ids.ts';
import type { ConsentLedgerEntry } from './types.ts';
import type { ConsentStore } from './store.ts';

/**
 * Append-only consent authorization-history ledger.
 * This is not the canonical financial ledger. It never stores balances,
 * posts journals, or issues Execution Authority.
 */
export class ConsentLedger {
  private readonly store: ConsentStore;

  constructor(store: ConsentStore) {
    this.store = store;
  }

  append(input: {
    readonly consentId: ConsentId;
    readonly version: ConsentVersion;
    readonly kind: ConsentLedgerEntry['kind'];
    readonly occurredAt: UtcInstant;
    readonly payload: ConsentLedgerEntry['payload'];
  }): ConsentLedgerEntry {
    const previousHash = this.store.lastLedgerHash();
    const sequence = this.store.nextLedgerSequence();
    const canonical = JSON.stringify({
      sequence,
      consentId: input.consentId,
      version: input.version,
      kind: input.kind,
      occurredAt: input.occurredAt,
      payload: input.payload,
      previousHash,
    });
    const entry: ConsentLedgerEntry = Object.freeze({
      sequence,
      consentId: input.consentId,
      version: input.version,
      kind: input.kind,
      occurredAt: input.occurredAt,
      hash: sha256Hex(canonical),
      previousHash,
      payload: input.payload,
    });
    this.store.appendLedger(entry);
    return entry;
  }

  verify(): boolean {
    let previous: string | null = null;
    for (const entry of this.store.ledgerEntries()) {
      const canonical = JSON.stringify({
        sequence: entry.sequence,
        consentId: entry.consentId,
        version: entry.version,
        kind: entry.kind,
        occurredAt: entry.occurredAt,
        payload: entry.payload,
        previousHash: previous,
      });
      if (sha256Hex(canonical) !== entry.hash || entry.previousHash !== previous) {
        return false;
      }
      previous = entry.hash;
    }
    return true;
  }
}
