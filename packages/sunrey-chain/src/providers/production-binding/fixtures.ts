import type { HsmKeyHandle } from '../../../../security/src/hsm-kms.ts';
import { fixtureHsmHandle } from '../../../../security/src/regulated/credentials/fixtures.ts';
import { createProviderCredentialDescriptor } from '../../../../security/src/regulated/credentials/descriptor.ts';
import type { CredentialOperation, ProviderCredentialDescriptor } from '../../../../security/src/regulated/credentials/types.ts';
import type { ProviderAcceptanceResultRecord, ProviderDataClass, ProviderDomain } from '../types.ts';
import { sealProductionProviderBinding } from './evaluate.ts';
import { inMemoryEvidencePort, inMemoryOperatingScopePort } from './ports.ts';
import type {
  BindingCredentialRecord,
  BindingEndpointProfile,
  BindingEvaluationContext,
  BindingVersionPins,
  BindingWebhookProfile,
  ExternalEvidenceView,
  ProductionProviderBinding,
} from './types.ts';

export const BINDING_FIXTURE_NOW = '2026-08-20T12:00:00.000Z';

export const FIXTURE_VERSION_PINS: BindingVersionPins = Object.freeze({
  adapterVersion: 'adapter/1',
  schemaVersion: 'schema/1',
  translationVersion: 'translation/1',
  endpointProfileVersion: 'endpoint/1',
  credentialPolicyVersion: 'credential-policy/1',
  conformanceSuiteVersion: 'conformance/1',
});

function endpoint(input: {
  readonly profileId: string;
  readonly host: string;
  readonly prefix: string;
}): BindingEndpointProfile {
  return Object.freeze({
    profileId: input.profileId,
    environmentClass: 'PRODUCTION_CANDIDATE',
    scheme: 'https',
    host: input.host,
    port: 443,
    approvedPathPrefix: input.prefix,
    tlsPolicy: 'TLS_1_3',
    mtlsRequired: input.profileId.includes('custody') || input.profileId.includes('hsm'),
    redirectPolicy: 'DENY',
    certificateExpectation: input.profileId.includes('custody') ? 'MTLS_REQUIRED' : 'PINNED',
    allowlisted: true,
    connectivityEnabled: false,
  });
}

function webhook(profileId: string, kind: BindingWebhookProfile['kind']): BindingWebhookProfile {
  return Object.freeze({
    profileId,
    kind,
    verificationProfileRef: `${profileId}:verify`,
    externallyExposed: false,
  });
}

