import { err, ok, type Result } from '../../domain/src/result.ts';
import { assuranceAtLeast } from '../../identity/src/assurance.ts';
import {
  isVerifiedActorContext,
  type VerifiedActorContext,
} from '../../identity/src/actor-context.ts';
import type { IdentityCapability } from '../../identity/src/capability.ts';
import { requiredAssuranceFor } from '../../identity/src/capability.ts';
import type { DataUseClass, VaultOperation } from './taxonomy.ts';

export type VaultAccessFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'CAPABILITY_DENIED'
    | 'SUBJECT_MISMATCH'
    | 'ASSURANCE_DENIED'
    | 'CONSENT_SYSTEM_NOT_IMPLEMENTED'
    | 'OPERATOR_DEFAULT_DENY'
    | 'AGENT_WILDCARD_FORBIDDEN'
    | 'PURPOSE_REQUIRED'
    | 'CROSS_SUBJECT_DENIED';
  readonly message: string;
};

export const VAULT_VIEW_CAPABILITY: IdentityCapability = 'VAULT_VIEW_OWN';
export const VAULT_INGEST_CAPABILITY: IdentityCapability = 'VAULT_INGEST_OWN';
export const VAULT_EXPORT_CAPABILITY: IdentityCapability = 'VAULT_EXPORT_OWN';
export const VAULT_DELETE_CAPABILITY: IdentityCapability = 'VAULT_DELETE_OWN';
export const VAULT_OPERATE_CAPABILITY: IdentityCapability = 'OPERATE_PERSONAL_DATA_VAULT';

export type DataUseAuthorizationRequest = {
  readonly actor: VerifiedActorContext;
  readonly subjectId: string;
  readonly resourceId: string;
  readonly operation: VaultOperation;
  readonly useClass: DataUseClass;
  readonly purposeRef: string;
  readonly requestedScope: string;
};

export type DataUseAuthorizationDecision = {
  readonly decision: 'ALLOWED' | 'DENIED';
  readonly reason: string;
  readonly reasonCode: string;
  readonly consentSystemImplemented: false;
};

export type DataUseAuthorizationPort = {
  authorize(request: DataUseAuthorizationRequest): DataUseAuthorizationDecision;
};

/**
 * Chunk 24 will replace this port with the Consent Ledger / Purpose Firewall.
 * Until then: subject self-access may proceed after identity/capability checks;
 * every consent-requiring use fails closed.
 */
export function defaultDataUseAuthorization(request: DataUseAuthorizationRequest): DataUseAuthorizationDecision {
  if (request.useClass === 'SUBJECT_SELF_ACCESS' && request.actor.subjectId === request.subjectId) {
    return {
      decision: 'ALLOWED',
      reason: 'subject self-access allowed by identity/capability rules; consent ledger not consulted',
      reasonCode: 'SUBJECT_SELF_ACCESS',
      consentSystemImplemented: false,
    };
  }
  return {
    decision: 'DENIED',
    reason: 'third-party or system use requiring user consent is denied until Chunk 24',
    reasonCode: 'CONSENT_SYSTEM_NOT_IMPLEMENTED',
    consentSystemImplemented: false,
  };
}

export type VaultAccessRequest = {
  readonly actor: unknown;
  readonly subjectId: string;
  readonly resourceId: string;
  readonly operation: VaultOperation;
  readonly useClass: DataUseClass;
  readonly purposeRef: string;
  readonly requestedScope: string;
  readonly capability: IdentityCapability;
};

export type AuthorizedVaultAccess = {
  readonly actor: VerifiedActorContext;
  readonly subjectId: string;
  readonly operation: VaultOperation;
  readonly purposeRef: string;
  readonly requestedScope: string;
  readonly useClass: DataUseClass;
};

function hasCapability(actor: VerifiedActorContext, capability: IdentityCapability): boolean {
  return actor.authorizedCapabilities.includes(capability);
}

export class VaultAccessBroker {
  private readonly authorization: DataUseAuthorizationPort;

  constructor(authorization: DataUseAuthorizationPort) {
    this.authorization = authorization;
  }

  authorize(request: VaultAccessRequest): Result<AuthorizedVaultAccess, VaultAccessFailure> {
    if (!isVerifiedActorContext(request.actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'vault access requires a verified ActorContext; agents do not receive database credentials',
      });
    }
    const actor = request.actor;
    if (!request.purposeRef) {
      return err({
        code: 'PURPOSE_REQUIRED',
        message: 'every vault access must declare a purpose reference',
      });
    }
    if (!hasCapability(actor, request.capability)) {
      return err({
        code: 'CAPABILITY_DENIED',
        message: `${request.capability} is required`,
      });
    }
    if (!assuranceAtLeast(actor.authenticationAssurance, requiredAssuranceFor(request.capability))) {
      return err({
        code: 'ASSURANCE_DENIED',
        message: `${request.capability} requires stronger authentication`,
      });
    }
    if (actor.subjectId !== request.subjectId) {
      if (!hasCapability(actor, VAULT_OPERATE_CAPABILITY)) {
        return err({
          code: 'CROSS_SUBJECT_DENIED',
          message: 'cross-subject vault access fails closed',
        });
      }
      return err({
        code: 'OPERATOR_DEFAULT_DENY',
        message: 'operator raw vault access is default-deny and requires Chunk 24 consent',
      });
    }
    const decision = this.authorization.authorize({
      actor,
      subjectId: request.subjectId,
      resourceId: request.resourceId,
      operation: request.operation,
      useClass: request.useClass,
      purposeRef: request.purposeRef,
      requestedScope: request.requestedScope,
    });
    if (decision.decision !== 'ALLOWED') {
      return err({
        code: decision.reasonCode === 'CONSENT_SYSTEM_NOT_IMPLEMENTED'
          ? 'CONSENT_SYSTEM_NOT_IMPLEMENTED'
          : 'CAPABILITY_DENIED',
        message: decision.reason,
      });
    }
    return ok({
      actor,
      subjectId: request.subjectId,
      operation: request.operation,
      purposeRef: request.purposeRef,
      requestedScope: request.requestedScope,
      useClass: request.useClass,
    });
  }
}
