import { isExpired } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { assuranceAtLeast, type AuthenticationAssurance } from '../../identity/src/assurance.ts';
import type { DataCategory, SensitivityClass } from '../../personal-data-vault/src/taxonomy.ts';
import type { ConsentOperation, ConsentReasonCode, DerivationType, FirewallDecision } from './taxonomy.ts';
import type { ConsentRecord, PurposeRecord, RecipientRecord } from './types.ts';

export type FirewallRequest = {
  readonly subjectId: string;
  readonly actorSubjectId: string;
  readonly actorAssurance: AuthenticationAssurance;
  readonly recipient: RecipientRecord;
  readonly purpose: PurposeRecord;
  readonly resourceId: string;
  readonly category: DataCategory | null;
  readonly fields: readonly string[];
  readonly windowFrom: UtcInstant | null;
  readonly windowTo: UtcInstant | null;
  readonly operation: ConsentOperation;
  readonly derivationType: DerivationType;
  readonly onwardSharing: boolean;
  readonly requestedRetentionDays: number | null;
  readonly sensitivity: SensitivityClass | null;
  readonly now: UtcInstant;
  readonly evaluationMode?: 'SUBJECT_SELF' | 'RECIPIENT_CLEAN_ROOM';
};

export type FirewallResult = {
  readonly decision: FirewallDecision;
  readonly reasonCode: ConsentReasonCode;
  readonly reason: string;
  readonly consent: ConsentRecord | null;
};

const SENSITIVITY_RANK: Record<SensitivityClass, number> = {
  PERSONAL: 1,
  SENSITIVE: 2,
  HIGHLY_SENSITIVE: 3,
  RESTRICTED: 4,
};

function inWindow(consent: ConsentRecord, request: FirewallRequest): boolean {
  if (!consent.scope.windowFrom && !consent.scope.windowTo) {
    return true;
  }
  if (request.windowFrom && consent.scope.windowFrom && request.windowFrom < consent.scope.windowFrom) {
    return false;
  }
  if (request.windowTo && consent.scope.windowTo && request.windowTo > consent.scope.windowTo) {
    return false;
  }
  return true;
}

function resourceInScope(consent: ConsentRecord, request: FirewallRequest): boolean {
  if (consent.permittedAssetIds.length > 0) {
    if (consent.permittedAssetIds.includes(request.resourceId)) {
      return true;
    }
    if (request.resourceId !== request.subjectId && !request.resourceId.includes(',')) {
      return false;
    }
  }
  if (request.category && !consent.permittedCategories.includes(request.category)) {
    return false;
  }
  if (request.fields.length > 0 && consent.scope.fields.length > 0) {
    return request.fields.every((field) => consent.scope.fields.includes(field));
  }
  return inWindow(consent, request);
}

