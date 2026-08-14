import { randomUUID } from 'node:crypto';

import { addMs } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ComplianceProviderPorts, ProviderScreenResponse, ScreeningRequest } from './ports.ts';
import { assertNormalizedResult } from './ports.ts';
import { assertScreeningDated, isStale, type ScreeningResult } from './result.ts';
import type { ComplianceStore } from './store.ts';
import type { ScreeningRequirement, ScreeningRequirements, ScreeningType, SubjectKind } from './types.ts';
import { DEFAULT_SIMULATION_SCREENING_REQUIREMENTS } from './types.ts';

export type PerformScreeningInput = {
  readonly type: ScreeningType;
  readonly subjectKind: SubjectKind;
  readonly subjectRef: string;
  readonly jurisdiction: string;
  readonly now: UtcInstant;
  readonly policyVersionId?: string;
  readonly forceRefresh?: boolean;
  readonly requirements?: ScreeningRequirements;
};

function requirementOf(
  type: ScreeningType,
  requirements: ScreeningRequirements,
): ScreeningRequirement {
  switch (type) {
    case 'SANCTIONS':
      return requirements.sanctions;
    case 'PEP':
      return requirements.pep;
    case 'ADVERSE_MEDIA':
      return requirements.adverseMedia;
    case 'TRANSACTION_MONITORING':
      return requirements.transactionMonitoring;
    case 'FRAUD':
      return requirements.fraud;
    case 'DEVICE_RISK':
      return requirements.deviceRisk;
  }
}

function callProvider(
  ports: ComplianceProviderPorts,
  type: ScreeningType,
  request: ScreeningRequest,
): ProviderScreenResponse {
  switch (type) {
    case 'SANCTIONS':
      return ports.sanctions.screen(request);
    case 'PEP':
      return ports.pep.screen(request);
    case 'ADVERSE_MEDIA':
      return ports.adverseMedia.screen(request);
    case 'TRANSACTION_MONITORING':
      return ports.transactionMonitoring.evaluate(request);
    case 'FRAUD':
      return ports.fraud.evaluate(request);
    case 'DEVICE_RISK':
      return ports.deviceRisk.screen(request);
  }
}

export function performScreening(
  store: ComplianceStore,
  ports: ComplianceProviderPorts,
  input: PerformScreeningInput,
): ScreeningResult {
  const requirements = input.requirements ?? DEFAULT_SIMULATION_SCREENING_REQUIREMENTS;
  const rule = requirementOf(input.type, requirements);
  const existing = store.latestScreening(input.subjectRef, input.type);
  if (existing && !input.forceRefresh && !isStale(existing, input.now)) {
    return existing;
  }
  const request: ScreeningRequest = {
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    jurisdiction: input.jurisdiction,
    now: input.now,
  };
  const raw = callProvider(ports, input.type, request);
  store.markProvider(
    raw.providerRef.split(':')[0] ?? input.type,
    raw.available,
    input.now,
    raw.available ? undefined : 'PROVIDER_UNAVAILABLE',
  );
  const outcome = raw.available ? raw.outcome : 'UNAVAILABLE';
  if (!raw.available && outcome === 'CLEAR') {
    throw new Error('provider unavailable must not be rewritten to CLEAR');
  }
  const result: ScreeningResult = Object.freeze({
    screeningId: randomUUID(),
    screeningType: input.type,
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    providerRef: raw.providerRef,
    providerModel: raw.providerModel,
    outcome,
    reasonCodes: Object.freeze([...raw.reasonCodes]),
    confidence: raw.confidence,
    score: raw.score,
    jurisdiction: input.jurisdiction,
    screenedAt: input.now,
    refreshBy: addMs(input.now, rule.maxAgeHours * 60 * 60 * 1000),
    evidenceRefs: Object.freeze([...raw.evidenceRefs]),
    providerHash: raw.providerHash,
    policyVersionId: input.policyVersionId ?? null,
  });
  assertScreeningDated(result);
  assertNormalizedResult(result);
  store.screenings.set(result.screeningId, result);
  if (input.type === 'ADVERSE_MEDIA' && 'references' in raw) {
    const refs = (raw as { references?: readonly import('./result.ts').AdverseMediaReference[] }).references ?? [];
    store.adverseMedia.push(...refs);
  }
  return result;
}

export function rejectIfStale(result: ScreeningResult, now: UtcInstant): ScreeningResult {
  if (isStale(result, now)) {
    return Object.freeze({
      ...result,
      outcome: result.outcome === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'HOLD',
      reasonCodes: Object.freeze([...result.reasonCodes, 'SCREENING_STALE']),
    });
  }
  return result;
}
