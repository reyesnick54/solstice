import { InMemorySecretProvider } from '../../secrets.ts';
import type { HsmKeyHandle } from '../../hsm-kms.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../crypto-suite.ts';
import { createProviderCredentialDescriptor } from './descriptor.ts';
import type { ProviderCredentialDescriptor } from './types.ts';

export const FIXTURE_NOW = '2026-08-20T00:00:00.000Z';
export const FIXTURE_NOT_BEFORE = '2026-08-01T00:00:00.000Z';
export const FIXTURE_EXPIRES = '2026-12-01T00:00:00.000Z';

export function fixtureSecretStore(): InMemorySecretProvider {
  return new InMemorySecretProvider('simulation', {
    'kyc/api-key': 'fixture-kyc-api-key-value',
    'oracle/api-key': 'fixture-oracle-api-key-value',
    'banking/oauth': 'fixture-banking-oauth-value',
    'custody/mtls-key': 'fixture-custody-mtls-value',
    'webhook/current': 'fixture-webhook-current',
    'webhook/previous': 'fixture-webhook-previous',
  });
}

export function fixtureHref(path: string): string {
  return `secret://simulation/${path}`;
}

export function fixtureKycCredential(): ProviderCredentialDescriptor {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_kyc_sim_1',
    providerId: 'fixture-kyc',
    providerDomain: 'IDENTITY_KYC',
    credentialKind: 'API_KEY_REFERENCE',
    credentialHref: fixtureHref('kyc/api-key'),
    workloadIdentity: 'kyc_worker',
    allowedOperations: ['VERIFY_IDENTITY', 'READ_HEALTH'],
    networkZone: 'DATA_PRIVATE',
    endpointProfileRef: 'profile:kyc:sandbox',
    issuedAt: FIXTURE_NOW,
    notBefore: FIXTURE_NOT_BEFORE,
    expiresAt: FIXTURE_EXPIRES,
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function fixtureOracleCredential(): ProviderCredentialDescriptor {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_oracle_sim_1',
    providerId: 'fixture-oracle',
    providerDomain: 'ORACLE_DATA_SOURCE',
    credentialKind: 'API_KEY_REFERENCE',
    credentialHref: fixtureHref('oracle/api-key'),
    workloadIdentity: 'oracle_collector',
    allowedOperations: ['READ_REFERENCE_DATA', 'READ_HEALTH'],
    networkZone: 'OPERATIONS_PRIVATE',
    endpointProfileRef: 'profile:oracle:sandbox',
    issuedAt: FIXTURE_NOW,
    notBefore: FIXTURE_NOT_BEFORE,
    expiresAt: FIXTURE_EXPIRES,
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function fixtureBankingCredential(): ProviderCredentialDescriptor {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_bank_sim_1',
    providerId: 'fixture-bank',
    providerDomain: 'BANKING_REFERENCE',
    credentialKind: 'OAUTH_CLIENT_SECRET_REFERENCE',
    credentialHref: fixtureHref('banking/oauth'),
    workloadIdentity: 'banking_worker',
    allowedOperations: ['SUBMIT_PAYMENT', 'QUERY_PAYMENT', 'READ_HEALTH'],
    networkZone: 'DATA_PRIVATE',
    endpointProfileRef: 'profile:bank:sandbox',
    issuedAt: FIXTURE_NOW,
    notBefore: FIXTURE_NOT_BEFORE,
    expiresAt: FIXTURE_EXPIRES,
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function fixtureCustodyCredential(): ProviderCredentialDescriptor {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_custody_sim_1',
    providerId: 'fixture-custody',
    providerDomain: 'CUSTODY_PROVIDER',
    credentialKind: 'MTLS_PRIVATE_KEY_REFERENCE',
    credentialHref: fixtureHref('custody/mtls-key'),
    workloadIdentity: 'custody_worker',
    allowedOperations: ['READ_CUSTODY_POSITION', 'READ_HEALTH'],
    networkZone: 'CUSTODY_PRIVATE',
    endpointProfileRef: 'profile:custody:sandbox',
    issuedAt: FIXTURE_NOW,
    notBefore: FIXTURE_NOT_BEFORE,
    expiresAt: FIXTURE_EXPIRES,
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function fixtureWebhookCredential(version = 1): ProviderCredentialDescriptor {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_webhook_sim_1',
    providerId: 'fixture-kyc',
    providerDomain: 'IDENTITY_KYC',
    credentialKind: 'WEBHOOK_SIGNING_SECRET_REFERENCE',
    credentialHref: fixtureHref(version === 2 ? 'webhook/current' : 'webhook/previous'),
    workloadIdentity: 'kyc_worker',
    allowedOperations: ['VERIFY_WEBHOOK'],
    networkZone: 'DATA_PRIVATE',
    endpointProfileRef: 'profile:kyc:webhook',
    version,
    issuedAt: FIXTURE_NOW,
    notBefore: FIXTURE_NOT_BEFORE,
    expiresAt: FIXTURE_EXPIRES,
    status: 'ACTIVE',
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function fixtureHsmHandle(): HsmKeyHandle {
  return Object.freeze({
    handleId: 'hsm_sim_1',
    keyId: 'key_sim_1',
    keyVersion: 1,
    purpose: 'WALLET_SIGNING',
    suiteId: SUITE_SUNREY_ED25519_V1,
    exportable: false as const,
    disabled: false,
    compromised: false,
    providerId: 'simulation-hsm',
    kind: 'HSM',
  });
}
