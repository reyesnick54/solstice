import type { HumanReviewerRole, ReviewActorKind } from './types.ts';
import { HUMAN_REVIEWER_ROLES } from './types.ts';

export type HumanReviewAttempt =
  | { readonly ok: true; readonly role: HumanReviewerRole; readonly actorKind: 'HUMAN_OPERATOR' }
  | {
      readonly ok: false;
      readonly reasonCode: 'AI_CANNOT_SATISFY_HUMAN_REVIEW' | 'UNKNOWN_REVIEWER_ROLE';
      readonly actorKind: ReviewActorKind;
    };

export function attemptIdentityHumanReview(input: {
  readonly actorKind: ReviewActorKind;
  readonly role: string;
}): HumanReviewAttempt {
  if (!HUMAN_REVIEWER_ROLES.includes(input.role as HumanReviewerRole)) {
    return { ok: false, reasonCode: 'UNKNOWN_REVIEWER_ROLE', actorKind: input.actorKind };
  }
  if (input.actorKind !== 'HUMAN_OPERATOR') {
    return { ok: false, reasonCode: 'AI_CANNOT_SATISFY_HUMAN_REVIEW', actorKind: input.actorKind };
  }
  return { ok: true, role: input.role as HumanReviewerRole, actorKind: 'HUMAN_OPERATOR' };
}

export function kycVerifiedOpensAccount(): false {
  return false;
}

export function kycVerifiedIssuesExecutionAuthority(): false {
  return false;
}

export function kycVerifiedEnablesPayments(): false {
  return false;
}

export function kycVerifiedEnablesTrading(): false {
  return false;
}

export function markIdentityExternalEvidencePresent(input: {
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
