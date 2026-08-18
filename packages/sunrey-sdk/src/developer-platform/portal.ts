import { randomUUID } from 'node:crypto';

import { hashSecret, randomSecret, secretHint } from './crypto.ts';
import { DeveloperFaucet, type DeveloperFaucetRequest } from './faucet.ts';
import {
  assertNotProtocolGovernanceRole,
  credentialHasScope,
  eventAuthorizedForScopes,
  roleMayManageCredentials,
  roleMayMutateApplication,
  roleMayView,
} from './permissions.ts';
import { QuotaLedger, type DeveloperBillingPort, createSimulationBillingPort } from './quotas.ts';
import { createSandboxAccount, sandboxCannotBecomeProduction } from './sandbox.ts';
import { inspectWebhookDestination } from './ssrf.ts';
import {
  DEFAULT_WEBHOOK_RETRY_POLICY,
  type ApplicationEnvironment,
  type ApplicationStatus,
  type DeveloperAccount,
  type DeveloperApiCredential,
  type DeveloperApplication,
  type DeveloperAuditEntry,
  type DeveloperOrganization,
  type DeveloperPermission,
  type DeveloperQuota,
  type DeveloperRole,
  type DeveloperUsageRecord,
  type OrganizationMembership,
  type RedirectMetadata,
  type RevealedCredential,
  type SandboxAccount,
  type TestnetStatusSnapshot,
  type WebhookDelivery,
  type WebhookEndpoint,
  type WebhookEventType,
  type CredentialKind,
} from './types.ts';
import { WebhookDispatcher, type WebhookEvent, type WebhookTransport } from './webhooks.ts';

export type PortalRefusal =
  | 'UNKNOWN_ACCOUNT'
  | 'UNKNOWN_ORGANIZATION'
  | 'UNKNOWN_APPLICATION'
  | 'UNKNOWN_CREDENTIAL'
  | 'UNKNOWN_ENDPOINT'
  | 'FORBIDDEN_ROLE'
  | 'WRONG_SCOPE'
  | 'REVOKED_CREDENTIAL'
  | 'PUBLIC_CLIENT_CANNOT_READ_SECRET'
  | 'API_KEY_CANNOT_SIGN'
  | 'PRODUCTION_APPROVAL_REQUIRED'
  | 'PRODUCTION_NOT_ACTIVATED'
  | 'SANDBOX_IDENTITY'
  | 'SSRF_REJECTED'
  | 'QUOTA_EXCEEDED'
  | 'FAUCET_REJECTED'
  | 'UNAUTHORIZED_EVENT'
  | 'NOT_PROTOCOL_GOVERNANCE';

export type PortalResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: PortalRefusal; readonly detail?: string };

const PRODUCTION_DEFAULT_STATUS: ApplicationStatus = 'PENDING_PRODUCTION_APPROVAL';

export class DeveloperPlatformEngine {
  readonly billing: DeveloperBillingPort;
  readonly quotas: QuotaLedger;
  readonly faucet: DeveloperFaucet;
  readonly webhooks: WebhookDispatcher;
  private readonly accounts = new Map<string, DeveloperAccount>();
  private readonly orgs = new Map<string, DeveloperOrganization>();
  private readonly memberships = new Map<string, OrganizationMembership>();
  private readonly apps = new Map<string, DeveloperApplication>();
  private readonly credentials = new Map<string, DeveloperApiCredential>();
  private readonly revealed = new Set<string>();
  private readonly plaintextSecrets = new Map<string, string>();
  private readonly endpoints = new Map<string, WebhookEndpoint>();
  private readonly webhookSecrets = new Map<string, string>();
  private readonly sandboxes = new Map<string, SandboxAccount>();
  private readonly audit: DeveloperAuditEntry[] = [];
  private readonly rpcUp: boolean;
  private readonly explorerUp: boolean;

  constructor(input: {
    readonly billing?: DeveloperBillingPort;
    readonly faucet?: DeveloperFaucet;
    readonly transport?: WebhookTransport;
    readonly rpcUp?: boolean;
    readonly explorerUp?: boolean;
  } = {}) {
    this.billing = input.billing ?? createSimulationBillingPort();
    this.quotas = new QuotaLedger(this.billing);
    this.faucet = input.faucet ?? new DeveloperFaucet();
    this.webhooks = new WebhookDispatcher({
      policy: DEFAULT_WEBHOOK_RETRY_POLICY,
      transport: input.transport,
    });
    this.rpcUp = input.rpcUp ?? true;
    this.explorerUp = input.explorerUp ?? true;
  }

