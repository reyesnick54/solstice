/**
 * Internal service identity and deployable mTLS / certificate identity.
 * No shared universal internal API key. No certificates committed.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import {
  SERVICE_CAPABILITIES,
  SERVICE_ROLES,
  ServiceIdentityRegistry,
  assertServiceCapability,
  type ServiceCapability,
  type ServiceIdentity,
  type ServiceRole,
} from '../identity.ts';
import { secretRef, type SecretReference } from '../secrets.ts';

export const INTERNAL_AUTH_METHODS = ['MTLS', 'SHORT_LIVED_SERVICE_CREDENTIAL'] as const;
export type InternalAuthMethod = (typeof INTERNAL_AUTH_METHODS)[number];

export const SHARED_UNIVERSAL_INTERNAL_API_KEY = false as const;

export type ServiceCertificateIdentity = {
  readonly serviceId: string;
  readonly serviceRole: ServiceRole;
  readonly method: InternalAuthMethod;
  readonly trustDomain: string;
  readonly identityUri: string;
  readonly certificateRef: SecretReference;
  readonly privateKeyRef: SecretReference;
  readonly committedCertificateMaterial: false;
  readonly sharedUniversalKey: false;
};

export function issueServiceCertificateIdentity(input: {
  readonly serviceId: string;
  readonly serviceRole: ServiceRole;
  readonly trustDomain?: string;
  readonly secretProviderId?: string;
}): SecurityResult<ServiceCertificateIdentity> {
  if (!(SERVICE_ROLES as readonly string[]).includes(input.serviceRole)) {
    return securityErr('PURPOSE_MISMATCH', `unknown service role ${input.serviceRole}`);
  }
  if (input.serviceId === 'shared' || input.serviceId === 'universal') {
    return securityErr('SHARED_ACCOUNT_FORBIDDEN', 'shared universal internal identity is forbidden');
  }
  const provider = input.secretProviderId ?? 'simulation';
  const trustDomain = input.trustDomain ?? 'internal.sunrey.simulation';
  return securityOk(
    Object.freeze({
      serviceId: input.serviceId,
      serviceRole: input.serviceRole,
      method: 'MTLS',
      trustDomain,
      identityUri: `spiffe://${trustDomain}/ns/sunrey/sa/${input.serviceId}`,
      certificateRef: secretRef(provider, `pki/${input.serviceId}/tls-cert`),
      privateKeyRef: secretRef(provider, `pki/${input.serviceId}/tls-key`),
      committedCertificateMaterial: false,
      sharedUniversalKey: false,
    }),
  );
}

export function authenticatePeer(input: {
  readonly caller: ServiceIdentity;
  readonly capability: ServiceCapability;
  readonly now: string;
}): SecurityResult<ServiceIdentity> {
  if (!(SERVICE_CAPABILITIES as readonly string[]).includes(input.capability)) {
    return securityErr('PURPOSE_MISMATCH', `unknown capability ${input.capability}`);
  }
  return assertServiceCapability(input.caller, input.capability, input.now);
}

export function rejectSharedInternalKey(credentialId: string): SecurityResult<true> {
  if (credentialId === 'shared' || credentialId === 'universal' || credentialId === 'internal-api-key') {
    return securityErr('SHARED_ACCOUNT_FORBIDDEN', 'shared universal internal API key is forbidden');
  }
  return securityOk(true);
}

export function defaultInternalIdentities(
  now: string,
  expiresAt: string,
): ServiceIdentityRegistry {
  const registry = new ServiceIdentityRegistry();
  const rows: Array<{ serviceId: string; serviceRole: ServiceRole; capabilities: readonly ServiceCapability[] }> = [
    { serviceId: 'svc_api', serviceRole: 'API_GATEWAY', capabilities: ['AUTHENTICATE_PEER', 'SUBMIT_INTENT'] },
    { serviceId: 'svc_accounts', serviceRole: 'ACCOUNTS_SERVICE', capabilities: ['SUBMIT_INTENT', 'READ_BALANCES'] },
    { serviceId: 'svc_identity', serviceRole: 'IDENTITY_SERVICE', capabilities: ['AUTHENTICATE_PEER'] },
    { serviceId: 'svc_kernel', serviceRole: 'KERNEL', capabilities: ['VERIFY_AUTHORITY'] },
    { serviceId: 'svc_ledger', serviceRole: 'LEDGER_WRITER', capabilities: ['READ_BALANCES'] },
    { serviceId: 'svc_evidence', serviceRole: 'EVIDENCE_SEALER', capabilities: ['SEAL_EVIDENCE'] },
    { serviceId: 'svc_events', serviceRole: 'EVENT_DISPATCHER', capabilities: ['DISPATCH_EVENTS'] },
    { serviceId: 'svc_security', serviceRole: 'SECURITY_CONTROL_PLANE', capabilities: ['MANAGE_KEYS'] },
    { serviceId: 'svc_payments', serviceRole: 'PAYMENTS_SERVICE', capabilities: ['SUBMIT_INTENT'] },
    { serviceId: 'svc_exchange', serviceRole: 'EXCHANGE_SERVICE', capabilities: ['SUBMIT_INTENT'] },
    { serviceId: 'svc_custody', serviceRole: 'CUSTODY_SERVICE', capabilities: ['AUTHENTICATE_PEER'] },
    { serviceId: 'svc_agent', serviceRole: 'AGENT_RUNTIME', capabilities: ['PROPOSE_ONLY'] },
    { serviceId: 'svc_admin', serviceRole: 'ADMIN_OPERATIONS', capabilities: ['ADMINISTER'] },
    { serviceId: 'svc_rpc', serviceRole: 'CHAIN_RPC', capabilities: ['READ_FINALIZED_CHAIN'] },
    { serviceId: 'svc_validator', serviceRole: 'VALIDATOR', capabilities: ['AUTHENTICATE_PEER'] },
  ];
  void now;
  for (const row of rows) {
    registry.put({
      serviceId: row.serviceId,
      serviceRole: row.serviceRole,
      credentialRef: secretRef('simulation', `svc/${row.serviceId}`),
      allowedCapabilities: row.capabilities,
      expiresAt,
      keyVersion: 1,
      status: 'ACTIVE',
    });
  }
  return registry;
}
