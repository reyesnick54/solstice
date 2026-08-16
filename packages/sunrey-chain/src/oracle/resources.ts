/**
 * Oracle-facing resource meter.
 *
 * Chunk 42 (general blockchain resource metering) is not a standalone
 * capability on main. Oracle submissions consume integer resource units
 * and follow this fee policy port: bounded payloads, no floating point,
 * fail-closed on oversized observations.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { OracleObservation, OracleRejection } from './types.ts';

export type OracleResourcePolicy = {
  readonly schemaVersion: 1;
  readonly maxPayloadBytes: number;
  readonly baseResourceUnits: bigint;
  readonly perByteResourceUnits: bigint;
  readonly maxResourceUnitsPerObservation: bigint;
};

export const DEVELOPMENT_ORACLE_RESOURCE_POLICY: OracleResourcePolicy = Object.freeze({
  schemaVersion: 1,
  maxPayloadBytes: 4_096,
  baseResourceUnits: 100n,
  perByteResourceUnits: 1n,
  maxResourceUnitsPerObservation: 5_000n,
});

export type ResourceCharge = {
  readonly payloadBytes: number;
  readonly resourceUnits: bigint;
};

export function observationPayloadBytes(observation: OracleObservation): number {
  return Buffer.byteLength(
    [
      observation.observationId,
      observation.oracleId,
      observation.feedId,
      observation.subject,
      observation.value.mantissa.toString(),
      observation.value.unit,
      observation.sourceReferenceCommitment,
      observation.methodologyReference,
      observation.signatureHex,
      observation.publicKeyHex,
      observation.deviceProvenance?.firmwareHash ?? '',
      observation.deviceProvenance?.hardwareAttestation ?? '',
    ].join('\0'),
    'utf8',
  );
}

export function meterOracleSubmission(
  observation: OracleObservation,
  policy: OracleResourcePolicy = DEVELOPMENT_ORACLE_RESOURCE_POLICY,
): Result<ResourceCharge, OracleRejection> {
  const payloadBytes = observationPayloadBytes(observation);
  if (payloadBytes > policy.maxPayloadBytes) {
    return err({
      code: 'ORACLE_PAYLOAD_OVERSIZED',
      detail: `oracle payload ${payloadBytes} exceeds ${policy.maxPayloadBytes}`,
    });
  }
  const resourceUnits = policy.baseResourceUnits + BigInt(payloadBytes) * policy.perByteResourceUnits;
  if (resourceUnits > policy.maxResourceUnitsPerObservation) {
    return err({
      code: 'ORACLE_FEE_INSUFFICIENT',
      detail: `resource units ${resourceUnits} exceed ${policy.maxResourceUnitsPerObservation}`,
    });
  }
  return ok(Object.freeze({ payloadBytes, resourceUnits }));
}