  now(): string {
    return new Date().toISOString();
  }

  registerDeveloper(input: { readonly email: string; readonly displayName: string }): DeveloperAccount {
    const account: DeveloperAccount = {
      accountId: `devacc_${randomUUID()}`,
      email: input.email,
      displayName: input.displayName,
      createdAt: this.now(),
      status: 'ACTIVE',
    };
    this.accounts.set(account.accountId, account);
    return account;
  }

  createOrganization(input: {
    readonly name: string;
    readonly ownerAccountId: string;
  }): PortalResult<DeveloperOrganization> {
    const owner = this.accounts.get(input.ownerAccountId);
    if (!owner) {
      return { ok: false, reason: 'UNKNOWN_ACCOUNT' };
    }
    const organization: DeveloperOrganization = {
      organizationId: `devorg_${randomUUID()}`,
      name: input.name,
      ownerAccountId: owner.accountId,
      createdAt: this.now(),
    };
    this.orgs.set(organization.organizationId, organization);
    this.memberships.set(this.memberKey(organization.organizationId, owner.accountId), {
      organizationId: organization.organizationId,
      accountId: owner.accountId,
      role: 'OWNER',
    });
    this.recordAudit(owner.accountId, organization.organizationId, 'ORG_CREATE', organization.organizationId, {
      name: organization.name,
    });
    return { ok: true, value: organization };
  }

  addMember(input: {
    readonly actorAccountId: string;
    readonly organizationId: string;
    readonly accountId: string;
    readonly role: DeveloperRole | string;
  }): PortalResult<OrganizationMembership> {
    try {
      assertNotProtocolGovernanceRole(input.role);
    } catch {
      return { ok: false, reason: 'NOT_PROTOCOL_GOVERNANCE' };
    }
    const gate = this.requireRole(input.actorAccountId, input.organizationId, 'ADMIN');
    if (!gate.ok) {
      return gate;
    }
    if (!this.accounts.has(input.accountId)) {
      return { ok: false, reason: 'UNKNOWN_ACCOUNT' };
    }
    const membership: OrganizationMembership = {
      organizationId: input.organizationId,
      accountId: input.accountId,
      role: input.role,
    };
    this.memberships.set(this.memberKey(input.organizationId, input.accountId), membership);
    this.recordAudit(input.actorAccountId, input.organizationId, 'MEMBER_ADD', input.accountId, { role: input.role });
    return { ok: true, value: membership };
  }

  createApplication(input: {
    readonly actorAccountId: string;
    readonly organizationId: string;
    readonly name: string;
    readonly environment: ApplicationEnvironment;
    readonly permissions: readonly DeveloperPermission[];
    readonly redirect?: RedirectMetadata;
  }): PortalResult<DeveloperApplication> {
    const gate = this.requireRole(input.actorAccountId, input.organizationId, 'DEVELOPER');
    if (!gate.ok) {
      return gate;
    }
    const status = input.environment === 'PRODUCTION' ? PRODUCTION_DEFAULT_STATUS : 'ACTIVE';
    const app: DeveloperApplication = {
      appId: `app_${randomUUID()}`,
      organizationId: input.organizationId,
      name: input.name,
      environment: input.environment,
      status,
      permissions: Object.freeze([...input.permissions]),
      redirect: input.redirect ?? { redirectUris: [], callbackUris: [] },
      productionFinancialCapabilitiesActivated: false,
      createdAt: this.now(),
    };
    this.apps.set(app.appId, app);
    this.quotas.defaultFor(app.appId, app.environment);
    this.recordAudit(input.actorAccountId, input.organizationId, 'APP_CREATE', app.appId, {
      environment: app.environment,
      status: app.status,
    });
    return { ok: true, value: app };
  }

  listApplications(input: { readonly actorAccountId: string; readonly organizationId: string }): PortalResult<readonly DeveloperApplication[]> {
    const gate = this.requireRole(input.actorAccountId, input.organizationId, 'VIEWER');
    if (!gate.ok) {
      return gate;
    }
    return {
      ok: true,
      value: [...this.apps.values()].filter((app) => app.organizationId === input.organizationId),
    };
  }

