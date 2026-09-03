import type { UtcInstant } from '../../../../domain/src/time.ts';
import { newRightsCommitmentId } from './ids.ts';
import {
  consentGrantCommitment as commitConsentGrant,
  licenseAuthorizationCommitment as commitLicenseAuthorization,
  rightsCommitmentDigest,
  rightsGrantCommitment as commitRightsGrant,
} from './commitments.ts';
import {
  evaluateRevocationSemantics,
  findRevocationForTarget,
  grantActiveAt,
  wasRevokedBefore,
} from './revocation.ts';
import { HUMAN_ECONOMY_FAIL_CLOSED_CONTRIBUTION_CLASSES } from './taxonomy.ts';
import type {
  HistoricalRightsProof,
  LicenseAuthorization,
  RightsCommitment,
  RightsEvaluationAllow,
  RightsEvaluationDeny,
  RightsEvaluationRequest,
  RightsEvaluationResult,
} from './types.ts';
import type { RightsGrantState } from './taxonomy.ts';

function deny(
  reasonCode: RightsEvaluationDeny['reasonCode'],
  message: string,
): RightsEvaluationDeny {
  return Object.freeze({ decision: 'DENY', reasonCode, message });
}

function requiresHumanConsent(contributionClass: string | undefined): boolean {
  if (!contributionClass) {
    return false;
  }
  return (HUMAN_ECONOMY_FAIL_CLOSED_CONTRIBUTION_CLASSES as readonly string[]).includes(contributionClass);
}

function licenseRestrictionDenied(
  license: LicenseAuthorization,
  operation: NonNullable<RightsEvaluationRequest['licenseOperation']>,
): RightsEvaluationDeny | null {
  const level =
    operation === 'COMMERCIAL_USE'
      ? license.commercialUse
      : operation === 'PERSISTENCE'
        ? license.persistence
        : operation === 'DERIVED_USE'
          ? license.derivedUse
          : license.redistribution;

  if (level === 'FORBIDDEN') {
    return deny('LICENSE_RESTRICTION', `${operation} is forbidden by provider license configuration`);
  }
  if (level === 'RESTRICTED') {
    return deny('LICENSE_RESTRICTION', `${operation} is restricted by provider license configuration`);
  }
  return null;
}

