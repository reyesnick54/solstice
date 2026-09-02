/**
 * Wave 4 — strict normalization validation.
 *
 * Invalid records are rejected to quarantine. They do not silently
 * disappear and do not become VerifiedEconomicFacts.
 */

import type { EconomicObservationEnvelope, NormalizationRejectionCode } from './types.ts';
import type { RawSourceRecord } from './source.ts';
import { UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH } from './types.ts';
import { isSupportedSchemaVersion, parseSchemaVersion } from './source.ts';
import { refuseDimensionalMix } from './units.ts';
import { isEconomicDomain } from './types.ts';

export type ValidationContext = {
  readonly seenFingerprints?: ReadonlySet<string>;
  readonly requireEntityId?: boolean;
};

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: NormalizationRejectionCode; readonly message: string };

export function validateRawSourceRecord(record: RawSourceRecord): ValidationResult {
  if (!record.providerId?.trim()) {
    return { ok: false, code: 'MISSING_PROVIDER_ID', message: 'providerId is required' };
  }
  if (!record.sourceRecordId?.trim()) {
    return { ok: false, code: 'MISSING_SOURCE_ID', message: 'sourceRecordId is required' };
  }
  if (!record.metric?.trim()) {
    return {
      ok: false,
      code: UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH ? 'UNLABELED_NUMERIC' : 'MISSING_METRIC',
      message: 'unlabeled numeric input is not economic truth',
    };
  }
  if (!record.unit?.trim()) {
    return {
      ok: false,
      code: 'MISSING_UNIT',
      message: 'unit is required — do not guess units',
    };
  }
  if (typeof record.value !== 'bigint') {
    return { ok: false, code: 'FLOAT_FORBIDDEN', message: 'value must be bigint' };
  }
  if (!isEconomicDomain(record.economicDomain)) {
    return { ok: false, code: 'SCHEMA_VERSION_UNSUPPORTED', message: 'invalid economic domain' };
  }
  if (!record.receivedAt?.trim()) {
    return { ok: false, code: 'MISSING_TIME_CONTEXT', message: 'receivedAt is required' };
  }

  const version = parseSchemaVersion(record.providerSchemaVersion);
  if (version === null || !isSupportedSchemaVersion(record.providerSchemaId, version)) {
    return {
      ok: false,
      code: 'SCHEMA_VERSION_UNSUPPORTED',
      message: `unsupported schema ${record.providerSchemaId}@${record.providerSchemaVersion}`,
    };
  }

  if (refuseDimensionalMix(record.unit, record.unit) === false) {
    // self-check passes; cross-unit checks happen at normalization
  }

  return { ok: true };
}

export function validateEnvelope(
  envelope: EconomicObservationEnvelope,
  context: ValidationContext = {},
): ValidationResult {
  if (envelope.schemaVersion !== 'sunrey.economic-observation-envelope.v1') {
    return { ok: false, code: 'SCHEMA_VERSION_UNSUPPORTED', message: 'unsupported envelope schema' };
  }
  if (!envelope.metric?.trim()) {
    return { ok: false, code: 'UNLABELED_NUMERIC', message: 'metric is required' };
  }
  if (!envelope.normalizedValue?.unit) {
    return { ok: false, code: 'MISSING_UNIT', message: 'normalized unit is required' };
  }
  if (envelope.verifiedFact !== false) {
    return { ok: false, code: 'SCHEMA_VERSION_UNSUPPORTED', message: 'observations cannot be verified facts' };
  }
  if (context.requireEntityId && !envelope.canonicalEntityId && !envelope.subjectOrResourceId) {
    return { ok: false, code: 'ENTITY_AMBIGUOUS', message: 'entity or resource reference is ambiguous' };
  }
  if (context.seenFingerprints?.has(envelope.duplicateFingerprint)) {
    return { ok: false, code: 'DUPLICATE_FINGERPRINT', message: 'duplicate observation fingerprint' };
  }
  return { ok: true };
}

export function assertNotVerifiedFact(envelope: EconomicObservationEnvelope): void {
  if (envelope.verifiedFact !== false) {
    throw new Error('EconomicObservationEnvelope cannot be a VerifiedEconomicFact');
  }
}
