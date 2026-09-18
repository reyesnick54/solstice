import { sha256Hex } from '../../../../security/src/hash.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import {
  CHANGE_STATE_TRANSITIONS,
  UNOFFICIAL_SOURCE_KINDS,
  type ChangeRequestState,
  type ActivationMode,
} from './taxonomy.ts';
import type {
  ApplicabilityAssessment,
  OfficialSourceReference,
  PolicyChangeTestResult,
  PolicyVersionRecord,
  RegulatoryChangeRequest,
  SupervisoryActor,
} from './types.ts';
import type { PolicyVersionRef, RegulatoryChangeRequestId } from './ids.ts';
import { policyVersionRefFor } from './ids.ts';
import { evaluatePolicyActivationApproval } from './authorization.ts';

export type ChangeGovernanceFailure = {
  readonly code:
    | 'INVALID_TRANSITION'
    | 'UNOFFICIAL_SOURCE'
    | 'APPLICABILITY_UNKNOWN'
    | 'TESTS_NOT_PASSED'
    | 'AI_ACTIVATION_FORBIDDEN'
    | 'UNAUTHORIZED_APPROVAL'
    | 'ALREADY_ACTIVATED'
    | 'POLICY_IMMUTABLE'
    | 'NOT_SCHEDULED';
  readonly message: string;
};

function canTransition(from: ChangeRequestState, to: ChangeRequestState): boolean {
  return CHANGE_STATE_TRANSITIONS[from].includes(to);
}

export function validateOfficialSource(source: OfficialSourceReference): Result<true, ChangeGovernanceFailure> {
  if ((UNOFFICIAL_SOURCE_KINDS as readonly string[]).includes(source.kind as string)) {
    return err({
      code: 'UNOFFICIAL_SOURCE',
      message: `source kind ${source.kind} is not an authoritative official source`,
    });
  }
  if (!source.evidenceRef || !source.citation) {
    return err({
      code: 'UNOFFICIAL_SOURCE',
      message: 'official source requires evidence reference and citation',
    });
  }
  return ok(true);
}

export function transitionChangeRequest(
  request: RegulatoryChangeRequest,
  toState: ChangeRequestState,
  now: UtcInstant,
  auditRef: string,
): Result<RegulatoryChangeRequest, ChangeGovernanceFailure> {
  if (!canTransition(request.state, toState)) {
    return err({
      code: 'INVALID_TRANSITION',
      message: `cannot transition from ${request.state} to ${toState}`,
    });
  }

  if (toState === 'REVIEW_REQUIRED' && request.applicability?.uncertainty === 'UNKNOWN') {
    // expected path
  }

  return ok(
    Object.freeze({
      ...request,
      state: toState,
      updatedAt: now,
      auditTrailRefs: Object.freeze([...request.auditTrailRefs, auditRef]),
    }),
  );
}

export function assessApplicability(
  input: Omit<ApplicabilityAssessment, 'reviewer'> & { readonly reviewer: SupervisoryActor | null },
): Result<ApplicabilityAssessment, ChangeGovernanceFailure> {
  if (input.uncertainty === 'UNKNOWN') {
    return ok(
      Object.freeze({
        ...input,
        effectiveDate: input.effectiveDate,
      }),
    );
  }
  if (input.jurisdictions.length === 0) {
    return err({
      code: 'APPLICABILITY_UNKNOWN',
      message: 'applicability requires at least one jurisdiction when uncertainty is resolved',
    });
  }
  return ok(Object.freeze({ ...input }));
}

export function proposePolicyVersion(input: {
  readonly packId: string;
  readonly versionNumber: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly previousVersionRef: PolicyVersionRef | null;
}): PolicyVersionRecord {
  const contentHash = sha256Hex(JSON.stringify(input.content));
  return Object.freeze({
    versionRef: policyVersionRefFor(input.packId, input.versionNumber),
    packId: input.packId,
    versionNumber: input.versionNumber,
    contentHash,
    previousVersionRef: input.previousVersionRef,
    immutable: true as const,
    activatedAt: null,
    retiredAt: null,
  });
}

export function recordTestResults(
  request: RegulatoryChangeRequest,
  results: readonly PolicyChangeTestResult[],
  now: UtcInstant,
  auditRef: string,
): Result<RegulatoryChangeRequest, ChangeGovernanceFailure> {
  const allPassed = results.every((r) => r.passed);
  const nextState: ChangeRequestState = allPassed ? 'TESTS_PASSED' : 'TESTS_REQUIRED';
  if (!allPassed) {
    return ok(
      Object.freeze({
        ...request,
        testResults: Object.freeze([...results]),
        state: 'TESTS_REQUIRED',
        updatedAt: now,
        auditTrailRefs: Object.freeze([...request.auditTrailRefs, auditRef]),
      }),
    );
  }
  const transition = transitionChangeRequest(
    Object.freeze({ ...request, testResults: Object.freeze([...results]) }),
    nextState,
    now,
    auditRef,
  );
  return transition;
}