  approveProductionApplication(input: {
    readonly actorAccountId: string;
    readonly appId: string;
  }): PortalResult<DeveloperApplication> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const gate = this.requireRole(input.actorAccountId, app.organizationId, 'ADMIN');
    if (!gate.ok) {
      return gate;
    }
    if (app.environment !== 'PRODUCTION') {
      return { ok: false, reason: 'PRODUCTION_APPROVAL_REQUIRED' };
    }
    const next: DeveloperApplication = { ...app, status: 'ACTIVE', productionFinancialCapabilitiesActivated: false };
    this.apps.set(app.appId, next);
    this.recordAudit(input.actorAccountId, app.organizationId, 'APP_PRODUCTION_APPROVE', app.appId, {
      financial_activated: 'false',
    });
    return { ok: true, value: next };
  }

  createCredential(input: {
    readonly actorAccountId: string;
    readonly appId: string;
    readonly kind: CredentialKind;
    readonly scopes: readonly DeveloperPermission[];
  }): PortalResult<RevealedCredential> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayManageCredentials(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    if (app.environment === 'PRODUCTION' && app.status !== 'ACTIVE') {
      return { ok: false, reason: 'PRODUCTION_APPROVAL_REQUIRED' };
    }
    for (const scope of input.scopes) {
      if (!app.permissions.includes(scope)) {
        return { ok: false, reason: 'WRONG_SCOPE', detail: scope };
      }
    }
    const plaintext = input.kind === 'PUBLIC_CLIENT' ? `pk_${randomSecret(16)}` : `sk_${randomSecret(32)}`;
    const credential: DeveloperApiCredential = {
      credentialId: `key_${randomUUID()}`,
      appId: app.appId,
      kind: input.kind,
      publicKeyId: `kid_${randomUUID()}`,
      secretHash: hashSecret(plaintext),
      secretHint: secretHint(plaintext),
      scopes: Object.freeze([...input.scopes]),
      status: 'ACTIVE',
      environment: app.environment,
      createdAt: this.now(),
      revokedAt: null,
    };
    this.credentials.set(credential.credentialId, credential);
    this.plaintextSecrets.set(credential.credentialId, plaintext);
    this.revealed.add(credential.credentialId);
    this.recordAudit(input.actorAccountId, app.organizationId, 'KEY_CREATE', credential.credentialId, {
      kind: credential.kind,
      hint: credential.secretHint,
    });
    return { ok: true, value: { credential, plaintextSecret: plaintext, revealedOnce: true } };
  }

  revealSecret(input: {
    readonly actorAccountId: string;
    readonly credentialId: string;
    readonly kind: CredentialKind;
  }): PortalResult<string> {
    const credential = this.credentials.get(input.credentialId);
    if (!credential) {
      return { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
    }
    if (input.kind === 'PUBLIC_CLIENT' || credential.kind === 'PUBLIC_CLIENT') {
      return { ok: false, reason: 'PUBLIC_CLIENT_CANNOT_READ_SECRET' };
    }
    if (this.revealed.has(credential.credentialId)) {
      return { ok: false, reason: 'PUBLIC_CLIENT_CANNOT_READ_SECRET', detail: 'already_revealed' };
    }
    const app = this.apps.get(credential.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayManageCredentials(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const secret = this.plaintextSecrets.get(credential.credentialId);
    if (!secret) {
      return { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
    }
    this.revealed.add(credential.credentialId);
    this.plaintextSecrets.delete(credential.credentialId);
    this.recordAudit(input.actorAccountId, app.organizationId, 'KEY_REVEAL', credential.credentialId, {
      hint: credential.secretHint,
    });
    return { ok: true, value: secret };
  }

  authenticate(input: {
    readonly credentialId: string;
    readonly secret: string;
    readonly scope: DeveloperPermission;
  }): PortalResult<DeveloperApiCredential> {
    const credential = this.credentials.get(input.credentialId);
    if (!credential) {
      return { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
    }
    if (credential.status !== 'ACTIVE') {
      return { ok: false, reason: 'REVOKED_CREDENTIAL' };
    }
    if (hashSecret(input.secret) !== credential.secretHash) {
      return { ok: false, reason: 'REVOKED_CREDENTIAL', detail: 'hash_mismatch' };
    }
    if (!credentialHasScope(credential.scopes, input.scope)) {
      return { ok: false, reason: 'WRONG_SCOPE' };
    }
    const quota = this.quotas.consume({
      appId: credential.appId,
      environment: credential.environment,
      scope: input.scope,
    });
    if (quota.decision === 'EXCEEDED') {
      return { ok: false, reason: 'QUOTA_EXCEEDED' };
    }
    return { ok: true, value: credential };
  }

  signUserTransactionWithApiKey(_credentialId: string): PortalResult<never> {
    return { ok: false, reason: 'API_KEY_CANNOT_SIGN' };
  }

  revokeCredential(input: { readonly actorAccountId: string; readonly credentialId: string }): PortalResult<DeveloperApiCredential> {
    const credential = this.credentials.get(input.credentialId);
    if (!credential) {
      return { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
    }
    const app = this.apps.get(credential.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayManageCredentials(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const next: DeveloperApiCredential = {
      ...credential,
      status: 'REVOKED',
      revokedAt: this.now(),
    };
    this.credentials.set(credential.credentialId, next);
    this.plaintextSecrets.delete(credential.credentialId);
    this.recordAudit(input.actorAccountId, app.organizationId, 'KEY_REVOKE', credential.credentialId, {
      hint: credential.secretHint,
    });
    return { ok: true, value: next };
  }

  rotateCredential(input: { readonly actorAccountId: string; readonly credentialId: string }): PortalResult<RevealedCredential> {
    const revoked = this.revokeCredential(input);
    if (!revoked.ok) {
      return revoked;
    }
    const rotated = this.credentials.get(input.credentialId);
    if (rotated) {
      this.credentials.set(input.credentialId, { ...rotated, status: 'ROTATED' });
    }
    return this.createCredential({
      actorAccountId: input.actorAccountId,
      appId: revoked.value.appId,
      kind: revoked.value.kind,
      scopes: revoked.value.scopes,
    });
  }

  changePermissions(input: {
    readonly actorAccountId: string;
    readonly appId: string;
    readonly permissions: readonly DeveloperPermission[];
  }): PortalResult<DeveloperApplication> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayMutateApplication(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const next: DeveloperApplication = { ...app, permissions: Object.freeze([...input.permissions]) };
    this.apps.set(app.appId, next);
    this.recordAudit(input.actorAccountId, app.organizationId, 'APP_PERMISSIONS', app.appId, {
      scopes: input.permissions.join(','),
    });
    return { ok: true, value: next };
  }

  addWebhook(input: {
    readonly actorAccountId: string;
    readonly appId: string;
    readonly url: string;
    readonly events: readonly WebhookEventType[];
  }): PortalResult<{ readonly endpoint: WebhookEndpoint; readonly signingSecret: string }> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayMutateApplication(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const destination = inspectWebhookDestination(input.url, {
      environment: app.environment,
      allowLocalMock: app.environment === 'LOCAL' || app.environment === 'SANDBOX',
    });
    if (!destination.ok) {
      return { ok: false, reason: 'SSRF_REJECTED', detail: destination.reason };
    }
    for (const event of input.events) {
      if (!eventAuthorizedForScopes(event, app.permissions)) {
        return { ok: false, reason: 'UNAUTHORIZED_EVENT', detail: event };
      }
    }
    const signingSecret = `whsec_${randomSecret(32)}`;
    const endpoint: WebhookEndpoint = {
      endpointId: `whe_${randomUUID()}`,
      appId: app.appId,
      url: input.url,
      events: Object.freeze([...input.events]),
      signingKeyHash: hashSecret(signingSecret),
      signingKeyHint: secretHint(signingSecret),
      schemeVersion: 'sunrey-webhook-v1',
      active: true,
      createdAt: this.now(),
    };
    this.endpoints.set(endpoint.endpointId, endpoint);
    this.webhookSecrets.set(endpoint.endpointId, signingSecret);
    this.webhooks.rememberSecret(endpoint.endpointId, signingSecret);
    this.recordAudit(input.actorAccountId, app.organizationId, 'WEBHOOK_ADD', endpoint.endpointId, {
      hint: endpoint.signingKeyHint,
    });
    return { ok: true, value: { endpoint, signingSecret } };
  }

  rotateWebhookKey(input: {
    readonly actorAccountId: string;
    readonly endpointId: string;
  }): PortalResult<{ readonly endpoint: WebhookEndpoint; readonly signingSecret: string }> {
    const endpoint = this.endpoints.get(input.endpointId);
    if (!endpoint) {
      return { ok: false, reason: 'UNKNOWN_ENDPOINT' };
    }
    const app = this.apps.get(endpoint.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayManageCredentials(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const signingSecret = `whsec_${randomSecret(32)}`;
    const next: WebhookEndpoint = {
      ...endpoint,
      signingKeyHash: hashSecret(signingSecret),
      signingKeyHint: secretHint(signingSecret),
    };
    this.endpoints.set(endpoint.endpointId, next);
    this.webhookSecrets.set(endpoint.endpointId, signingSecret);
    this.webhooks.rememberSecret(endpoint.endpointId, signingSecret);
    this.recordAudit(input.actorAccountId, app.organizationId, 'WEBHOOK_KEY_ROTATE', endpoint.endpointId, {
      hint: next.signingKeyHint,
    });
    return { ok: true, value: { endpoint: next, signingSecret } };
  }

  async deliverAuthorizedEvent(input: {
    readonly appId: string;
    readonly event: Omit<WebhookEvent, 'appId'>;
  }): Promise<PortalResult<WebhookDelivery>> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const endpoints = [...this.endpoints.values()].filter((row) => row.appId === app.appId && row.active);
    let last: WebhookDelivery | undefined;
    for (const endpoint of endpoints) {
      const delivered = await this.webhooks.dispatch({
        endpoint,
        event: { ...input.event, appId: app.appId },
        environment: app.environment,
        scopes: app.permissions,
        allowLocalMock: app.environment === 'LOCAL' || app.environment === 'SANDBOX',
      });
      if ('rejected' in delivered) {
        if (delivered.rejected === 'UNAUTHORIZED_EVENT') {
          return { ok: false, reason: 'UNAUTHORIZED_EVENT' };
        }
        return { ok: false, reason: 'SSRF_REJECTED', detail: delivered.rejected };
      }
      last = delivered;
      this.quotas.consume({
        appId: app.appId,
        environment: app.environment,
        scope: 'WEBHOOK_MANAGE',
        webhookDeliveries: 1,
      });
    }
    if (!last) {
      return { ok: false, reason: 'UNKNOWN_ENDPOINT' };
    }
    return { ok: true, value: last };
  }

  testWebhook(input: { readonly actorAccountId: string; readonly endpointId: string }): Promise<PortalResult<WebhookDelivery>> {
    const endpoint = this.endpoints.get(input.endpointId);
    if (!endpoint) {
      return Promise.resolve({ ok: false, reason: 'UNKNOWN_ENDPOINT' });
    }
    return this.deliverAuthorizedEvent({
      appId: endpoint.appId,
      event: {
        eventId: `evt_test_${randomUUID()}`,
        eventType: endpoint.events[0] ?? 'transaction.finalized',
        occurredAt: this.now(),
        payload: { test: 'true' },
      },
    });
  }

  createSandbox(input: {
    readonly actorAccountId: string;
    readonly appId: string;
    readonly label: string;
  }): PortalResult<SandboxAccount> {
    const app = this.apps.get(input.appId);
    if (!app) {
      return { ok: false, reason: 'UNKNOWN_APPLICATION' };
    }
    const membership = this.memberships.get(this.memberKey(app.organizationId, input.actorAccountId));
    if (!membership || !roleMayMutateApplication(membership.role)) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const created = createSandboxAccount({
      appId: app.appId,
      label: input.label,
      environment: app.environment === 'LOCAL' ? 'LOCAL' : 'SANDBOX',
      now: this.now(),
    });
    this.sandboxes.set(created.account.sandboxId, created.account);
    this.recordAudit(input.actorAccountId, app.organizationId, 'SANDBOX_CREATE', created.account.sandboxId, {
      identity_class: 'SANDBOX',
    });
    return { ok: true, value: created.account };
  }

  promoteSandbox(sandboxId: string): PortalResult<never> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return { ok: false, reason: 'SANDBOX_IDENTITY' };
    }
    const refused = sandboxCannotBecomeProduction(sandbox);
    return { ok: false, reason: refused.reason };
  }

  requestFaucet(input: {
    readonly credentialId: string;
    readonly secret: string;
  } & Omit<DeveloperFaucetRequest, 'appId'>): PortalResult<{ readonly txId: string; readonly networkId: string }> {
    const auth = this.authenticate({
      credentialId: input.credentialId,
      secret: input.secret,
      scope: 'FAUCET_REQUEST',
    });
    if (!auth.ok) {
      return auth;
    }
    const quota = this.quotas.consume({
      appId: auth.value.appId,
      environment: auth.value.environment,
      scope: 'FAUCET_REQUEST',
      faucetQuantity: input.quantity,
    });
    if (quota.decision === 'EXCEEDED') {
      return { ok: false, reason: 'QUOTA_EXCEEDED' };
    }
    const issued = this.faucet.request({ ...input, appId: auth.value.appId });
    if (!issued.ok) {
      return { ok: false, reason: issued.reason === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'FAUCET_REJECTED', detail: issued.reason };
    }
    return { ok: true, value: { txId: issued.txId, networkId: issued.networkId } };
  }

  usage(appId: string): readonly DeveloperUsageRecord[] {
    return this.quotas.recordsFor(appId);
  }

  quota(appId: string, environment: ApplicationEnvironment): DeveloperQuota {
    return this.quotas.defaultFor(appId, environment);
  }

  status(): TestnetStatusSnapshot {
    return Object.freeze({
      network: 'net_sunrey_testnet_1',
      chain: 'chn_sunrey_testnet_1',
      faucetAvailability: this.faucet.status(),
      rpcStatus: this.rpcUp ? 'UP' : 'DOWN',
      explorerStatus: this.explorerUp ? 'UP' : 'DOWN',
      environment: 'simulation',
      productionFinancialCapabilitiesActivated: false,
    });
  }

  auditLog(organizationId: string): readonly DeveloperAuditEntry[] {
    return this.audit.filter((row) => row.organizationId === organizationId);
  }

  getApplication(appId: string): DeveloperApplication | undefined {
    return this.apps.get(appId);
  }

  getCredential(credentialId: string): DeveloperApiCredential | undefined {
    return this.credentials.get(credentialId);
  }

  getEndpoint(endpointId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  webhookSigningSecret(endpointId: string): string | undefined {
    return this.webhookSecrets.get(endpointId);
  }

  membershipOf(organizationId: string, accountId: string): OrganizationMembership | undefined {
    return this.memberships.get(this.memberKey(organizationId, accountId));
  }

  private requireRole(
    actorAccountId: string,
    organizationId: string,
    required: DeveloperRole,
  ): PortalResult<OrganizationMembership> {
    if (!this.orgs.has(organizationId)) {
      return { ok: false, reason: 'UNKNOWN_ORGANIZATION' };
    }
    const membership = this.memberships.get(this.memberKey(organizationId, actorAccountId));
    if (!membership) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    const ok =
      required === 'VIEWER'
        ? roleMayView(membership.role)
        : required === 'DEVELOPER'
          ? roleMayMutateApplication(membership.role)
          : required === 'ADMIN' || required === 'OWNER'
            ? roleMayManageCredentials(membership.role)
            : false;
    if (!ok) {
      return { ok: false, reason: 'FORBIDDEN_ROLE' };
    }
    return { ok: true, value: membership };
  }

  private memberKey(organizationId: string, accountId: string): string {
    return `${organizationId}:${accountId}`;
  }

  private recordAudit(
    actorAccountId: string,
    organizationId: string,
    action: string,
    targetId: string,
    details: Readonly<Record<string, string>>,
  ): void {
    const serialized = JSON.stringify(details);
    if (/sk_|whsec_|pk_live|privateKey|plaintext/.test(serialized)) {
      throw new Error('audit log must not contain secret values');
    }
    this.audit.push({
      auditId: `aud_${randomUUID()}`,
      at: this.now(),
      actorAccountId,
      organizationId,
      action,
      targetId,
      details,
    });
  }
}
