import { sha256Hex } from '../../../../security/src/hash.ts';
import { toUnavailable, type ProviderScreenResponse, type ScreeningRequest } from '../ports.ts';
import type { AdverseMediaReference } from '../result.ts';
import type { ScreeningOutcome } from '../types.ts';
import type { ComplianceScoreInterpretation, RawComplianceVendorResponse } from './types.ts';

export function normalizeComplianceVendorResponse(
  raw: RawComplianceVendorResponse,
  request: ScreeningRequest,
  providerId: string,
): ProviderScreenResponse {
  if (isUnavailableScenario(raw.scenario)) {
    return toUnavailable(providerId, request.now);
  }
  if (raw.scenario === 'invalid_clear' || raw.scenario === 'schema_error') {
    return failClosed(providerId, request, 'SCHEMA_INVALID');
  }
  if (raw.scenario === 'score_overflow' || raw.scenario === 'confidence_float') {
    return failClosed(providerId, request, 'PROVIDER_SCORE_INVALID');
  }
  if (raw.scenario === 'unknown') {
    return failClosed(providerId, request, 'UNKNOWN_RESULT');
  }
  const outcome = outcomeFor(raw);
  const interpretation = interpretProviderScore(raw.vendorScore, raw.vendorConfidence);
  const hash = sha256Hex(
    JSON.stringify({
      providerId,
      subjectRef: request.subjectRef,
      outcome,
      at: request.now,
    }),
  );
  return Object.freeze({
    available: true,
    outcome,
    reasonCodes: Object.freeze(reasonCodesFor(raw, outcome)),
    providerRef: `${providerId}:${request.subjectRef}`,
    providerModel: 'fixture-compliance-v1',
    providerHash: hash,
    confidence: interpretation.confidence,
    score: interpretation.score,
    evidenceRefs: Object.freeze([`cmp-ev:${providerId}:${hash.slice(0, 16)}`]),
  });
}

export function interpretProviderScore(
  score: number | string | undefined,
  confidence: number | string | undefined,
): ComplianceScoreInterpretation {
  const numericScore = typeof score === 'number' && Number.isFinite(score) && score <= 10_000 ? score : null;
  const numericConfidence =
    typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
      ? confidence
      : null;
  return Object.freeze({
    score: numericScore,
    confidence: numericConfidence,
    isKernelDecision: false,
    isCreditScore: false,
    isHumanWorth: false,
    isPeve: false,
    isSunReyValuation: false,
  });
}

export function providerScoreIsNotKernelDecision(): false {
  return false;
}

export function providerScoreIsNotPeve(): false {
  return false;
}

export function providerScoreIsNotHumanWorth(): false {
  return false;
}

export function providerScoreIsNotSunReyValuation(): false {
  return false;
}

function isUnavailableScenario(scenario: RawComplianceVendorResponse['scenario']): boolean {
  return (
    scenario === 'unavailable' ||
    scenario === 'timeout' ||
    scenario === 'auth_failure'
  );
}

function outcomeFor(raw: RawComplianceVendorResponse): ScreeningOutcome {
  if (raw.scenario === 'confirmed_match') return 'BLOCK';
  if (raw.scenario === 'potential_match' || raw.scenario === 'manual_review') return 'REVIEW';
  if (raw.scenario === 'clear' || raw.scenario === 'ok') return 'CLEAR';
  return 'UNAVAILABLE';
}

function reasonCodesFor(raw: RawComplianceVendorResponse, outcome: ScreeningOutcome): readonly string[] {
  if (outcome === 'BLOCK') return ['VENDOR_CONFIRMED_MATCH', raw.matchRef ?? 'MATCH_REF_ABSENT'];
  if (outcome === 'REVIEW') return ['POTENTIAL_MATCH', 'MANUAL_REVIEW_INDICATED'];
  if (outcome === 'CLEAR') return ['VENDOR_CLEAR'];
  return ['PROVIDER_UNAVAILABLE'];
}

function failClosed(
  providerId: string,
  request: ScreeningRequest,
  reason: string,
): ProviderScreenResponse {
  return Object.freeze({
    available: false,
    outcome: 'UNAVAILABLE',
    reasonCodes: Object.freeze([reason, 'FAIL_CLOSED']),
    providerRef: providerId,
    providerModel: null,
    providerHash: `unavailable:${providerId}:${request.now}`,
    confidence: null,
    score: null,
    evidenceRefs: Object.freeze([]),
  });
}

export function safeAdverseMediaReferences(
  request: ScreeningRequest,
  hit: boolean,
): readonly AdverseMediaReference[] {
  if (!hit) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      category: 'SANCTIONS_ADJACENT_MEDIA',
      providerResultId: `am:${request.subjectRef}`,
      riskClassification: 'ELEVATED',
      observedAt: request.now,
      reviewRequired: true,
      contentHash: sha256Hex(`am-ref:${request.subjectRef}`),
    }),
  ]);
}