function resolveGrantState(
  request: RightsEvaluationRequest,
): RightsGrantState {
  const revocation = findRevocationForTarget(
    request.revocations ?? [],
    request.rightsGrant.rightsGrantId,
  );
  if (revocation && wasRevokedBefore(revocation, request.at) && !request.historicalEvaluation) {
    return 'REVOKED';
  }
  if (!grantActiveAt(request.rightsGrant.effectiveFrom, request.rightsGrant.effectiveUntil, request.at)) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function evaluateRights(request: RightsEvaluationRequest): RightsEvaluationResult {
  if (!request.rightsGrant) {
    return deny('RIGHTS_MISSING', 'Rights grant is required');
  }

  if (!request.rightsGrant.jurisdiction || request.rightsGrant.jurisdiction === 'UNRESOLVED') {
    return deny('JURISDICTION_UNRESOLVED', 'Jurisdiction must be resolved before rights evaluation');
  }

  const grantState = resolveGrantState(request);
  if (grantState === 'REVOKED') {
    return deny('RIGHTS_REVOKED', 'Rights grant was revoked before the requested action');
  }
  if (grantState === 'EXPIRED') {
    return deny('RIGHTS_EXPIRED', 'Rights grant is not effective at the requested time');
  }

  if (request.rightsGrant.prohibitedPurposes.includes(request.requestedPurpose.purposeId)) {
    return deny('PURPOSE_PROHIBITED', 'Requested purpose is explicitly prohibited');
  }
  if (!request.rightsGrant.permittedPurposes.includes(request.requestedPurpose.purposeId)) {
    return deny('PURPOSE_NOT_PERMITTED', 'Requested purpose is not permitted by the rights grant');
  }

  if (request.rightsGrant.economyKind === 'HUMAN') {
    const needsConsent =
      requiresHumanConsent(request.contributionClass) || request.consentGrant !== undefined;
    if (needsConsent && !request.consentGrant) {
      return deny('CONSENT_REQUIRED', 'Human economy sensitive contribution requires consent');
    }
    if (request.consentGrant) {
      if (request.consentGrant.rightsGrantId !== request.rightsGrant.rightsGrantId) {
        return deny('SUBJECT_MISMATCH', 'Consent grant does not bind to the supplied rights grant');
      }
      if (request.consentGrant.purposeId !== request.requestedPurpose.purposeId) {
        return deny('PURPOSE_NOT_PERMITTED', 'Consent purpose does not match requested purpose');
      }
      const consentRevocation = findRevocationForTarget(
        request.revocations ?? [],
        request.consentGrant.consentGrantId,
      );
      if (consentRevocation && wasRevokedBefore(consentRevocation, request.at) && !request.historicalEvaluation) {
        return deny('CONSENT_REVOKED', 'Consent was revoked before the requested action');
      }
      if (!grantActiveAt(
        request.consentGrant.effectiveFrom,
        request.consentGrant.effectiveUntil,
        request.at,
      )) {
        return deny('CONSENT_EXPIRED', 'Consent is not effective at the requested time');
      }
      if (request.requestedPurpose.code === 'MONETARY_PROPOSAL') {
        return deny('CONSENT_DOES_NOT_AUTHORIZE_ISSUANCE', 'Consent does not authorize monetary issuance');
      }
      if (request.requestedPurpose.code === 'ECONOMIC_VALUATION' && request.consentGrant.authorizesEconomicValuation === false) {
        return deny('CONSENT_DOES_NOT_AUTHORIZE_VALUATION', 'Consent does not authorize economic valuation');
      }
    }
  }

  if (request.rightsGrant.economyKind === 'PRODUCTIVE') {
    if (!request.licenseAuthorization) {
      return deny('LICENSE_REQUIRED', 'Productive economy data requires explicit license authorization');
    }
    if (!grantActiveAt(
      request.licenseAuthorization.effectiveFrom,
      request.licenseAuthorization.expiresAt,
      request.at,
    )) {
      return deny('LICENSE_EXPIRED', 'Provider license is not effective at the requested time');
    }
    if (request.licenseOperation) {
      const licenseDenied = licenseRestrictionDenied(request.licenseAuthorization, request.licenseOperation);
      if (licenseDenied) {
        return licenseDenied;
      }
    }
  }

  const grantCommitment = commitRightsGrant(request.rightsGrant);
  const consentGrantCommitmentValue = request.consentGrant
    ? commitConsentGrant(request.consentGrant)
    : null;
  const licenseAuthorizationCommitmentValue = request.licenseAuthorization
    ? commitLicenseAuthorization(request.licenseAuthorization)
    : null;

  const commitment: RightsCommitment = Object.freeze({
    schemaVersion: 1,
    commitmentId: newRightsCommitmentId(
      `${request.rightsGrant.rightsGrantId}:${request.requestedPurpose.purposeId}:${request.at}`,
    ),
    rightsGrantCommitment: grantCommitment,
    consentGrantCommitment: consentGrantCommitmentValue,
    licenseAuthorizationCommitment: licenseAuthorizationCommitmentValue,
    purposeId: request.requestedPurpose.purposeId,
    jurisdiction: request.rightsGrant.jurisdiction,
    evaluatedAt: request.at,
    economyKind: request.rightsGrant.economyKind,
  });

  const allow: RightsEvaluationAllow = Object.freeze({
    decision: 'ALLOW',
    commitment,
    grantStateAtEvaluation: grantState,
    reliedUpon: Object.freeze({
      rightsGrantId: request.rightsGrant.rightsGrantId,
      consentGrantId: request.consentGrant?.consentGrantId ?? null,
      licenseId: request.licenseAuthorization?.licenseId ?? null,
      purposeId: request.requestedPurpose.purposeId,
      revocationRef:
        findRevocationForTarget(request.revocations ?? [], request.rightsGrant.rightsGrantId)?.revocationId ??
        null,
    }),
  });

  return allow;
}

export function evaluateRightsFailClosed(request: RightsEvaluationRequest): RightsEvaluationResult {
  const result = evaluateRights(request);
  return result.decision === 'ALLOW' ? result : result;
}

export function consentDoesNotMint(result: RightsEvaluationResult): boolean {
  if (result.decision !== 'ALLOW') {
    return true;
  }
  return result.commitment.economyKind !== 'PRODUCTIVE';
}

export function buildHistoricalRightsProof(input: {
  readonly executionAt: UtcInstant;
  readonly evaluatedAt: UtcInstant;
  readonly commitment: RightsCommitment;
  readonly revocations: readonly import('./types.ts').RightsRevocation[];
  readonly rightsGrantId: import('./ids.ts').RightsGrantId;
}): HistoricalRightsProof {
  const revocation = findRevocationForTarget(input.revocations, input.rightsGrantId);
  const semantics = evaluateRevocationSemantics({
    executionAt: input.executionAt,
    evaluatedAt: input.evaluatedAt,
    revocation,
  });

  return Object.freeze({
    evaluatedAt: input.evaluatedAt,
    commitment: input.commitment,
    reliedUponRevocationRef: semantics.reliedUponRevocationRef,
    validAtExecutionTime: semantics.validAtExecutionTime as true,
    blockedForFutureUse: semantics.blockedForFutureUse,
  });
}

export function rightsCommitmentDigestFor(result: RightsEvaluationAllow): string {
  return rightsCommitmentDigest(result.commitment);
}
