import { economicProofDigest } from './hash.ts';
import type { ObservationFingerprint } from './types.ts';

export type ObservationFingerprintMaterial = {
  readonly providerId: string;
  readonly sourceClass: string;
  readonly providerRecordId: string;
  readonly payloadDigest: string;
  readonly observedAtUtc: string;
};

export function asObservationFingerprint(value: string): ObservationFingerprint {
  return value as ObservationFingerprint;
}

/**
 * Detects exact/replayed observation records from the same provider path.
 * Independent corroborating observations intentionally produce different
 * fingerprints even when they describe the same canonical event.
 */
export function deriveObservationFingerprint(material: ObservationFingerprintMaterial): ObservationFingerprint {
  return asObservationFingerprint(
    economicProofDigest([
      'observation',
      material.providerId,
      material.sourceClass,
      material.providerRecordId,
      material.payloadDigest,
      material.observedAtUtc,
    ]),
  );
}

export function isObservationReplay(
  existing: ObservationFingerprint,
  candidate: ObservationFingerprint,
): boolean {
  return existing === candidate;
}
