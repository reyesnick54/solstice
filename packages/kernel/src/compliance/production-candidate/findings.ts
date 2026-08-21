import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ScreeningOutcome } from '../types.ts';
import {
  matchStateToScreeningOutcome,
  type ComplianceFindingKind,
  type ComplianceFindingSeverity,
  type FraudRecommendedAction,
  type NormalizedComplianceFinding,
  type ProviderMatchState,
  type ScreeningSubject,
} from './types.ts';

export function createFinding(input: {
  readonly kind: ComplianceFindingKind;
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly providerId: string;
  readonly matchState?: ProviderMatchState | null;
  readonly severity: ComplianceFindingSeverity;
  readonly reasonCodes: readonly string[];
  readonly score?: number | null;
  readonly recommendedAction?: FraudRecommendedAction | null;
  readonly policyResult?: ScreeningOutcome | null;
  readonly caseId?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly now: UtcInstant;
}): NormalizedComplianceFinding {
  const matchState = input.matchState ?? null;
  const policyResult =
    input.policyResult ?? (matchState ? matchStateToScreeningOutcome(matchState) : null);
  return Object.freeze({
    findingId: `fnd_${randomUUID()}`,
    kind: input.kind,
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    providerId: input.providerId,
    providerRef: `${input.providerId}:${input.kind}:${input.subjectRef}`,
    matchState,
    severity: input.severity,
    reasonCodes: Object.freeze([...input.reasonCodes]),
    score: input.score ?? null,
    recommendedAction: input.recommendedAction ?? null,
    policyResult,
    caseId: input.caseId ?? null,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [`cmp-ev:${input.providerId}:${input.subjectRef}`])]),
    observedAt: input.now,
    isKernelDecision: false,
    isEligibilityDecision: false,
  });
}

export function findingRequiresHumanAction(finding: NormalizedComplianceFinding): boolean {
  if (finding.matchState === 'POSSIBLE_MATCH' || finding.matchState === 'CONFIRMED_MATCH') {
    return true;
  }
  if (finding.matchState === 'REQUIRES_REVIEW' || finding.matchState === 'UNAVAILABLE') {
    return true;
  }
  if (finding.policyResult === 'REVIEW' || finding.policyResult === 'HOLD' || finding.policyResult === 'BLOCK') {
    return true;
  }
  if (finding.recommendedAction === 'REVIEW' || finding.recommendedAction === 'HOLD' || finding.recommendedAction === 'BLOCK') {
    return true;
  }
  return finding.severity === 'HIGH' || finding.severity === 'CRITICAL';
}

export function findingEditsLedger(): false {
  return false;
}
