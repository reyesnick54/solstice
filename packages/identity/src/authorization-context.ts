import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { staffRolesFromCapabilities, type StaffRole } from './admin-roles.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import type { IdentitySession, RegisteredDevice, SessionRiskState } from './auth.ts';
import type { IdentityCapability } from './capability.ts';
import { clientDenial, type ClientDenial } from './client-denial.ts';
import type { KycRecord, KycVerificationState } from './kyc.ts';
import type { IdentityStatus } from './model.ts';
import {
  hasProductCapability,
  identityCapabilitiesForProduct,
  type ProductCapability,
} from './product-capability.ts';
import type { OwnedResource, OwnedResourceKind } from './resource-ownership.ts';
import type { DeviceId, SessionId, SolsticeIdentityId } from './ids.ts';
import { requiredAssuranceFor } from './capability.ts';
import { assuranceAtLeast } from './assurance.ts';
import type { VerifiedActorContext } from './actor-context.ts';

export const PRINCIPAL_KINDS = ['HUMAN', 'AGENT', 'STAFF'] as const;
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

export type AuthorizationUser = {
  readonly subjectId: SolsticeIdentityId;
  readonly actorId: string;
  readonly customerId: string | null;
  readonly identityStatus: IdentityStatus;
};

export type AuthorizationDevice = {
  readonly deviceId: DeviceId;
  readonly trustState: RegisteredDevice['trustState'];
};

export type AuthorizationRequestMetadata = {
  readonly requestId: string;
  readonly correlationId: string | null;
  readonly method: string;
  readonly path: string;
};

export type AuthorizationAgentBinding = {
  readonly agentId: string;
  readonly mandateId: string;
  readonly humanSubjectId: SolsticeIdentityId;
};

export type AuthorizationContext = {
  readonly user: AuthorizationUser;
  readonly session: {
    readonly sessionId: SessionId;
    readonly riskState: SessionRiskState;
    readonly expiresAt: UtcInstant;
  };
  readonly device: AuthorizationDevice | null;
  readonly authenticationStrength: AuthenticationAssurance;
  readonly roles: readonly StaffRole[];
  readonly permissions: readonly IdentityCapability[];
  readonly jurisdiction: string | null;
  readonly kycState: KycVerificationState | null;
  readonly complianceState: 'CLEAR' | 'REVIEW' | 'BLOCKED';
  readonly riskState: SessionRiskState;
  readonly requestedCapability: ProductCapability | null;
  readonly requestedResource: { readonly kind: OwnedResourceKind; readonly id: string } | null;
  readonly ownedResource: OwnedResource | null;
  readonly request: AuthorizationRequestMetadata;
  readonly principalKind: PrincipalKind;
  readonly agent: AuthorizationAgentBinding | null;
  readonly actorContext: VerifiedActorContext;
  readonly serverOwned: true;
};

export function deriveAuthorizationContext(input: {
  readonly identityStatus: IdentityStatus;
  readonly session: IdentitySession;
  readonly device: RegisteredDevice | null;
  readonly kyc: KycRecord | null;
  readonly customerId: string | null;
  readonly jurisdiction: string | null;
  readonly capabilities: readonly IdentityCapability[];
  readonly actorContext: VerifiedActorContext;
  readonly requestedCapability: ProductCapability | null;
  readonly requestedResource: { readonly kind: OwnedResourceKind; readonly id: string } | null;
  readonly ownedResource: OwnedResource | null;
  readonly request: AuthorizationRequestMetadata;
  readonly principalKind?: PrincipalKind;
  readonly agent?: AuthorizationAgentBinding | null;
}): AuthorizationContext {
  const principalKind = input.principalKind ?? (input.agent ? 'AGENT' : 'HUMAN');
  return Object.freeze({
    user: Object.freeze({
      subjectId: input.session.subjectId,
      actorId: input.session.actorId,
      customerId: input.customerId,
      identityStatus: input.identityStatus,
    }),
    session: Object.freeze({
      sessionId: input.session.sessionId,
      riskState: input.session.riskState,
      expiresAt: input.session.expiresAt,
    }),
    device: input.device
      ? Object.freeze({
          deviceId: input.device.deviceId,
          trustState: input.device.trustState,
        })
      : null,
    authenticationStrength: input.session.authenticationStrength,
    roles: staffRolesFromCapabilities(input.capabilities),
    permissions: Object.freeze([...input.capabilities]),
    jurisdiction: input.jurisdiction,
    kycState: input.kyc?.verificationState ?? null,
    complianceState: input.session.riskState === 'BLOCKED' ? 'BLOCKED' : 'CLEAR',
    riskState: input.session.riskState,
    requestedCapability: input.requestedCapability,
    requestedResource: input.requestedResource,
    ownedResource: input.ownedResource,
    request: Object.freeze({ ...input.request }),
    principalKind,
    agent: input.agent ?? null,
    actorContext: input.actorContext,
    serverOwned: true as const,
  });
}

export function assertCapability(
  context: AuthorizationContext,
  requested: ProductCapability,
): Result<true, ClientDenial> {
  if (context.principalKind === 'AGENT' && requested === 'AGENT_ACTION_APPROVE') {
    return err(clientDenial('AGENT_CANNOT_SELF_APPROVE', { requestId: context.request.requestId }));
  }
  if (!hasProductCapability(context.permissions, requested)) {
    return err(clientDenial('PERMISSION_DENIED', { requestId: context.request.requestId }));
  }
  const required = identityCapabilitiesForProduct(requested);
  const strongest = required.reduce(
    (current, capability) => {
      const next = requiredAssuranceFor(capability);
      return assuranceAtLeast(next, current) ? next : current;
    },
    requiredAssuranceFor(required[0] ?? 'VIEW_ACCOUNT'),
  );
  if (!assuranceAtLeast(context.authenticationStrength, strongest)) {
    return err(clientDenial('STEP_UP_REQUIRED', { requestId: context.request.requestId }));
  }
  return ok(true);
}
