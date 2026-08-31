/**
 * Explainable trust reason codes — machine-readable with operator descriptions.
 */

export const TRUST_REASON_CODES = [
  'OFFICIAL_SOURCE_SELECTED',
  'MULTI_SOURCE_CORROBORATION',
  'SINGLE_AUTHORITATIVE_SOURCE',
  'SOURCE_STALE',
  'SOURCE_AGING',
  'SOURCE_EXPIRED',
  'SOURCE_UNHEALTHY',
  'SOURCE_QUARANTINED',
  'SOURCE_DEGRADED',
  'VALUE_OUTLIER',
  'TIME_MISMATCH',
  'UNIT_MISMATCH',
  'SEMANTIC_MISMATCH',
  'INSUFFICIENT_SOURCES',
  'PROVIDER_CONFLICT',
  'CHAIN_STATE_CONFLICT',
  'FORECAST_NOT_CONSOLIDATED',
  'COMPLIANCE_EVIDENCE_INDEPENDENT',
  'RESEARCH_QUALITY_METADATA_ONLY',
  'AUTHORITY_OVERRIDE',
  'MIRRORED_SOURCE_DEDUPED',
  'ALL_SOURCES_STALE',
  'CONFIDENCE_BELOW_THRESHOLD',
  'NO_ELIGIBLE_OBSERVATIONS',
] as const;

export type TrustReasonCode = (typeof TRUST_REASON_CODES)[number];

export type TrustReason = {
  readonly code: TrustReasonCode;
  readonly description: string;
  readonly observationIds?: readonly string[];
};

const DESCRIPTIONS: Readonly<Record<TrustReasonCode, string>> = Object.freeze({
  OFFICIAL_SOURCE_SELECTED: 'Official or authoritative source selected per policy precedence.',
  MULTI_SOURCE_CORROBORATION: 'Multiple independent sources support the canonical value.',
  SINGLE_AUTHORITATIVE_SOURCE: 'Single authoritative source accepted under policy.',
  SOURCE_STALE: 'Observation freshness is stale; weight reduced or excluded.',
  SOURCE_AGING: 'Observation freshness is aging; weight reduced.',
  SOURCE_EXPIRED: 'Observation freshness is expired; excluded from consensus.',
  SOURCE_UNHEALTHY: 'Provider health is unhealthy; observation excluded or reduced.',
  SOURCE_QUARANTINED: 'Provider is quarantined; observation excluded from new canonical values.',
  SOURCE_DEGRADED: 'Provider risk state is degraded; trust weight reduced.',
  VALUE_OUTLIER: 'Observation value is an outlier relative to peer observations.',
  TIME_MISMATCH: 'Observation time window does not align with policy requirements.',
  UNIT_MISMATCH: 'Observation unit is incompatible with canonical consensus.',
  SEMANTIC_MISMATCH: 'Observation semantic identity does not match the requested metric.',
  INSUFFICIENT_SOURCES: 'Eligible corroborating sources below policy minimum.',
  PROVIDER_CONFLICT: 'Material disagreement among eligible sources.',
  CHAIN_STATE_CONFLICT: 'Blockchain state observations materially disagree.',
  FORECAST_NOT_CONSOLIDATED: 'Forecast observations retained separately; not averaged.',
  COMPLIANCE_EVIDENCE_INDEPENDENT: 'Compliance evidence records remain independently reviewable.',
  RESEARCH_QUALITY_METADATA_ONLY: 'Research trust provides evidence-quality metadata only.',
  AUTHORITY_OVERRIDE: 'Higher-authority source overrides lower-authority aggregators.',
  MIRRORED_SOURCE_DEDUPED: 'Mirrored or copied upstream source counted once for independence.',
  ALL_SOURCES_STALE: 'Only stale sources available; canonical result marked stale.',
  CONFIDENCE_BELOW_THRESHOLD: 'Computed confidence below policy minimum.',
  NO_ELIGIBLE_OBSERVATIONS: 'No observations passed eligibility filters.',
});

export function trustReason(code: TrustReasonCode, observationIds?: readonly string[]): TrustReason {
  return Object.freeze({
    code,
    description: DESCRIPTIONS[code],
    ...(observationIds && observationIds.length > 0 ? { observationIds: Object.freeze([...observationIds]) } : {}),
  });
}
