import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { SecretReference } from './secrets.ts';

export const SERVICE_ROLES = [
  'ACCOUNTS_SERVICE',
  'KERNEL',
  'LEDGER_WRITER',
  'EVIDENCE_SEALER',
  'EVENT_DISPATCHER',
  'SECURITY_CONTROL_PLANE',
  'API_GATEWAY',
  'IDENTITY_SERVICE',
  'PAYMENTS_SERVICE',
  'EXCHANGE_SERVICE',
  'CUSTODY_SERVICE',
  'AGENT_RUNTIME',
  'ADMIN_OPERATIONS',
  'CHAIN_RPC',
  'VALIDATOR',
] as const;

export type ServiceRole = (typeof SERVICE_ROLES)[number];

export const SERVICE_CAPABILITIES = [
  'SUBMIT_INTENT',
  'VERIFY_AUTHORITY',
  'READ_BALANCES',
  'SEAL_EVIDENCE',
  'DISPATCH_EVENTS',
  'MANAGE_KEYS',
  'AUTHENTICATE_PEER',
  'READ_FINALIZED_CHAIN',
  'ADMINISTER',
  'PROPOSE_ONLY',
] as const;

export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number];

export type ServiceIdentity = {
  readonly serviceId: string;
  readonly serviceRole: ServiceRole;
  readonly credentialRef: SecretReference;
  readonly allowedCapabilities: readonly ServiceCapability[];
  readonly expiresAt: string;
  readonly keyVersion: number;
  readonly status: 'ACTIVE' | 'ROTATING' | 'EXPIRED' | 'REVOKED';
};

export function isCredentialExpired(identity: ServiceIdentity, now: string): boolean {
  return Date.parse(now) >= Date.parse(identity.expiresAt);
}

export function assertServiceCapability(
  identity: ServiceIdentity,
  capability: ServiceCapability,
  now: string,
): SecurityResult<ServiceIdentity> {
  if (identity.status === 'REVOKED') {
    return securityErr('KEY_REVOKED', `service '${identity.serviceId}' is revoked`);
  }
  if (identity.status === 'EXPIRED' || isCredentialExpired(identity, now)) {
    return securityErr('CREDENTIAL_EXPIRED', `service '${identity.serviceId}' credential is expired`);
  }
  if (!identity.allowedCapabilities.includes(capability)) {
    return securityErr(
      'PURPOSE_MISMATCH',
      `service '${identity.serviceId}' is not allowed '${capability}'`,
    );
  }
  return securityOk(identity);
}

export class ServiceIdentityRegistry {
  readonly #identities = new Map<string, ServiceIdentity>();

  put(identity: ServiceIdentity): void {
    this.#identities.set(identity.serviceId, Object.freeze({ ...identity }));
  }

  get(serviceId: string): ServiceIdentity | undefined {
    return this.#identities.get(serviceId);
  }

  list(): readonly ServiceIdentity[] {
    return [...this.#identities.values()];
  }

  rotate(serviceId: string, next: Pick<ServiceIdentity, 'credentialRef' | 'keyVersion' | 'expiresAt'>): ServiceIdentity {
    const current = this.#identities.get(serviceId);
    if (!current) {
      throw new Error(`unknown service identity '${serviceId}'`);
    }
    const updated: ServiceIdentity = Object.freeze({
      ...current,
      credentialRef: next.credentialRef,
      keyVersion: next.keyVersion,
      expiresAt: next.expiresAt,
      status: 'ACTIVE',
    });
    this.#identities.set(serviceId, updated);
    return updated;
  }
}
