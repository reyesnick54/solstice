/**
 * Build and validate ExternalObservation envelopes.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { assertValidConfidence, buildConfidence } from './confidence.ts';
import {
  assessFreshness,
  expiresAtFromPolicy,
  staleAfterFromPolicy,
  type FreshnessPolicy,
} from './freshness.ts';
import { buildObservationSource, buildProvenance } from './provenance.ts';
import {
  AUTHORITY_CLASSES,
  EXTERNAL_OBSERVATION_SCHEMA,
  NORMALIZATION_SCHEMA_VERSION,
  PROVIDER_CATEGORIES,
  type AuthorityClass,
  type CommercialUseStatus,
  type ExternalObservation,
  type ObservationLicensing,
  type ProviderCategory,
  type ProviderResult,
  type RedistributionStatus,
  type ValidationStatus,
} from './types.ts';

export type BuildExternalObservationInput<T> = {
  readonly observationId?: string;
  readonly providerId: string;
  readonly providerCategory: ProviderCategory;
  readonly capability: string;
  readonly data: T;
  readonly source: {
    readonly provider: string;
    readonly dataset: string;
    readonly sourceUrl?: string | null;
  };
  readonly time: {
    readonly retrievedAt: UtcInstant;
    readonly sourceTimestamp?: UtcInstant | null;
    readonly effectiveAt?: UtcInstant | null;
    readonly expiresAt?: UtcInstant | null;
    readonly staleAfter?: UtcInstant | null;
  };
  readonly authorityClass: AuthorityClass;
  readonly provenance: {
    readonly requestId?: string | null;
    readonly rawPayload: string | Buffer;
    readonly providerSchemaVersion: string;
    readonly normalizationVersion?: string;
    readonly canonicalModelVersion?: string | null;
  };
  readonly licensing?: Partial<ObservationLicensing>;
  readonly freshnessPolicy?: FreshnessPolicy;
  readonly validationStatus?: ValidationStatus;
  readonly corroborationCount?: number;
  readonly providerTrustScore?: number | null;
};

export function buildExternalObservation<T>(
  input: BuildExternalObservationInput<T>,
): ProviderResult<ExternalObservation<T>> {
  const providerId = input.providerId.trim();
  if (providerId.length === 0) {
    return { ok: false, code: 'PROVIDER_ID_REQUIRED', message: 'providerId is required' };
  }
  if (!(PROVIDER_CATEGORIES as readonly string[]).includes(input.providerCategory)) {
    return { ok: false, code: 'PROVIDER_CATEGORY_INVALID', message: 'invalid providerCategory' };
  }
  if (!(AUTHORITY_CLASSES as readonly string[]).includes(input.authorityClass)) {
    return { ok: false, code: 'AUTHORITY_CLASS_INVALID', message: 'invalid authorityClass' };
  }

  const referenceTimestamp = input.time.sourceTimestamp ?? input.time.effectiveAt ?? null;
  let referenceForPolicy: UtcInstant | null = null;
  if (referenceTimestamp) {
    try {
      referenceForPolicy = asUtcInstant(referenceTimestamp);
    } catch {
      return { ok: false, code: 'TIMESTAMP_INVALID', message: 'sourceTimestamp or effectiveAt is invalid' };
    }
  }
  try {
    asUtcInstant(input.time.retrievedAt);
  } catch {
    return { ok: false, code: 'TIMESTAMP_INVALID', message: 'retrievedAt is invalid' };
  }

  const freshness = assessFreshness({
    referenceTimestamp: referenceForPolicy,
    nowUtc: input.time.retrievedAt,
    ...(input.freshnessPolicy !== undefined ? { policy: input.freshnessPolicy } : {}),
  });
  const validationStatus = input.validationStatus ?? 'valid';

  const staleAfter =
    input.time.staleAfter ??
    (referenceForPolicy && input.freshnessPolicy
      ? staleAfterFromPolicy(referenceForPolicy, input.freshnessPolicy)
      : null);
  const expiresAt =
    input.time.expiresAt ??
    (referenceForPolicy && input.freshnessPolicy
      ? expiresAtFromPolicy(referenceForPolicy, input.freshnessPolicy)
      : null);

  const confidence = buildConfidence({
    authorityClass: input.authorityClass,
    freshnessStatus: freshness.status,
    validationStatus,
    ...(input.corroborationCount !== undefined ? { corroborationCount: input.corroborationCount } : {}),
    ...(input.providerTrustScore !== undefined ? { providerTrustScore: input.providerTrustScore } : {}),
  });
  try {
    assertValidConfidence(confidence);
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIDENCE_INVALID',
      message: error instanceof Error ? error.message : 'invalid confidence',
    };
  }

  const observation = Object.freeze({
    observationId: input.observationId ?? randomUUID(),
    providerId,
    providerCategory: input.providerCategory,
    capability: input.capability,
    data: input.data,
    source: buildObservationSource(input.source),
    time: Object.freeze({
      retrievedAt: input.time.retrievedAt,
      sourceTimestamp: input.time.sourceTimestamp ?? null,
      effectiveAt: input.time.effectiveAt ?? null,
      expiresAt,
      staleAfter,
    }),
    quality: Object.freeze({
      confidence,
      freshnessStatus: freshness.status,
      validationStatus,
    }),
    authority: Object.freeze({ authorityClass: input.authorityClass }),
    provenance: buildProvenance({
      ...(input.provenance.requestId !== undefined ? { requestId: input.provenance.requestId } : {}),
      rawPayload: input.provenance.rawPayload,
      providerSchemaVersion: input.provenance.providerSchemaVersion,
      normalizationVersion:
        input.provenance.normalizationVersion ?? `sunrey.external-normalization.v${NORMALIZATION_SCHEMA_VERSION}`,
      ...(input.provenance.canonicalModelVersion !== undefined
        ? { canonicalModelVersion: input.provenance.canonicalModelVersion }
        : {}),
    }),
    licensing: Object.freeze({
      commercialUseStatus: input.licensing?.commercialUseStatus ?? 'unknown',
      redistributionStatus: input.licensing?.redistributionStatus ?? 'unknown',
    }),
    schemaVersion: EXTERNAL_OBSERVATION_SCHEMA,
  });

  return { ok: true, value: observation as ExternalObservation<T> };
}

export function validateExternalObservation<T>(
  observation: ExternalObservation<T>,
): ProviderResult<ExternalObservation<T>> {
  if (!observation.providerId || observation.providerId.trim().length === 0) {
    return { ok: false, code: 'PROVIDER_ID_REQUIRED', message: 'providerId is required' };
  }
  if (!(AUTHORITY_CLASSES as readonly string[]).includes(observation.authority.authorityClass)) {
    return { ok: false, code: 'AUTHORITY_CLASS_INVALID', message: 'invalid authorityClass' };
  }
  if (observation.schemaVersion !== EXTERNAL_OBSERVATION_SCHEMA) {
    return { ok: false, code: 'SCHEMA_VERSION_INVALID', message: 'unsupported schemaVersion' };
  }
  try {
    asUtcInstant(observation.time.retrievedAt);
  } catch {
    return { ok: false, code: 'TIMESTAMP_INVALID', message: 'retrievedAt is invalid' };
  }
  if (observation.time.sourceTimestamp) {
    try {
      asUtcInstant(observation.time.sourceTimestamp);
    } catch {
      return { ok: false, code: 'TIMESTAMP_INVALID', message: 'sourceTimestamp is invalid' };
    }
  }
  try {
    assertValidConfidence(observation.quality.confidence);
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIDENCE_INVALID',
      message: error instanceof Error ? error.message : 'invalid confidence',
    };
  }
  if (!observation.provenance.rawPayloadHash || observation.provenance.rawPayloadHash.length !== 64) {
    return { ok: false, code: 'PROVENANCE_INVALID', message: 'rawPayloadHash must be sha256 hex' };
  }
  return { ok: true, value: observation };
}
