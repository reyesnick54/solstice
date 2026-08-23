/**
 * Provider / oracle ingestion.
 *
 * external provider → authentication/signature → schema validation →
 * provenance → normalization → quality → observation registry.
 *
 * A configured provider is not automatically trusted.
 */

import { assessFreshness, DEFAULT_FRESHNESS_POLICY } from './freshness.ts';
import { normalizeEconomyQuantity } from './units.ts';
import { verifyObservation } from './verification.ts';
import type {
  EconomicObservation,
  EconomyResult,
  ObservationDraft,
  ProductiveResourceRecord,
} from './types.ts';

export type IngestionContext = {
  readonly nowUtc: string;
  readonly resource: ProductiveResourceRecord;
  readonly peerValues?: readonly bigint[];
  readonly independentSourceCount?: number;
};

export function ingestObservation(
  draft: ObservationDraft,
  context: IngestionContext,
): EconomyResult<EconomicObservation> {
  if (draft.category !== context.resource.category) {
    return { ok: false, code: 'CATEGORY_NOT_APPROVED', message: 'draft category does not match resource' };
  }
  if (draft.resourceId !== context.resource.resourceId) {
    return { ok: false, code: 'RESOURCE_UNKNOWN', message: 'resource is not registered for this observation' };
  }
  if (!draft.metric || draft.metric.trim().length === 0) {
    return { ok: false, code: 'UNLABELED_NUMERIC', message: 'unlabeled numeric input is not economic truth' };
  }
  if (draft.value === undefined || typeof draft.value !== 'bigint') {
    return { ok: false, code: 'UNLABELED_NUMERIC', message: 'missing integer value' };
  }
  if (!draft.unit) {
    return { ok: false, code: 'MISSING_UNIT', message: 'unit is required' };
  }
  if (!draft.source || draft.source.trim().length === 0) {
    return { ok: false, code: 'MISSING_SOURCE', message: 'source is required' };
  }
  if (!draft.evidenceRef) {
    return { ok: false, code: 'MISSING_PROVENANCE', message: 'provenance evidence is required' };
  }
  if (!draft.signatureValid) {
    return { ok: false, code: 'INVALID_SIGNATURE', message: 'provider signature failed' };
  }

  const normalized = normalizeEconomyQuantity({
    category: draft.category,
    unit: draft.unit,
    value: draft.value,
  });
  if (!normalized.ok) {
    return { ok: false, code: normalized.code, message: normalized.message };
  }

  const freshness = assessFreshness({
    timestampUtc: draft.timestampUtc,
    nowUtc: context.nowUtc,
    policy: DEFAULT_FRESHNESS_POLICY,
  });
  const verification = verifyObservation({
    signatureValid: draft.signatureValid,
    provenancePresent: true,
    freshnessState: freshness.state,
    independentSourceCount: context.independentSourceCount ?? 1,
    values: context.peerValues ?? [normalized.value.canonicalValue],
    subjectValue: normalized.value.canonicalValue,
  });

  const observation: EconomicObservation = Object.freeze({
    schema: 'sunrey.productive.economy-data.v1',
    observationId: draft.observationId,
    category: draft.category,
    resourceId: draft.resourceId,
    metric: draft.metric,
    value: draft.value,
    unit: draft.unit,
    canonicalUnit: normalized.value.canonicalUnit,
    canonicalValue: normalized.value.canonicalValue,
    timestampUtc: draft.timestampUtc,
    source: draft.source,
    provider: draft.provider,
    provenance: Object.freeze({
      sourceId: draft.source,
      providerId: draft.provider,
      sourceClass: draft.sourceClass,
      method: draft.method ?? 'SANDBOX_FIXTURE',
      evidenceRef: draft.evidenceRef,
      collectedAtUtc: context.nowUtc,
      license: draft.license,
      signatureValid: draft.signatureValid,
      configuredDoesNotImplyTrusted: true,
    }),
    verification: verification.status,
    confidenceBps: verification.status === 'MULTI_SOURCE_CORROBORATED' ? 9_000n : verification.status === 'SINGLE_SOURCE_VERIFIED' ? 7_000n : 0n,
    freshness,
    license: draft.license,
    integrity: draft.signatureValid ? 'INTACT' : 'INVALID_SIGNATURE',
    status: verification.status === 'INVALID' ? 'REJECTED' : 'VERIFIED',
    simulation: true,
    mintsMoonRey: false,
    setsMarketPrice: false,
    unlabeled: false,
  });
  return { ok: true, value: observation };
}
