import { economicProofDigest } from './hash.ts';
import type { CanonicalEntityId, CanonicalEventId, CanonicalEventMaterial } from './types.ts';

export function asCanonicalEventId(value: string): CanonicalEventId {
  return value as CanonicalEventId;
}

/**
 * Underlying economic event identity independent of provider record ids.
 */
export function deriveCanonicalEventId(material: CanonicalEventMaterial): CanonicalEventId {
  return asCanonicalEventId(
    economicProofDigest([
      'event',
      material.canonicalEntityId,
      material.economicAction,
      material.quantity.toString(),
      material.unit,
      material.validFromUtc,
      material.validUntilUtc ?? '',
      material.locationCommitment ?? '',
      material.domainIdentifierCommitment ?? '',
    ]),
  );
}

export function quantizeToHour(isoUtc: string): string {
  return `${isoUtc.slice(0, 13)}:00:00.000Z`;
}
