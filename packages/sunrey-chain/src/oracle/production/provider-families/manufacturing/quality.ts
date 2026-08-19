/**
 * Quality inspection attestation.
 *
 * Quality may later affect verification or value through governed
 * policy. The quality system itself has no mint authority.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { QUALITY_SYSTEM_CAN_MINT, type ManufacturingObservation, type ManufacturingRejection, type QualityAttestation } from './types.ts';

export function linkQualityAttestation(
  observation: ManufacturingObservation,
): Result<QualityAttestation | null, ManufacturingRejection> {
  if (!observation.quality) {
    return ok(null);
  }
  if (observation.quality.authorizesMint !== false || QUALITY_SYSTEM_CAN_MINT) {
    return err({
      code: 'QUALITY_CANNOT_MINT',
      detail: 'quality attestation is evidence only and cannot mint MoonRey',
    });
  }
  if (observation.sourceClass === 'QUALITY_MANAGEMENT_SYSTEM' && observation.factType !== 'MANUFACTURING_OUTPUT') {
    return ok(Object.freeze({ ...observation.quality, authorizesMint: false as const }));
  }
  return ok(Object.freeze({ ...observation.quality, authorizesMint: false as const }));
}

export function qualityAttestationIsLinked(
  observation: ManufacturingObservation,
  attestation: QualityAttestation | null,
): boolean {
  return attestation !== null && attestation.attestationRef.length > 0 && observation.quality?.attestationRef === attestation.attestationRef;
}
