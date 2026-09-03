// @ts-nocheck
/**
 * Wave 4 — normalization pipeline.
 *
 * Provider-specific response → Connector → Raw Source Record →
 * Normalizer → EconomicObservationEnvelope → Provenance / Events
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { sha256Hex } from '../../../../security/src/hash.ts';
import {
  ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA,
  ECONOMIC_OBSERVATION_ENVELOPE_VERSION,
  NORMALIZATION_METHODOLOGY_VERSION,
  type EconomicObservationEnvelope,
  type LicenseKind,
  type NormalizationRejectionCode,
  type RightsScope,
} from './types.ts';
import type { RawSourceRecord } from './source.ts';
import {
  buildSourcePreservation,
  evidenceHashOf,
  provenanceRefOf,
} from './source.ts';
import { normalizeObservationTime } from './time.ts';
import { normalizeGeography } from './geography.ts';
import { canonicalizeQuantity } from './units.ts';
import { extensionForDomain } from './extensions.ts';
import { duplicateFingerprint } from './fingerprint.ts';
import { validateRawSourceRecord } from './validation.ts';
import {
  createQuarantineRegistry,
  quarantineRejected,
  type QuarantineRegistry,
} from './quarantine.ts';

export type NormalizationContext = {
  readonly envelopeId?: string;
  readonly nowUtc: string;
  readonly quarantine?: QuarantineRegistry;
  readonly seenFingerprints?: Set<string>;
};

export type NormalizationOutcome =
  | { readonly status: 'ACCEPTED'; readonly envelope: EconomicObservationEnvelope }
  | { readonly status: 'QUARANTINED'; readonly quarantineId: string; readonly code: string; readonly message: string };

export function normalizeRawSourceRecord(
  record: RawSourceRecord,
  context: NormalizationContext,
): NormalizationOutcome {
  const validation = validateRawSourceRecord(record);
  if (!validation.ok) {
    return reject(record, validation.code, validation.message, context);
  }

  const timeResult = normalizeObservationTime({
    observedAt: record.observedAt,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    receivedAt: record.receivedAt,
    aggregationHint: record.aggregationHint,
  });
  if (!timeResult.ok) {
    return reject(record, timeResult.code, timeResult.message, context);
  }

  const geoResult = normalizeGeography(record.geography ?? {}, {
    economicDomain: record.economicDomain,
  });
  if (!geoResult.ok) {
    return reject(record, geoResult.code, geoResult.message, context);
  }

  const unitResult = canonicalizeQuantity({
    economicDomain: record.economicDomain,
    metric: record.metric,
    value: record.value,
    unit: record.unit,
  });
  if (!unitResult.ok) {
    return reject(record, unitResult.code, unitResult.message, context);
  }
  if (!unitResult.canonicalValue) {
    return reject(record, 'UNIT_UNKNOWN', 'canonical value conversion failed', context);
  }

  const provenanceRef = provenanceRefOf(record);
  const provenanceHash = sha256Hex(['sunrey.economic-observation.provenance.v1', provenanceRef].join('|'));
  const normalizedDigest = sha256Hex(
    [
      unitResult.canonicalValue.mantissa.toString(),
      unitResult.canonicalUnit,
      record.metric,
    ].join('|'),
  );
  const evidenceHash = evidenceHashOf(record, normalizedDigest);

  const fingerprint = duplicateFingerprint({
    providerId: record.providerId,
    sourceRecordId: record.sourceRecordId,
    economicDomain: record.economicDomain,
    metric: record.metric,
    canonicalUnit: unitResult.canonicalUnit,
    canonicalValue: unitResult.canonicalValue.mantissa,
    subjectOrResourceId: record.subjectOrResourceId,
    time: timeResult.value,
    geography: geoResult.value,
  });

  if (context.seenFingerprints?.has(fingerprint)) {
    return reject(record, 'DUPLICATE_FINGERPRINT', 'duplicate observation fingerprint', context);
  }
  context.seenFingerprints?.add(fingerprint);

  const envelope: EconomicObservationEnvelope = Object.freeze({
    schemaVersion: ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA,
    envelopeVersion: ECONOMIC_OBSERVATION_ENVELOPE_VERSION,
    envelopeId: context.envelopeId ?? randomUUID(),

    providerId: record.providerId,
    sourceClass: record.sourceClass,
    source: buildSourcePreservation(record, provenanceRef),

    subjectOrResourceId: record.subjectOrResourceId,
    canonicalEntityId: record.canonicalEntityId ?? null,
    eventId: record.eventId ?? null,

    economicDomain: record.economicDomain,
    category: record.category,
    metric: record.metric,

    sourceValue: unitResult.value,
    normalizedValue: unitResult.canonicalValue,
    canonicalUnit: unitResult.canonicalUnit,

    time: timeResult.value,
    geography: geoResult.value,

    provenanceHash,
    evidenceHash,

    rights: Object.freeze({
      license: parseLicense(record.license),
      rightsScope: parseRightsScope(record.rightsScope),
      consentReference: record.consentReference ?? null,
      purposeReference: record.purposeReference ?? null,
    }),

    freshness: Object.freeze({
      state: 'FRESH',
      ageSeconds: 0n,
      maxAgeSeconds: null,
    }),

    confidence: Object.freeze({
      scoreBps: null,
      basis: Object.freeze(['schema_valid']),
    }),

    verificationStatus: 'UNVERIFIED',
    disputeStatus: 'NONE',

    duplicateFingerprint: fingerprint,
    lineageParentIds: Object.freeze(record.lineageParentIds ?? []),

    methodologyVersion: NORMALIZATION_METHODOLOGY_VERSION,
    extension: extensionForDomain(record.economicDomain, record.extensionFields ?? {}),

    simulation: true,
    environment: 'simulation',

    verifiedFact: false,
    mintsNativeAsset: false,
  });

  return { status: 'ACCEPTED', envelope };
}

export function normalizeBatch(
  records: readonly RawSourceRecord[],
  context: NormalizationContext,
): {
  readonly accepted: readonly EconomicObservationEnvelope[];
  readonly quarantined: readonly { readonly quarantineId: string; readonly code: string; readonly message: string }[];
} {
  const registry = context.quarantine ?? createQuarantineRegistry();
  const seen = context.seenFingerprints ?? new Set<string>();
  const accepted: EconomicObservationEnvelope[] = [];
  const quarantined: { quarantineId: string; code: string; message: string }[] = [];

  for (const record of records) {
    const outcome = normalizeRawSourceRecord(record, {
      ...context,
      quarantine: registry,
      seenFingerprints: seen,
    });
    if (outcome.status === 'ACCEPTED') {
      accepted.push(outcome.envelope);
    } else {
      quarantined.push({
        quarantineId: outcome.quarantineId,
        code: outcome.code,
        message: outcome.message,
      });
    }
  }

  return Object.freeze({
    accepted: Object.freeze(accepted),
    quarantined: Object.freeze(quarantined),
  });
}

function reject(
  record: RawSourceRecord,
  code: NormalizationRejectionCode,
  message: string,
  context: NormalizationContext,
): NormalizationOutcome {
  const quarantineId = randomUUID();
  const entry = quarantineRejected(record, code, message, asUtcInstant(context.nowUtc), quarantineId);
  context.quarantine?.quarantine(entry);
  return { status: 'QUARANTINED', quarantineId, code, message };
}

function parseLicense(raw: string | null | undefined): LicenseKind {
  const map: Record<string, LicenseKind> = {
    CC_BY: 'CC_BY',
    CC_BY_SA: 'CC_BY_SA',
    CC0: 'CC0',
    OPEN_GOVERNMENT: 'OPEN_GOVERNMENT',
    PROPRIETARY: 'PROPRIETARY',
    RESEARCH_ONLY: 'RESEARCH_ONLY',
    SANDBOX_FIXTURE: 'SANDBOX_FIXTURE',
  };
  return map[raw ?? ''] ?? 'UNKNOWN';
}

function parseRightsScope(raw: string | null | undefined): RightsScope {
  const map: Record<string, RightsScope> = {
    PUBLIC_DERIVED: 'PUBLIC_DERIVED',
    AGGREGATE_ONLY: 'AGGREGATE_ONLY',
    LICENSED_COMMERCIAL: 'LICENSED_COMMERCIAL',
    RESTRICTED_RESEARCH: 'RESTRICTED_RESEARCH',
    CONFIDENTIAL: 'CONFIDENTIAL',
    CONSENT_BOUND: 'CONSENT_BOUND',
  };
  return map[raw ?? ''] ?? 'PUBLIC_DERIVED';
}

export { createQuarantineRegistry };