function credential(input: {
  readonly credentialId: string;
  readonly providerId: string;
  readonly providerDomain: ProviderDomain;
  readonly workloadIdentity: ProviderCredentialDescriptor['workloadIdentity'];
  readonly allowedOperations: readonly CredentialOperation[];
  readonly endpointProfileRef: string;
  readonly networkZone: ProviderCredentialDescriptor['networkZone'];
  readonly credentialKind?: ProviderCredentialDescriptor['credentialKind'];
  readonly path?: string;
  readonly keyHandle?: HsmKeyHandle;
}): BindingCredentialRecord {
  const created = createProviderCredentialDescriptor({
    credentialId: input.credentialId,
    providerId: input.providerId,
    providerDomain: input.providerDomain,
    credentialKind: input.credentialKind ?? 'API_KEY_REFERENCE',
    ...(input.keyHandle
      ? { keyHandle: input.keyHandle }
      : { credentialHref: `secret://simulation/${input.path ?? 'missing'}` }),
    workloadIdentity: input.workloadIdentity,
    allowedOperations: input.allowedOperations,
    networkZone: input.networkZone,
    endpointProfileRef: input.endpointProfileRef,
    issuedAt: BINDING_FIXTURE_NOW,
    notBefore: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-12-01T00:00:00.000Z',
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return Object.freeze({
    descriptor: created.value,
    environmentClass: 'PRODUCTION_CANDIDATE',
  });
}

function sandboxCredential(): BindingCredentialRecord {
  const created = createProviderCredentialDescriptor({
    credentialId: 'cred_kyc_sandbox',
    providerId: 'fixture-kyc-prod',
    providerDomain: 'IDENTITY_KYC',
    credentialKind: 'API_KEY_REFERENCE',
    credentialHref: 'secret://simulation/kyc/sandbox-key',
    workloadIdentity: 'kyc_worker',
    allowedOperations: ['VERIFY_IDENTITY', 'READ_HEALTH'],
    networkZone: 'DATA_PRIVATE',
    endpointProfileRef: 'profile:kyc:sandbox',
    issuedAt: BINDING_FIXTURE_NOW,
    notBefore: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-12-01T00:00:00.000Z',
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return Object.freeze({
    descriptor: created.value,
    environmentClass: 'SANDBOX',
  });
}

function acceptance(providerId: string, domain: ProviderDomain): ProviderAcceptanceResultRecord {
  return Object.freeze({
    providerId,
    domain,
    configured: true,
    engineeringTested: true,
    externalEvidenceSatisfied: true,
    humanAccepted: true,
    productionEligible: true,
    state: 'PRODUCTION_ELIGIBLE',
    expirationWarnings: Object.freeze([]),
    capabilities: Object.freeze([]),
  });
}

function evidence(providerId: string, suffix: string, status: ExternalEvidenceView['status'] = 'CURRENT'): ExternalEvidenceView {
  return Object.freeze({
    evidenceId: `ev_${providerId}_${suffix}`,
    evidenceClass: suffix === 'hsm' ? 'HSM_ATTESTATION' : 'SERVICE_CONTRACT',
    providerId,
    status,
    expiresAtUtc: status === 'EXPIRED' ? '2026-01-01T00:00:00.000Z' : '2027-01-01T00:00:00.000Z',
  });
}

function draftBinding(input: {
  readonly bindingId: string;
  readonly providerId: string;
  readonly providerDomain: ProviderDomain;
  readonly dataClasses: readonly ProviderDataClass[];
  readonly allowedOperations: readonly CredentialOperation[];
  readonly jurisdictions?: readonly string[];
  readonly regions?: readonly string[];
  readonly primary?: boolean;
  readonly failoverPriority?: number;
  readonly failoverBindingId?: string | null;
  readonly webhookProfileRefs?: readonly string[];
  readonly controllerId?: string;
  readonly credentialAuthorityId?: string;
  readonly versionPins?: BindingVersionPins;
}): Omit<ProductionProviderBinding, 'contentHash' | 'productionConnectivityEnabled'> {
  return {
    bindingId: input.bindingId,
    providerId: input.providerId,
    providerDomain: input.providerDomain,
    providerProfileVersion: `${input.providerId}/1`,
    environmentClass: 'PRODUCTION_CANDIDATE',
    endpointProfileRef: `ep_${input.providerId}`,
    credentialDescriptorRef: `cred_${input.providerId}`,
    credentialVersionRef: `cred_${input.providerId}:v1`,
    externalEvidenceRefs: Object.freeze([`ev_${input.providerId}_contract`]),
    operatingScopeRefs: Object.freeze([`scope_${input.providerId}`]),
    legalEntityRef: `le_${input.providerId}`,
    jurisdictions: Object.freeze(input.jurisdictions ?? ['US']),
    regions: Object.freeze(input.regions ?? ['us-east-1']),
    dataClasses: Object.freeze(input.dataClasses),
    allowedOperations: Object.freeze(input.allowedOperations),
    primary: input.primary ?? true,
    failoverPriority: input.failoverPriority ?? 0,
    failoverBindingId: input.failoverBindingId ?? null,
    runtimeProfileRef: `runtime_${input.providerId}`,
    conformanceReportRef: `conf_${input.providerId}`,
    acceptanceReportRef: `acc_${input.providerId}`,
    webhookProfileRefs: Object.freeze(input.webhookProfileRefs ?? []),
    versionPins: input.versionPins ?? FIXTURE_VERSION_PINS,
    operationalOwner: 'platform-operations',
    controllerId: input.controllerId ?? `corp_${input.providerId}`,
    credentialAuthorityId: input.credentialAuthorityId ?? `ca_${input.providerId}`,
    status: 'ENGINEERING_BOUND',
    version: 1,
  };
}

export function fixtureKycBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_kyc_primary',
      providerId: 'fixture-kyc-prod',
      providerDomain: 'IDENTITY_KYC',
      dataClasses: ['KYC_DATA', 'IDENTITY_DATA'],
      allowedOperations: ['VERIFY_IDENTITY', 'READ_HEALTH'],
      webhookProfileRefs: ['wh_kyc_callback'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixturePaymentRailBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_rail_primary',
      providerId: 'fixture-rail-prod',
      providerDomain: 'PAYMENT_RAIL',
      dataClasses: ['PAYMENT_DATA'],
      allowedOperations: ['SUBMIT_PAYMENT', 'QUERY_PAYMENT', 'READ_HEALTH'],
      webhookProfileRefs: ['wh_payment_callback'],
      failoverBindingId: 'bind_rail_failover',
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixturePaymentRailFailoverBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_rail_failover',
      providerId: 'fixture-rail-failover',
      providerDomain: 'PAYMENT_RAIL',
      dataClasses: ['PAYMENT_DATA'],
      allowedOperations: ['SUBMIT_PAYMENT', 'QUERY_PAYMENT', 'READ_HEALTH'],
      webhookProfileRefs: ['wh_payment_failover_callback'],
      primary: false,
      failoverPriority: 1,
      regions: ['eu-west-1'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixtureFxBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_fx_primary',
      providerId: 'fixture-fx-prod',
      providerDomain: 'FX_LIQUIDITY',
      dataClasses: ['PAYMENT_DATA'],
      allowedOperations: ['READ_REFERENCE_DATA', 'READ_HEALTH'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixtureCustodyBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_custody_primary',
      providerId: 'fixture-custody-prod',
      providerDomain: 'CUSTODY_PROVIDER',
      dataClasses: ['CUSTODY_METADATA'],
      allowedOperations: ['READ_CUSTODY_POSITION', 'READ_HEALTH'],
      webhookProfileRefs: ['wh_custody_status'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixtureOracleBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_oracle_primary',
      providerId: 'fixture-oracle-prod',
      providerDomain: 'ORACLE_DATA_SOURCE',
      dataClasses: ['ORACLE_PUBLIC_DATA'],
      allowedOperations: ['READ_REFERENCE_DATA', 'READ_HEALTH'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixtureHsmBinding(): ProductionProviderBinding {
  const sealed = sealProductionProviderBinding(
    draftBinding({
      bindingId: 'bind_hsm_primary',
      providerId: 'fixture-hsm-prod',
      providerDomain: 'HSM',
      dataClasses: ['CONFIDENTIAL_OPERATIONS_DATA'],
      allowedOperations: ['SIGN_PROVIDER_REQUEST', 'READ_HEALTH'],
    }),
  );
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function fixtureCatalogBindings(): readonly ProductionProviderBinding[] {
  return Object.freeze([
    fixtureKycBinding(),
    fixturePaymentRailBinding(),
    fixturePaymentRailFailoverBinding(),
    fixtureFxBinding(),
    fixtureCustodyBinding(),
    fixtureOracleBinding(),
    fixtureHsmBinding(),
  ]);
}

export function fixtureBindingContext(overrides: Partial<BindingEvaluationContext> = {}): BindingEvaluationContext {
  const credentials: Record<string, BindingCredentialRecord> = {
    'cred_fixture-kyc-prod': credential({
      credentialId: 'cred_fixture-kyc-prod',
      providerId: 'fixture-kyc-prod',
      providerDomain: 'IDENTITY_KYC',
      workloadIdentity: 'kyc_worker',
      allowedOperations: ['VERIFY_IDENTITY', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-kyc-prod',
      networkZone: 'DATA_PRIVATE',
      path: 'kyc/prod-key',
    }),
    'cred_fixture-rail-prod': credential({
      credentialId: 'cred_fixture-rail-prod',
      providerId: 'fixture-rail-prod',
      providerDomain: 'PAYMENT_RAIL',
      workloadIdentity: 'banking_worker',
      allowedOperations: ['SUBMIT_PAYMENT', 'QUERY_PAYMENT', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-rail-prod',
      networkZone: 'DATA_PRIVATE',
      credentialKind: 'OAUTH_CLIENT_SECRET_REFERENCE',
      path: 'rail/prod-oauth',
    }),
    'cred_fixture-rail-failover': credential({
      credentialId: 'cred_fixture-rail-failover',
      providerId: 'fixture-rail-failover',
      providerDomain: 'PAYMENT_RAIL',
      workloadIdentity: 'banking_worker',
      allowedOperations: ['SUBMIT_PAYMENT', 'QUERY_PAYMENT', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-rail-failover',
      networkZone: 'DATA_PRIVATE',
      credentialKind: 'OAUTH_CLIENT_SECRET_REFERENCE',
      path: 'rail/failover-oauth',
    }),
    'cred_fixture-fx-prod': credential({
      credentialId: 'cred_fixture-fx-prod',
      providerId: 'fixture-fx-prod',
      providerDomain: 'FX_LIQUIDITY',
      workloadIdentity: 'banking_worker',
      allowedOperations: ['READ_REFERENCE_DATA', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-fx-prod',
      networkZone: 'DATA_PRIVATE',
      path: 'fx/prod-key',
    }),
    'cred_fixture-custody-prod': credential({
      credentialId: 'cred_fixture-custody-prod',
      providerId: 'fixture-custody-prod',
      providerDomain: 'CUSTODY_PROVIDER',
      workloadIdentity: 'custody_worker',
      allowedOperations: ['READ_CUSTODY_POSITION', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-custody-prod',
      networkZone: 'CUSTODY_PRIVATE',
      credentialKind: 'MTLS_PRIVATE_KEY_REFERENCE',
      path: 'custody/prod-mtls',
    }),
    'cred_fixture-oracle-prod': credential({
      credentialId: 'cred_fixture-oracle-prod',
      providerId: 'fixture-oracle-prod',
      providerDomain: 'ORACLE_DATA_SOURCE',
      workloadIdentity: 'oracle_collector',
      allowedOperations: ['READ_REFERENCE_DATA', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-oracle-prod',
      networkZone: 'OPERATIONS_PRIVATE',
      path: 'oracle/prod-key',
    }),
    'cred_fixture-hsm-prod': credential({
      credentialId: 'cred_fixture-hsm-prod',
      providerId: 'fixture-hsm-prod',
      providerDomain: 'HSM',
      workloadIdentity: 'hsm_worker',
      allowedOperations: ['SIGN_PROVIDER_REQUEST', 'READ_HEALTH'],
      endpointProfileRef: 'ep_fixture-hsm-prod',
      networkZone: 'SIGNER_PRIVATE',
      credentialKind: 'HSM_KEY_HANDLE_REFERENCE',
      keyHandle: fixtureHsmHandle(),
    }),
    cred_kyc_sandbox: sandboxCredential(),
  };

  const endpointProfiles: Record<string, BindingEndpointProfile> = {
    'ep_fixture-kyc-prod': endpoint({ profileId: 'ep_fixture-kyc-prod', host: 'kyc.providers.example', prefix: '/v1/kyc' }),
    'ep_fixture-rail-prod': endpoint({ profileId: 'ep_fixture-rail-prod', host: 'rail.providers.example', prefix: '/v1/payments' }),
    'ep_fixture-rail-failover': endpoint({
      profileId: 'ep_fixture-rail-failover',
      host: 'rail-failover.providers.example',
      prefix: '/v1/payments',
    }),
    'ep_fixture-fx-prod': endpoint({ profileId: 'ep_fixture-fx-prod', host: 'fx.providers.example', prefix: '/v1/fx' }),
    'ep_fixture-custody-prod': endpoint({
      profileId: 'ep_fixture-custody-prod',
      host: 'custody.providers.example',
      prefix: '/v1/custody',
    }),
    'ep_fixture-oracle-prod': endpoint({
      profileId: 'ep_fixture-oracle-prod',
      host: 'oracle.providers.example',
      prefix: '/v1/oracle',
    }),
    'ep_fixture-hsm-prod': endpoint({ profileId: 'ep_fixture-hsm-prod', host: 'hsm.providers.example', prefix: '/v1/hsm' }),
    'profile:kyc:sandbox': Object.freeze({
      ...endpoint({ profileId: 'profile:kyc:sandbox', host: 'sandbox.kyc.example', prefix: '/sandbox' }),
      environmentClass: 'SANDBOX',
    }),
  };

  const evidencePort = inMemoryEvidencePort([
    evidence('fixture-kyc-prod', 'contract'),
    evidence('fixture-rail-prod', 'contract'),
    evidence('fixture-rail-failover', 'contract'),
    evidence('fixture-fx-prod', 'contract'),
    evidence('fixture-custody-prod', 'contract'),
    evidence('fixture-oracle-prod', 'contract'),
    evidence('fixture-hsm-prod', 'contract'),
    evidence('fixture-hsm-prod', 'hsm'),
  ]);

  const scopeRows = [
    'fixture-kyc-prod',
    'fixture-rail-prod',
    'fixture-rail-failover',
    'fixture-fx-prod',
    'fixture-custody-prod',
    'fixture-oracle-prod',
    'fixture-hsm-prod',
  ].map((providerId) => {
    const binding = fixtureCatalogBindings().find((row) => row.providerId === providerId);
    if (!binding) {
      throw new Error(`missing fixture binding ${providerId}`);
    }
    return {
      scopeRef: `scope_${providerId}`,
      providerId,
      providerDomain: binding.providerDomain,
      jurisdictions: binding.jurisdictions,
      productDomains: [binding.providerDomain],
      dataClasses: binding.dataClasses,
      operations: binding.allowedOperations,
    };
  });

  return {
    nowUtc: BINDING_FIXTURE_NOW,
    endpointProfiles,
    webhookProfiles: {
      wh_kyc_callback: webhook('wh_kyc_callback', 'KYC_CALLBACK'),
      wh_payment_callback: webhook('wh_payment_callback', 'PAYMENT_CALLBACK'),
      wh_payment_failover_callback: webhook('wh_payment_failover_callback', 'PAYMENT_CALLBACK'),
      wh_custody_status: webhook('wh_custody_status', 'CUSTODY_TRANSACTION_STATUS'),
    },
    credentials,
    evidence: evidencePort,
    operatingScope: inMemoryOperatingScopePort(scopeRows),
    acceptance: acceptance('fixture-kyc-prod', 'IDENTITY_KYC'),
    observedVersionPins: FIXTURE_VERSION_PINS,
    requestedJurisdictions: ['US'],
    requestedDataClasses: ['KYC_DATA'],
    requestedOperations: ['VERIFY_IDENTITY'],
    requestedProductDomain: 'IDENTITY_KYC',
    sandboxFlag: false,
    productionEligibleFlag: false,
    failoverEvaluation: null,
    ...overrides,
  };
}

export function contextForBinding(
  binding: ProductionProviderBinding,
  extras: Partial<BindingEvaluationContext> = {},
): BindingEvaluationContext {
  return fixtureBindingContext({
    acceptance: acceptance(binding.providerId, binding.providerDomain),
    requestedJurisdictions: binding.jurisdictions,
    requestedDataClasses: binding.dataClasses,
    requestedOperations: [...binding.allowedOperations],
    requestedProductDomain: binding.providerDomain,
    ...extras,
  });
}

export function fixtureExpiredEvidencePort() {
  return inMemoryEvidencePort([evidence('fixture-kyc-prod', 'contract', 'EXPIRED')]);
}

export function fixtureRevokedEvidencePort() {
  return inMemoryEvidencePort([evidence('fixture-kyc-prod', 'contract', 'REVOKED')]);
}
