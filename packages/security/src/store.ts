import type { KeyMetadata } from './metadata.ts';
import type { ServiceIdentity } from './identity.ts';

/**
 * Persistence port for safe security metadata. Implementations must never
 * write private key material or secret values.
 */
export type KeyMetadataStore = {
  upsert(metadata: KeyMetadata): Promise<void> | void;
  list(purpose?: string): Promise<readonly KeyMetadata[]> | readonly KeyMetadata[];
};

export type ServiceIdentityStore = {
  upsert(identity: ServiceIdentity): Promise<void> | void;
  list(): Promise<readonly ServiceIdentity[]> | readonly ServiceIdentity[];
};

export class InMemoryKeyMetadataStore implements KeyMetadataStore {
  readonly #rows = new Map<string, KeyMetadata>();

  upsert(metadata: KeyMetadata): void {
    this.#rows.set(`${metadata.keyId}:${metadata.version}`, Object.freeze({ ...metadata }));
  }

  list(purpose?: string): readonly KeyMetadata[] {
    const all = [...this.#rows.values()];
    return purpose ? all.filter((row) => row.purpose === purpose) : all;
  }
}
