import { decideCase, type CaseDecisionResult, type ComplianceCase } from '../cases.ts';
import type { HumanDecisionKind } from '../types.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';

export function attemptComplianceHumanReview(input: {
  readonly case: ComplianceCase;
  readonly actorKind: 'HUMAN_OPERATOR' | 'AI' | 'S3M' | 'GROK' | 'AGENT';
  readonly role?: 'COUNSEL_REVIEWER' | 'SECURITY_REVIEWER' | 'OPERATIONS_REVIEWER' | 'COMMERCIAL_REVIEWER';
  readonly decision: HumanDecisionKind;
  readonly now: UtcInstant;
}): CaseDecisionResult | { readonly ok: false; readonly reasonCode: 'AI_CANNOT_SATISFY_HUMAN_REVIEW' } {
  if (input.actorKind !== 'HUMAN_OPERATOR') {
    return { ok: false, reasonCode: 'AI_CANNOT_SATISFY_HUMAN_REVIEW' };
  }
  return decideCase(input.case, {
    decision: input.decision,
    operatorRef: 'human-reviewer-fixture',
    actorKind: 'HUMAN_OPERATOR',
    reason: 'human review of mapped provider evidence',
    evidenceRefs: Object.freeze(['cmp-review:fixture']),
    decidedAt: input.now,
  });
}

export function s3mMayApproveCompliance(): false {
  return false;
}

export function grokMayApproveCompliance(): false {
  return false;
}

export function aiMayApproveCompliance(): false {
  return false;
}

export function markComplianceExternalEvidencePresent(input: {
  readonly serviceContractRef: string | null;
  readonly dataProcessingAgreementRef: string | null;
  readonly securityReviewRef: string | null;
  readonly jurisdictionReviewRef: string | null;
  readonly licenseRegistrationRef: string | null;
  readonly slaContinuityRef: string | null;
  readonly humanAcceptanceRef: string | null;
}): { readonly present: false } | { readonly present: true; readonly refsComplete: true } {
  const refs = [
    input.serviceContractRef,
    input.dataProcessingAgreementRef,
    input.securityReviewRef,
    input.jurisdictionReviewRef,
    input.licenseRegistrationRef,
    input.slaContinuityRef,
    input.humanAcceptanceRef,
  ];
  if (refs.some((ref) => ref === null || ref.length === 0)) {
    return { present: false };
  }
  return { present: true, refsComplete: true };
}