export class PurposeFirewall {
  evaluate(request: FirewallRequest, candidates: readonly ConsentRecord[]): FirewallResult {
    if (request.evaluationMode !== 'RECIPIENT_CLEAN_ROOM' && request.actorSubjectId !== request.subjectId) {
      return deny('CROSS_SUBJECT_DENIED', 'actor is not bound to the subject', null);
    }
    const matchingPurpose = candidates.filter(
      (row) => row.purposeId === request.purpose.purposeId && row.purposeVersion === request.purpose.purposeVersion,
    );
    if (matchingPurpose.length === 0) {
      const otherPurpose = candidates.find((row) => row.state === 'ACTIVE');
      if (otherPurpose) {
        return deny('PURPOSE_MISMATCH', 'active consent is bound to a different purpose version', otherPurpose);
      }
      return deny('NO_ACTIVE_CONSENT', 'no consent matches the requested purpose version', null);
    }
    const matchingRecipient = matchingPurpose.filter(
      (row) => row.recipientId === request.recipient.recipientId,
    );
    if (matchingRecipient.length === 0) {
      return deny('RECIPIENT_OUT_OF_SCOPE', 'consent does not authorize this recipient', matchingPurpose[0] ?? null);
    }
    const active = matchingRecipient
      .filter((row) => row.state === 'ACTIVE' && !isExpired(row.expiresAt, request.now))
      .sort((a, b) => b.versionSequence - a.versionSequence)[0];
    const consent =
      active ??
      matchingRecipient.sort((a, b) => b.versionSequence - a.versionSequence)[0];
    if (!consent) {
      return deny('RECIPIENT_OUT_OF_SCOPE', 'consent does not authorize this recipient', matchingPurpose[0] ?? null);
    }
    if (consent.state === 'REVOKED') {
      return deny('CONSENT_REVOKED', 'consent was revoked; new permits are denied', consent);
    }
    if (consent.state === 'EXPIRED' || isExpired(consent.expiresAt, request.now)) {
      return deny('CONSENT_EXPIRED', 'consent has expired; new permits are denied', consent);
    }
    if (consent.state !== 'ACTIVE') {
      return deny('CONSENT_NOT_ACTIVE', `consent state ${consent.state} cannot authorize use`, consent);
    }
    if (!consent.permittedOperations.includes(request.operation)) {
      return deny('OPERATION_OUT_OF_SCOPE', `${request.operation} is not permitted by this consent`, consent);
    }
    if (!request.purpose.allowedOperations.includes(request.operation)) {
      return deny('OPERATION_OUT_OF_SCOPE', `${request.operation} is not allowed by the purpose version`, consent);
    }
    if (!resourceInScope(consent, request)) {
      return deny('RESOURCE_OUT_OF_SCOPE', 'requested asset, category, field, or window is outside consent', consent);
    }
    if (request.category && !request.purpose.allowedCategories.includes(request.category)) {
      return deny('RESOURCE_OUT_OF_SCOPE', 'purpose version does not allow this data category', consent);
    }
    if (!consent.permittedDerivationTypes.includes(request.derivationType)) {
      return deny('OPERATION_OUT_OF_SCOPE', `${request.derivationType} access is outside the consented derivation types`, consent);
    }
    if (request.onwardSharing && consent.onwardSharing.state === 'NOT_ALLOWED') {
      return deny('ONWARD_SHARING_DENIED', 'onward sharing is not allowed by this consent', consent);
    }
    if (
      request.requestedRetentionDays !== null &&
      consent.retention.requestedRetentionDays !== null &&
      request.requestedRetentionDays > consent.retention.requestedRetentionDays
    ) {
      return deny('RETENTION_EXCEEDS_PERMISSION', 'requested retention exceeds the consented retention instruction', consent);
    }
    if (request.sensitivity && SENSITIVITY_RANK[request.sensitivity] > SENSITIVITY_RANK[request.purpose.maxSensitivity]) {
      return deny('RESOURCE_OUT_OF_SCOPE', 'requested sensitivity exceeds the purpose limit', consent);
    }
    const requiredAssurance = request.purpose.maxSensitivity === 'HIGHLY_SENSITIVE' || request.purpose.maxSensitivity === 'RESTRICTED'
      ? 'STRONG'
      : 'STANDARD';
    if (!assuranceAtLeast(request.actorAssurance, requiredAssurance)) {
      return deny('ASSURANCE_INSUFFICIENT', 'authentication assurance is insufficient for this purpose', consent);
    }
    if (request.purpose.legalHook === 'COUNSEL_REVIEW_REQUIRED' && request.operation === 'SHARE') {
      return {
        decision: 'REVIEW_REQUIRED',
        reasonCode: 'LEGAL_BASIS_UNCERTAIN',
        reason: 'sharing under this purpose requires counsel review; not a compliance claim',
        consent,
      };
    }
    if (request.purpose.code === 'DATA_CONTRIBUTION_RESEARCH' && request.operation === 'CONTRIBUTE') {
      return deny(
        'DEPENDENCY_NOT_IMPLEMENTED',
        'data-contribution consent cannot execute raw external sharing; use the Privacy Clean Room for authorized aggregate computation',
        consent,
      );
    }
    return {
      decision: 'ALLOW',
      reasonCode: 'ALLOWED',
      reason: 'purpose firewall allowed a scoped use under the exact consented purpose version',
      consent,
    };
  }
}

function deny(reasonCode: ConsentReasonCode, reason: string, consent: ConsentRecord | null): FirewallResult {
  return { decision: 'DENY', reasonCode, reason, consent };
}
