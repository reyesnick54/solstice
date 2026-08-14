import type { PersonalDataCategory } from '@solstice/kernel';
import type { SealedEnvelope } from '../keys/provider.ts';

/**
 * Persistence port for the Personal Data Vault.
 *
 * ADR-0008 (persistence layer) is still PROPOSED. This interface keeps that
 * decision open: the vault talks only to this port. The in-process adapter
 * is not a system of record and does not authorise installing a driver,
 * ORM, or migration tool.
 *
 * There is no cross-category method. A caller that needs two categories
 * must issue two independently authorized requests, each against one store.
 */
export type StoredEnvelope = {
  readonly recordId: string;
  readonly subjectRef: string;
  readonly envelope: SealedEnvelope;
  readonly storedAt: string;
};

export interface CategoryStore {
  append(row: StoredEnvelope): void;
  list(): readonly StoredEnvelope[];
}

export interface VaultStorage {
  readonly persistenceDecision: 'ADR-0008-PROPOSED-INTERFACE-ONLY';
  storeFor(category: PersonalDataCategory): CategoryStore;
}
