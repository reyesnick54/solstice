/**
 * Oracle replay protection — repeated API polling must not create
 * repeated production. The same source record remains one observation identity.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';

export type ObservationIdentityMaterial = {
  readonly providerId: string;
  readonly sourceRecordId: string;
  readonly datasetOriginId: string;
};

export type ReplayLedger = {
  readonly seen: ReadonlySet<string>;
  readonly admit: (material: ObservationIdentityMaterial) => 'accepted' | 'duplicate';
  readonly count: () => number;
};

export function observationIdentityKey(material: ObservationIdentityMaterial): string {
  return sha256Hex(
    `oracle-mesh.replay.v1:${material.providerId}:${material.sourceRecordId}:${material.datasetOriginId}`,
  );
}

export function createReplayLedger(): ReplayLedger {
  const seen = new Set<string>();
  return Object.freeze({
    seen,
    admit(material: ObservationIdentityMaterial): 'accepted' | 'duplicate' {
      const key = observationIdentityKey(material);
      if (seen.has(key)) {
        return 'duplicate';
      }
      seen.add(key);
      return 'accepted';
    },
    count(): number {
      return seen.size;
    },
  });
}

/**
 * Repeated polling of the same provider record must not inflate production counts.
 */
export function repeatedPollingDoesNotCreateRepeatedProduction(
  ledger: ReplayLedger,
  material: ObservationIdentityMaterial,
  pollCount: number,
): { readonly uniqueObservations: number; readonly duplicates: number } {
  let duplicates = 0;
  for (let index = 0; index < pollCount; index += 1) {
    const result = ledger.admit(material);
    if (result === 'duplicate') {
      duplicates += 1;
    }
  }
  return Object.freeze({
    uniqueObservations: ledger.count(),
    duplicates,
  });
}
