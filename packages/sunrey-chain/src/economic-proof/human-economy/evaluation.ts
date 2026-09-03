// @ts-nocheck
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  evaluateRightsFailClosed,
  rightsCommitmentDigestFor,
} from '../rights/evaluation.ts';
import { grantActiveAt } from '../rights/revocation.ts';
import { evaluateRevocationSemantics, findRevocationForTarget, wasRevokedBefore } from '../rights/revocation.ts';
import {
  consentCoversRecipient,
  consentCoversScope,
  humanEconomyPurposeAuthorization,
} from './consent.ts';
import { minimumNecessaryProofSufficient } from './contribution.ts';
import {
  agentCannotBecomeDatasetMonetization,
  isPurposeImpliedNotPermitted,
  researchCannotBecomeMonetary,
} from './purpose-controls.ts';
import type {
  HistoricalAuthorizationProof,
  HumanEconomyDenialCode,
  HumanEconomyEvaluationDeny,
  HumanEconomyEvaluationRequest,
  HumanEconomyEvaluationResult,
} from './types.ts';

function deny(
  reasonCode: HumanEconomyDenialCode,
  message: string,
): HumanEconomyEvaluationDeny {
  return Object.freeze({ decision: 'DENY', reasonCode, message });
}

export function evaluateHumanEconomyRights(
  request: HumanEconomyEvaluationRequest,
): HumanEconomyEvaluationResult {
  if (!request.humanConsent) {
    return deny('CONSENT_MISSING', 'Human economy action requires explicit consent');
  }

  const consent = request.humanConsent;

  if (consent.lifecycleState === 'REVOKED') {
    const revocation = findRevocationForTarget(
      request.revocations ?? [],
      consent.baseConsentGrant.consentGrantId,
    );
    if (revocation && wasRevokedBefore(revocation, request.at) && !request.historicalEvaluation) {
      return deny('CONSENT_REVOKED', 'Consent was revoked before the requested action');
    }
    if (!request.historicalEvaluation) {
      return deny('CONSENT_REVOKED', 'Consent lifecycle state is revoked');
    }
  }

  if (consent.lifecycleState === 'EXPIRED') {
    return deny('CONSENT_EXPIRED', 'Consent lifecycle state is expired');
  }

  if (!grantActiveAt(
    consent.baseConsentGrant.effectiveFrom,
    consent.baseConsentGrant.effectiveUntil,
    request.at,
  )) {
    return deny('CONSENT_EXPIRED', 'Consent is not effective at the requested time');
  }

  if (consent.purposeCode !== request.authorizedPurpose) {
    return deny('PURPOSE_NOT_AUTHORIZED', 'Consent purpose does not match authorized purpose');
  }

  if (request.requestedPurpose !== request.authorizedPurpose) {
    if (isPurposeImpliedNotPermitted(request.authorizedPurpose, request.requestedPurpose)) {
      return deny(
        'PURPOSE_IMPLIED_NOT_PERMITTED',
        `Authorization for ${request.authorizedPurpose} does not imply ${request.requestedPurpose}`,
      );
    }
    return deny('PURPOSE_NOT_AUTHORIZED', 'Requested purpose does not match authorized purpose');
  }

  if (researchCannotBecomeMonetary(request.authorizedPurpose, request.requestedPurpose)) {
    return deny(
      'PURPOSE_IMPLIED_NOT_PERMITTED',
      'Research permission cannot automatically become monetary permission',
    );
  }

  if (agentCannotBecomeDatasetMonetization(request.authorizedPurpose, request.requestedPurpose)) {
    return deny(
      'PURPOSE_IMPLIED_NOT_PERMITTED',
      'Agent permission cannot automatically become dataset monetization permission',
    );
  }

  if (!consentCoversScope(consent, request.scopeLabels)) {
    return deny('SCOPE_MISMATCH', 'Requested scope exceeds consent scope');
  }

  if (!consentCoversRecipient(consent, request.recipientSystemRef)) {
    return deny('RECIPIENT_MISMATCH', 'Requested recipient does not match consent recipient');
  }

  if (request.minimumNecessaryProof !== undefined && !minimumNecessaryProofSufficient(request.minimumNecessaryProof)) {
    return deny('MINIMUM_NECESSARY_PROOF_MISSING', 'Minimum necessary proof is insufficient');
  }

  const purpose = humanEconomyPurposeAuthorization(request.requestedPurpose, consent.consentVersion);

  const rightsResult = evaluateRightsFailClosed({
    rightsGrant: request.rightsGrant,
    consentGrant: consent.baseConsentGrant,
    requestedPurpose: purpose,
    at: request.at,
    contributionClass: request.contributionClass,
    revocations: request.revocations,
    historicalEvaluation: request.historicalEvaluation,
  });

  if (rightsResult.decision === 'DENY') {
    const mapped: HumanEconomyDenialCode =
      rightsResult.reasonCode === 'CONSENT_MISSING' ? 'CONSENT_MISSING'
        : rightsResult.reasonCode === 'CONSENT_EXPIRED' ? 'CONSENT_EXPIRED'
          : rightsResult.reasonCode === 'CONSENT_REVOKED' ? 'CONSENT_REVOKED'
            : rightsResult.reasonCode === 'PURPOSE_NOT_PERMITTED' ? 'PURPOSE_NOT_AUTHORIZED'
              : 'PURPOSE_NOT_AUTHORIZED';
    return deny(mapped, rightsResult.message);
  }

  return Object.freeze({
    decision: 'ALLOW',
    purpose,
    rightsCommitment: rightsResult.commitment,
    humanConsentGrantId: consent.humanConsentGrantId,
  });
}

export function buildHistoricalAuthorizationProof(input: {
  readonly executionAt: UtcInstant;
  readonly evaluatedAt: UtcInstant;
  readonly humanConsentGrantId: import('./ids.ts').HumanEconomyConsentGrantId;
  readonly rightsCommitment: import('../rights/types.ts').RightsCommitment;
  readonly revocations: readonly import('../rights/types.ts').RightsRevocation[];
  readonly rightsGrantId: import('../rights/ids.ts').RightsGrantId;
}): HistoricalAuthorizationProof {
  const revocation = findRevocationForTarget(input.revocations, input.rightsGrantId);
  const semantics = evaluateRevocationSemantics({
    executionAt: input.executionAt,
    evaluatedAt: input.evaluatedAt,
    revocation,
  });

  return Object.freeze({
    executionAt: input.executionAt,
    evaluatedAt: input.evaluatedAt,
    rightsCommitment: input.rightsCommitment,
    humanConsentGrantId: input.humanConsentGrantId,
    validAtExecutionTime: semantics.validAtExecutionTime as true,
    blockedForFutureUse: semantics.blockedForFutureUse,
    revocationRef: semantics.reliedUponRevocationRef,
  });
}

export { rightsCommitmentDigestFor };
