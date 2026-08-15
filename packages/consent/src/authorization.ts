import type {
  DataUseAuthorizationDecision,
  DataUseAuthorizationPort,
  DataUseAuthorizationRequest,
} from '../../personal-data-vault/src/access.ts';
import type { VaultOperation } from '../../personal-data-vault/src/taxonomy.ts';
import { RECIPIENT_PERSONAL_AGENT, RECIPIENT_PEG, RECIPIENT_PRODUCT_RESEARCH } from './recipients.ts';
import type { ConsentService } from './service.ts';
import type { ConsentOperation, DerivationType } from './taxonomy.ts';

function mapOperation(operation: VaultOperation): ConsentOperation {
  if (operation === 'DERIVE') {
    return 'DERIVE';
  }
  if (operation === 'EXPORT') {
    return 'EXPORT';
  }
  if (operation === 'MARK_CONTRIBUTION' || operation === 'THIRD_PARTY_USE') {
    return 'CONTRIBUTE';
  }
  if (operation === 'OPERATOR_READ') {
    return 'READ';
  }
  return 'READ';
}

function mapDerivation(scope: string): DerivationType {
  if (scope.includes('aggregate')) {
    return 'AGGREGATE_ONLY';
  }
  if (scope.includes('derive') || scope.includes('derived') || scope.includes('summary')) {
    return 'DERIVED_ONLY';
  }
  return 'RAW';
}

function recipientFor(request: DataUseAuthorizationRequest): string {
  if (request.recipientId) {
    return request.recipientId;
  }
  if (request.useClass === 'AGENT_BROAD_READ' || request.purposeRef.includes('PERSONAL_AGENT') || request.purposeRef.includes('agent')) {
    return RECIPIENT_PERSONAL_AGENT;
  }
  if (request.purposeRef.includes('PERSONAL_ECONOMIC_GRAPH') || request.purposeRef.includes('peg')) {
    return RECIPIENT_PEG;
  }
  if (request.purposeRef.includes('PRODUCT_IMPROVEMENT')) {
    return RECIPIENT_PRODUCT_RESEARCH;
  }
  return RECIPIENT_PERSONAL_AGENT;
}

/**
 * Canonical Consent adapter for the existing PDV DataUseAuthorizationPort.
 * Self-access remains identity/capability gated. Internal services still
 * require purpose-scoped consent. Default remains fail-closed.
 */
export class ConsentDataUseAuthorization implements DataUseAuthorizationPort {
  constructor(private readonly consent: ConsentService) {}

  authorize(request: DataUseAuthorizationRequest): DataUseAuthorizationDecision {
    if (request.useClass === 'SUBJECT_SELF_ACCESS' && request.actor.subjectId === request.subjectId) {
      return {
        decision: 'ALLOWED',
        reason: 'subject self-access allowed by identity/capability rules; consent ledger not required',
        reasonCode: 'SUBJECT_SELF_ACCESS',
        consentSystemImplemented: true,
      };
    }
    const issued = this.consent.issuePermit(request.actor, {
      subjectId: request.subjectId,
      recipientId: recipientFor(request),
      purposeRef: request.purposeRef,
      resourceId: request.resourceId,
      ...(request.category ? { category: request.category } : {}),
      ...(request.fields ? { fields: request.fields } : {}),
      operation: mapOperation(request.operation),
      derivationType: mapDerivation(request.requestedScope),
      onwardSharing: request.onwardSharing === true,
      ...(request.requestedRetentionDays !== undefined
        ? { requestedRetentionDays: request.requestedRetentionDays }
        : {}),
    });
    if (!issued.ok) {
      return {
        decision: 'DENIED',
        reason: issued.error.message,
        reasonCode: issued.error.code,
        consentSystemImplemented: true,
      };
    }
    return {
      decision: 'ALLOWED',
      reason: issued.value.decision.reason,
      reasonCode: issued.value.decision.reasonCode,
      consentSystemImplemented: true,
      consentDecisionId: issued.value.decision.decisionId,
      purposeId: issued.value.permit.purposeId,
      consentVersion: issued.value.permit.consentVersion,
      permitId: issued.value.permit.permitId,
    };
  }
}