export function schedulePolicyActivation(
  request: RegulatoryChangeRequest,
  mode: ActivationMode,
  effectiveAt: UtcInstant | null,
  now: UtcInstant,
  auditRef: string,
): Result<RegulatoryChangeRequest, ChangeGovernanceFailure> {
  if (request.state !== 'APPROVAL_REQUIRED' && request.state !== 'TESTS_PASSED') {
    const fromApproval = transitionChangeRequest(request, 'APPROVAL_REQUIRED', now, auditRef);
    if (!fromApproval.ok) return fromApproval;
    request = fromApproval.value;
  }

  if (mode === 'SCHEDULED_EFFECTIVE_DATE' && !effectiveAt) {
    return err({
      code: 'NOT_SCHEDULED',
      message: 'SCHEDULED_EFFECTIVE_DATE requires effectiveAt',
    });
  }

  const toState: ChangeRequestState =
    mode === 'IMMEDIATE' ? 'ACTIVATED' : 'SCHEDULED';

  return transitionChangeRequest(
    Object.freeze({
      ...request,
      activationMode: mode,
      scheduledEffectiveAt: effectiveAt,
    }),
    toState,
    now,
    auditRef,
  );
}

export function activatePolicyVersion(input: {
  readonly request: RegulatoryChangeRequest;
  readonly approver: SupervisoryActor;
  readonly now: UtcInstant;
  readonly auditRef: string;
  readonly evidenceRef: string;
  readonly alreadyActivated: boolean;
}): Result<
  { readonly request: RegulatoryChangeRequest; readonly version: PolicyVersionRecord },
  ChangeGovernanceFailure
> {
  if (input.alreadyActivated) {
    return err({
      code: 'ALREADY_ACTIVATED',
      message: 'duplicate activation is not permitted',
    });
  }

  const auth = evaluatePolicyActivationApproval(input.approver);
  if (!auth.permitted) {
    return err({
      code: input.approver.actorKind === 'AI' ? 'AI_ACTIVATION_FORBIDDEN' : 'UNAUTHORIZED_APPROVAL',
      message: auth.reason,
    });
  }

  const testsPassed = input.request.testResults.length > 0 && input.request.testResults.every((t) => t.passed);
  if (!testsPassed) {
    return err({
      code: 'TESTS_NOT_PASSED',
      message: 'production activation blocked: required tests have not passed',
    });
  }

  if (input.request.state !== 'APPROVAL_REQUIRED' && input.request.state !== 'SCHEDULED') {
    return err({
      code: 'INVALID_TRANSITION',
      message: `activation requires APPROVAL_REQUIRED or SCHEDULED state, got ${input.request.state}`,
    });
  }

  if (!input.request.proposedPolicyVersion) {
    return err({
      code: 'INVALID_TRANSITION',
      message: 'no proposed policy version to activate',
    });
  }

  const version: PolicyVersionRecord = Object.freeze({
    ...input.request.proposedPolicyVersion,
    activatedAt: input.now,
    retiredAt: null,
  });

  const updatedRequest: RegulatoryChangeRequest = Object.freeze({
    ...input.request,
    state: 'ACTIVATED',
    activatedAt: input.now,
    updatedAt: input.now,
    approvals: Object.freeze([
      ...input.request.approvals,
      Object.freeze({
        approver: input.approver,
        approvedAt: input.now,
        evidenceRef: input.evidenceRef,
      }),
    ]),
    auditTrailRefs: Object.freeze([...input.request.auditTrailRefs, input.auditRef]),
  });

  return ok(Object.freeze({ request: updatedRequest, version }));
}

export function rollbackPolicyVersion(input: {
  readonly request: RegulatoryChangeRequest;
  readonly rollbackToVersion: PolicyVersionRecord;
  readonly now: UtcInstant;
  readonly auditRef: string;
  readonly approver: SupervisoryActor;
}): Result<
  { readonly request: RegulatoryChangeRequest; readonly reactivatedVersion: PolicyVersionRecord },
  ChangeGovernanceFailure
> {
  const auth = evaluatePolicyActivationApproval(input.approver);
  if (!auth.permitted) {
    return err({
      code: 'UNAUTHORIZED_APPROVAL',
      message: auth.reason,
    });
  }

  if (!input.request.proposedPolicyVersion) {
    return err({
      code: 'INVALID_TRANSITION',
      message: 'no active policy version to rollback from',
    });
  }

  const retiredVersion: PolicyVersionRecord = Object.freeze({
    ...input.request.proposedPolicyVersion,
    retiredAt: input.now,
  });

  const reactivated: PolicyVersionRecord = Object.freeze({
    ...input.rollbackToVersion,
    activatedAt: input.now,
    retiredAt: null,
  });

  const updatedRequest: RegulatoryChangeRequest = Object.freeze({
    ...input.request,
    state: 'ROLLBACK_REQUIRED',
    proposedPolicyVersion: reactivated,
    updatedAt: input.now,
    auditTrailRefs: Object.freeze([...input.request.auditTrailRefs, input.auditRef]),
  });

  return ok(
    Object.freeze({
      request: updatedRequest,
      reactivatedVersion: reactivated,
      retiredVersion,
    } as { readonly request: RegulatoryChangeRequest; readonly reactivatedVersion: PolicyVersionRecord }),
  );
}
