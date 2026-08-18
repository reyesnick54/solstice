/**
 * Wallet security engine.
 *
 * Application security (devices, sessions, passkeys, recovery policy,
 * spend controls) sits beside the Chunk 46 WalletEngine. It never
 * becomes a second native-asset ledger and never exposes self-custody
 * private keys to SunRey application servers.
 */

import { createHash, randomBytes } from 'node:crypto';

import { parseAddress } from '../address.ts';
import { containsPrivateMaterial } from '../keys.ts';
import type { BuiltTransaction, DelegatedKeyLimit, WalletDescriptor, WalletType } from '../types.ts';
import { WALLET_TYPES } from '../types.ts';
import { DevelopmentPasskeyAuthenticator, passkeyIsNotNativeKey } from './passkeys.ts';
import { BACKUP_MODELS, InMemorySecureLocalStorage } from './storage.ts';
import type {
  DestinationTrustState,
  HighRiskCategory,
  LostDeviceWorkflowResult,
  SigningIntent,
  TransactionPreview,
  TransactionRequirementKind,
  ValidatedAddress,
  WalletAuthMethod,
  WalletAuthorizationPolicy,
  WalletAuthenticationPolicy,
  WalletCustodyClass,
  WalletDelegatedKeyBinding,
  WalletDestinationPolicy,
  WalletDestinationRecord,
  WalletDeviceBinding,
  WalletDeviceTrustState,
  WalletKeyRotationPlan,
  WalletRecoveryApproval,
  WalletRecoveryPolicy,
  WalletRecoveryRequest,
  WalletRiskChallenge,
  WalletSecurityAuditReport,
  WalletSecurityEvent,
  WalletSecurityNotificationHook,
  WalletSecurityProfile,
  WalletSecurityRejection,
  WalletSession,
  WalletSessionPolicy,
  WalletSessionScope,
  WalletSpendControl,
  WalletTransactionPolicy,
  WalletTrustedDevice,
} from './types.ts';
import { WALLET_SECURITY_SCHEMA_VERSION } from './types.ts';

export type AttachWalletInput = {
  readonly wallet: WalletDescriptor;
  readonly custodyClass: WalletCustodyClass;
  readonly identityRef: string;
  readonly environment?: string;
};

const DEFAULT_AUTH: WalletAuthenticationPolicy = Object.freeze({
  schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
  allowedMethods: Object.freeze(['PASSKEY', 'DEVICE', 'APPROVED_MFA', 'RECOVERY'] as const),
  requireMfaForHighRisk: true,
  passkeyAuthenticatesSessionOnly: true,
  loginIsNotNativeSigning: true,
});

function later(now: string, ms: bigint | number): string {
  return new Date(Date.parse(now) + Number(ms)).toISOString();
}

function hashHex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function defaultRequirements(custodyClass: WalletCustodyClass): readonly TransactionRequirementKind[] {
  if (custodyClass === 'INSTITUTIONAL_CUSTODY') {
    return Object.freeze(['NORMAL_USER_SIGNATURE', 'CUSTODY_APPROVAL']);
  }
  if (custodyClass === 'MACHINE_CONTROLLED' || custodyClass === 'DELEGATED_AGENT') {
    return Object.freeze(['NORMAL_USER_SIGNATURE']);
  }
  return Object.freeze(['NORMAL_USER_SIGNATURE']);
}

function highRiskRequirements(custodyClass: WalletCustodyClass): readonly TransactionRequirementKind[] {
  const base: TransactionRequirementKind[] = [
    'NORMAL_USER_SIGNATURE',
    'ADDITIONAL_APPLICATION_AUTHENTICATION',
    'TRUSTED_DESTINATION_CONFIRMATION',
  ];
  if (custodyClass === 'INSTITUTIONAL_CUSTODY') {
    base.push('CUSTODY_APPROVAL', 'SECOND_HUMAN_APPROVER', 'DELAYED_REVIEW');
  }
  if (custodyClass === 'ASSISTED_SELF_CUSTODY') {
    base.push('SECOND_DEVICE');
  }
  return Object.freeze(base);
}

function compatible(walletType: WalletType, custodyClass: WalletCustodyClass): boolean {
  if (walletType === 'WATCH_ONLY') {
    return false;
  }
  if (custodyClass === 'MACHINE_CONTROLLED') {
    return walletType === 'MACHINE';
  }
  if (custodyClass === 'INSTITUTIONAL_CUSTODY') {
    return walletType === 'INSTITUTIONAL' || walletType === 'ENTERPRISE';
  }
  if (custodyClass === 'DELEGATED_AGENT') {
    return walletType === 'HUMAN' || walletType === 'MACHINE' || walletType === 'ENTERPRISE';
  }
  return walletType === 'HUMAN' || walletType === 'ENTERPRISE';
}

export class WalletSecurityEngine {
  readonly passkeys = new DevelopmentPasskeyAuthenticator();
  readonly localStorage = new InMemorySecureLocalStorage();
  readonly backupModels = BACKUP_MODELS;
  now = '2026-08-18T00:00:00.000Z';

  private readonly profiles = new Map<string, WalletSecurityProfile>();
  private readonly devices = new Map<string, WalletDeviceBinding[]>();
  private readonly sessions = new Map<string, WalletSession[]>();
  private readonly destinations = new Map<string, WalletDestinationPolicy>();
  private readonly recoveries = new Map<string, WalletRecoveryPolicy>();
  private readonly recoveryRequests = new Map<string, WalletRecoveryRequest>();
  private readonly rotations = new Map<string, WalletKeyRotationPlan[]>();
  private readonly delegations = new Map<string, WalletDelegatedKeyBinding[]>();
  private readonly events = new Map<string, WalletSecurityEvent[]>();
  private readonly challenges = new Map<string, WalletRiskChallenge[]>();
  private readonly approvals = new Map<string, { readonly intent: SigningIntent; readonly hash: string }>();
  private readonly finalizedTransfers = new Set<string>();
  private readonly signingAuthorities = new Map<string, string[]>();
  private readonly serverKeystore = new Map<string, never>();

  attachWallet(input: AttachWalletInput): WalletSecurityProfile | WalletSecurityRejection {
    if (!WALLET_TYPES.includes(input.wallet.walletType)) {
      return { ok: false, code: 'CLASS_CONVERSION_FORBIDDEN', detail: 'unknown wallet type' };
    }
    if (!compatible(input.wallet.walletType, input.custodyClass)) {
      return {
        ok: false,
        code: 'CLASS_CONVERSION_FORBIDDEN',
        detail: `cannot attach ${input.custodyClass} to ${input.wallet.walletType}`,
      };
    }
    const existing = this.profiles.get(input.wallet.walletId);
    if (existing && existing.custodyClass !== input.custodyClass) {
      return { ok: false, code: 'CLASS_CONVERSION_FORBIDDEN', detail: 'wallet custody class is locked' };
    }
    const environment = input.environment ?? input.wallet.networkId;
    const authorization: WalletAuthorizationPolicy = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      custodyClass: input.custodyClass,
      defaultRequirements: defaultRequirements(input.custodyClass),
      highRiskRequirements: highRiskRequirements(input.custodyClass),
      allowDelegatedMaster: false,
    });
    const sessionPolicy: WalletSessionPolicy = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      allowedScopes: Object.freeze([
        'READ_ONLY',
        'TRANSACTION_PREVIEW',
        'TRANSACTION_APPROVAL',
        'TRADING',
        'PROFILE_MANAGEMENT',
        'RECOVERY_ADMIN',
      ] as const),
      ttlMs: 8n * 60n * 60n * 1000n,
      environment,
      revokeDoesNotRewriteChain: true,
    });
    const transactionPolicy: WalletTransactionPolicy = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      custodyClass: input.custodyClass,
      spendControls: Object.freeze([]),
      largeQuantityThreshold: 100_000n,
      requireTrustedDestinationConfirmation: true,
    });
    const profile: WalletSecurityProfile = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      walletId: input.wallet.walletId,
      ownerActorId: input.wallet.ownerActorId,
      identityRef: input.identityRef,
      walletType: input.wallet.walletType,
      custodyClass: input.custodyClass,
      networkId: input.wallet.networkId,
      environment,
      authenticationPolicy: DEFAULT_AUTH,
      authorizationPolicy: authorization,
      sessionPolicy,
      transactionPolicy,
      destinationPolicyVersion: 1,
      recoveryPolicyVersion: null,
      classLocked: true,
    });
    this.profiles.set(profile.walletId, profile);
    this.destinations.set(profile.walletId, Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      walletId: profile.walletId,
      version: 1,
      destinations: Object.freeze([]),
    }));
    this.signingAuthorities.set(profile.walletId, [`${profile.walletId}.key.1`]);
    return profile;
  }

  getWalletSecurityProfile(walletId: string): WalletSecurityProfile | undefined {
    return this.profiles.get(walletId);
  }

  getWalletDevices(walletId: string): readonly WalletDeviceBinding[] {
    return this.devices.get(walletId) ?? [];
  }

  getWalletSessions(walletId: string): readonly WalletSession[] {
    return this.sessions.get(walletId) ?? [];
  }

  getWalletPolicies(walletId: string): {
    readonly authentication: WalletAuthenticationPolicy;
    readonly authorization: WalletAuthorizationPolicy;
    readonly session: WalletSessionPolicy;
    readonly transaction: WalletTransactionPolicy;
    readonly destination: WalletDestinationPolicy | undefined;
    readonly recovery: WalletRecoveryPolicy | undefined;
  } | undefined {
    const profile = this.profiles.get(walletId);
    if (!profile) {
      return undefined;
    }
    return {
      authentication: profile.authenticationPolicy,
      authorization: profile.authorizationPolicy,
      session: profile.sessionPolicy,
      transaction: profile.transactionPolicy,
      destination: this.destinations.get(walletId),
      recovery: this.recoveries.get(walletId),
    };
  }

  getDelegations(walletId: string): readonly WalletDelegatedKeyBinding[] {
    return this.delegations.get(walletId) ?? [];
  }

  getRecoveryState(walletId: string): {
    readonly policy: WalletRecoveryPolicy | undefined;
    readonly pending: readonly WalletRecoveryRequest[];
  } {
    return {
      policy: this.recoveries.get(walletId),
      pending: [...this.recoveryRequests.values()].filter((row) => row.walletId === walletId),
    };
  }

  trustedDevices(walletId: string): readonly WalletTrustedDevice[] {
    return this.getWalletDevices(walletId)
      .filter((device) => device.trustState === 'TRUSTED' || device.trustState === 'VERIFIED')
      .map((device) =>
        Object.freeze({
          deviceId: device.deviceId,
          walletId: device.walletId,
          trustState: device.trustState as WalletTrustedDevice['trustState'],
          publicDescriptor: device.devicePublicDescriptor,
        }),
      );
  }

  registerDevice(input: {
    readonly walletId: string;
    readonly deviceId: string;
    readonly publicDescriptor: string;
    readonly platformClass: WalletDeviceBinding['devicePlatformClass'];
    readonly evidence: string;
  }): WalletDeviceBinding | WalletSecurityRejection {
    const profile = this.requireProfile(input.walletId);
    if ('ok' in profile) {
      return profile;
    }
    if (containsPrivateMaterial(input.publicDescriptor) || containsPrivateMaterial(input.evidence)) {
      return { ok: false, code: 'PRIVATE_KEY_EXPOSURE', detail: 'device registration accepts public descriptors only' };
    }
    const binding: WalletDeviceBinding = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      bindingId: `bind.${input.walletId}.${input.deviceId}`,
      deviceId: input.deviceId,
      walletId: input.walletId,
      devicePublicDescriptor: input.publicDescriptor,
      devicePlatformClass: input.platformClass,
      registrationState: 'REGISTERED',
      trustState: 'NEW',
      firstRegistrationEvidence: input.evidence,
      lastAuthenticationAt: null,
      lastAuthenticationMethod: null,
      revocationState: 'ACTIVE',
      revokedAt: null,
    });
    this.devices.set(input.walletId, [...this.getWalletDevices(input.walletId), binding]);
    this.record(input.walletId, 'NEW_DEVICE', `device ${input.deviceId} registered`);
    return binding;
  }

  setDeviceTrust(
    walletId: string,
    deviceId: string,
    trustState: WalletDeviceTrustState,
  ): WalletDeviceBinding | WalletSecurityRejection {
    const current = this.deviceOf(walletId, deviceId);
    if (!current) {
      return { ok: false, code: 'REVOKED_DEVICE', detail: 'device is not bound to this wallet' };
    }
    if (current.revocationState === 'REVOKED' && trustState !== 'REVOKED') {
      return { ok: false, code: 'REVOKED_DEVICE', detail: 'revoked device cannot be re-trusted in place' };
    }
    const next: WalletDeviceBinding = Object.freeze({
      ...current,
      trustState,
      registrationState: trustState === 'REVOKED' ? 'REVOKED' : current.registrationState,
      revocationState: trustState === 'REVOKED' ? 'REVOKED' : current.revocationState,
      revokedAt: trustState === 'REVOKED' ? this.now : current.revokedAt,
    });
    this.replaceDevice(next);
    return next;
  }

  authenticateSession(input: {
    readonly walletId: string;
    readonly identityRef: string;
    readonly deviceId: string;
    readonly method: WalletAuthMethod;
    readonly scope: WalletSessionScope;
    readonly environment?: string;
    readonly passkeyCredentialId?: string;
  }): WalletSession | WalletSecurityRejection {
    const profile = this.requireProfile(input.walletId);
    if ('ok' in profile) {
      return profile;
    }
    if (input.identityRef !== profile.identityRef) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'session identity does not match the wallet identity reference' };
    }
    if (!profile.authenticationPolicy.allowedMethods.includes(input.method)) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'authentication method is not permitted' };
    }
    if (!profile.sessionPolicy.allowedScopes.includes(input.scope)) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'session scope is not permitted' };
    }
    const device = this.deviceOf(input.walletId, input.deviceId);
    if (!device || device.revocationState === 'REVOKED' || device.trustState === 'REVOKED') {
      return { ok: false, code: 'REVOKED_DEVICE', detail: 'revoked or unknown device cannot open a session' };
    }
    if (device.trustState === 'RESTRICTED' && input.scope !== 'READ_ONLY') {
      return { ok: false, code: 'REVOKED_DEVICE', detail: 'restricted device may only open READ_ONLY sessions' };
    }
    if (input.method === 'PASSKEY') {
      if (!input.passkeyCredentialId || !this.passkeys.getCredential(input.passkeyCredentialId)) {
        return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'passkey credential is required for PASSKEY authentication' };
      }
      passkeyIsNotNativeKey(this.passkeys.getCredential(input.passkeyCredentialId)!);
    }
    const session: WalletSession = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      sessionId: `sess.${randomBytes(8).toString('hex')}`,
      walletId: input.walletId,
      identityRef: input.identityRef,
      deviceId: input.deviceId,
      authenticationMethod: input.method,
      environment: input.environment ?? profile.environment,
      scope: input.scope,
      issuedAt: this.now,
      expiresAt: later(this.now, profile.sessionPolicy.ttlMs),
      riskState: 'CLEAR',
      revocationState: 'ACTIVE',
      grantsNativeSigning: false,
    });
    this.sessions.set(input.walletId, [...this.getWalletSessions(input.walletId), session]);
    this.replaceDevice(
      Object.freeze({
        ...device,
        lastAuthenticationAt: this.now,
        lastAuthenticationMethod: input.method,
      }),
    );
    this.record(input.walletId, 'SESSION_CREATED', `session ${session.sessionId} scope ${session.scope}`);
    return session;
  }

  assertSessionUsable(sessionId: string, requiredScope?: WalletSessionScope): WalletSession | WalletSecurityRejection {
    const session = this.sessionById(sessionId);
    if (!session) {
      return { ok: false, code: 'REVOKED_SESSION', detail: 'session not found' };
    }
    if (session.revocationState !== 'ACTIVE') {
      return { ok: false, code: 'REVOKED_SESSION', detail: 'session is revoked or expired' };
    }
    if (Date.parse(this.now) >= Date.parse(session.expiresAt)) {
      this.mutateSession(session.walletId, session.sessionId, { revocationState: 'EXPIRED' });
      return { ok: false, code: 'REVOKED_SESSION', detail: 'session expired' };
    }
    if (requiredScope && session.scope !== requiredScope && session.scope !== 'TRANSACTION_APPROVAL') {
      return { ok: false, code: 'REVOKED_SESSION', detail: `session scope ${session.scope} cannot satisfy ${requiredScope}` };
    }
    return session;
  }

  sessionCannotSign(sessionId: string): WalletSecurityRejection {
    return {
      ok: false,
      code: 'SESSION_IS_NOT_SIGNING_AUTHORITY',
      detail: `application session ${sessionId} is not native blockchain signing authority`,
    };
  }

  revokeSession(sessionId: string): { readonly ok: true } | WalletSecurityRejection {
    const session = this.sessionById(sessionId);
    if (!session) {
      return { ok: false, code: 'REVOKED_SESSION', detail: 'session not found' };
    }
    this.mutateSession(session.walletId, sessionId, { revocationState: 'REVOKED' });
    this.record(session.walletId, 'SESSION_REVOKED', `session ${sessionId} revoked`);
    return { ok: true };
  }

  revokeDeviceSessions(walletId: string, deviceId: string): number {
    let count = 0;
    for (const session of this.getWalletSessions(walletId)) {
      if (session.deviceId === deviceId && session.revocationState === 'ACTIVE') {
        this.mutateSession(walletId, session.sessionId, { revocationState: 'REVOKED' });
        count += 1;
      }
    }
    if (count > 0) {
      this.record(walletId, 'SESSION_REVOKED', `${count} sessions revoked for device ${deviceId}`);
    }
    return count;
  }

  revokeAllSessions(walletId: string): number {
    let count = 0;
    for (const session of this.getWalletSessions(walletId)) {
      if (session.revocationState === 'ACTIVE') {
        this.mutateSession(walletId, session.sessionId, { revocationState: 'REVOKED' });
        count += 1;
      }
    }
    if (count > 0) {
      this.record(walletId, 'SESSION_REVOKED', `all ${count} sessions revoked`);
    }
    return count;
  }

  validateAddress(text: string, expectedNetworkId: string): ValidatedAddress | WalletSecurityRejection {
    const parsed = parseAddress(text, expectedNetworkId);
    if (parsed.ok === false) {
      return {
        ok: false,
        code: parsed.code === 'WRONG_NETWORK_ADDRESS' ? 'WRONG_NETWORK_ADDRESS' : 'WRONG_NETWORK_ADDRESS',
        detail: parsed.detail,
      };
    }
    if (parsed.address.networkId !== expectedNetworkId) {
      return { ok: false, code: 'WRONG_NETWORK_ADDRESS', detail: 'address network does not match the wallet environment' };
    }
    return {
      text: parsed.address.text,
      networkId: parsed.address.networkId,
      networkClass: parsed.address.networkClass,
      addressClass: parsed.address.addressClass,
      checksumOk: true,
    };
  }

  setDestinationTrust(input: {
    readonly walletId: string;
    readonly addressText: string;
    readonly networkId: string;
    readonly trustState: DestinationTrustState;
    readonly label: string;
    readonly sessionId: string;
  }): WalletDestinationRecord | WalletSecurityRejection {
    const session = this.assertSessionUsable(input.sessionId, 'PROFILE_MANAGEMENT');
    if ('ok' in session) {
      return session;
    }
    const address = this.validateAddress(input.addressText, input.networkId);
    if ('ok' in address) {
      return address;
    }
    const policy = this.destinations.get(input.walletId);
    if (!policy) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'destination policy missing' };
    }
    const destinationId = `dst.${hashHex(input.addressText).slice(0, 16)}`;
    const record: WalletDestinationRecord = Object.freeze({
      destinationId,
      addressText: address.text,
      networkId: address.networkId,
      networkClass: address.networkClass,
      addressClass: address.addressClass,
      trustState: input.trustState,
      label: input.label,
      updatedAt: this.now,
    });
    const nextDestinations = [...policy.destinations.filter((row) => row.destinationId !== destinationId), record];
    this.destinations.set(
      input.walletId,
      Object.freeze({
        ...policy,
        version: policy.version + 1,
        destinations: Object.freeze(nextDestinations),
      }),
    );
    const profile = this.profiles.get(input.walletId);
    if (profile) {
      this.profiles.set(input.walletId, Object.freeze({ ...profile, destinationPolicyVersion: policy.version + 1 }));
    }
    this.record(input.walletId, 'TRUSTED_DESTINATION_CHANGED', `destination ${destinationId} -> ${input.trustState}`);
    return record;
  }

  destinationState(walletId: string, addressText: string): DestinationTrustState {
    const found = this.destinations.get(walletId)?.destinations.find((row) => row.addressText === addressText);
    return found?.trustState ?? 'UNRECOGNIZED';
  }

  setSpendControl(walletId: string, control: Omit<WalletSpendControl, 'schemaVersion' | 'spentInPeriod' | 'periodStartedAt'>): void {
    const profile = this.profiles.get(walletId);
    if (!profile) {
      return;
    }
    const next: WalletSpendControl = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      spentInPeriod: 0n,
      periodStartedAt: this.now,
      ...control,
    });
    this.profiles.set(
      walletId,
      Object.freeze({
        ...profile,
        transactionPolicy: Object.freeze({
          ...profile.transactionPolicy,
          spendControls: Object.freeze([...profile.transactionPolicy.spendControls, next]),
        }),
      }),
    );
  }

  classifyRisk(input: {
    readonly walletId: string;
    readonly destination: string | null;
    readonly quantity: bigint | null;
    readonly family: string;
    readonly categoryHint?: HighRiskCategory;
  }): readonly HighRiskCategory[] {
    const profile = this.profiles.get(input.walletId);
    const categories: HighRiskCategory[] = [];
    if (input.destination && this.destinationState(input.walletId, input.destination) === 'UNRECOGNIZED') {
      categories.push('NEW_DESTINATION');
    }
    if (
      input.quantity !== null &&
      profile?.transactionPolicy.largeQuantityThreshold !== null &&
      profile !== undefined &&
      input.quantity >= (profile.transactionPolicy.largeQuantityThreshold ?? 0n)
    ) {
      categories.push('LARGE_QUANTITY');
    }
    if (input.family === 'CUSTODY_WITHDRAWAL' || input.categoryHint === 'CUSTODY_WITHDRAWAL') {
      categories.push('CUSTODY_WITHDRAWAL');
    }
    if (input.categoryHint && !categories.includes(input.categoryHint)) {
      categories.push(input.categoryHint);
    }
    return Object.freeze(categories);
  }

  evaluateTransaction(input: {
    readonly walletId: string;
    readonly sessionId: string;
    readonly built: BuiltTransaction;
    readonly delegatedKeyId?: string;
    readonly guardianAttempt?: boolean;
  }):
    | { readonly ok: true; readonly preview: TransactionPreview; readonly requirements: readonly TransactionRequirementKind[] }
    | WalletSecurityRejection {
    const profile = this.requireProfile(input.walletId);
    if ('ok' in profile) {
      return profile;
    }
    const session = this.assertSessionUsable(input.sessionId, 'TRANSACTION_PREVIEW');
    if ('ok' in session) {
      return session;
    }
    if (input.guardianAttempt) {
      return { ok: false, code: 'GUARDIAN_CANNOT_SPEND', detail: 'guardian approval is scoped to recovery and cannot spend' };
    }
    if (input.built.networkId !== profile.networkId) {
      return { ok: false, code: 'WRONG_CHAIN_TRANSACTION', detail: 'wrong network cannot authorize' };
    }
    const networkGate = this.testnetKeyCannotAuthorizeProduction(input.built.chainId, profile.networkId);
    if (networkGate.ok === false) {
      return networkGate;
    }
    if (input.built.counterpartyAccountId) {
      const dest = this.destinations.get(input.walletId)?.destinations.find((row) => row.addressText === input.built.counterpartyAccountId);
      if (dest && (dest.trustState === 'RESTRICTED' || dest.trustState === 'REVOKED')) {
        return { ok: false, code: 'DESTINATION_RESTRICTED', detail: `destination is ${dest.trustState}` };
      }
    }
    if (input.delegatedKeyId) {
      const denied = this.enforceDelegatedKey(input.walletId, input.delegatedKeyId, input.built);
      if (denied) {
        return denied;
      }
    }
    const spendDenied = this.enforceSpendControls(profile, input.built);
    if (spendDenied) {
      return spendDenied;
    }
    if (profile.custodyClass === 'INSTITUTIONAL_CUSTODY' && input.built.family === 'NATIVE_ASSET') {
      const custody = this.requireCustodyApproval(input.walletId, input.built);
      if (custody) {
        return custody;
      }
    }
    const risk = this.classifyRisk({
      walletId: input.walletId,
      destination: input.built.counterpartyAccountId,
      quantity: input.built.amount,
      family: input.built.family,
    });
    const requirements =
      risk.length > 0 ? profile.authorizationPolicy.highRiskRequirements : profile.authorizationPolicy.defaultRequirements;
    if (risk.length > 0) {
      const challenge: WalletRiskChallenge = Object.freeze({
        challengeId: `risk.${randomBytes(6).toString('hex')}`,
        walletId: input.walletId,
        category: risk[0]!,
        reason: risk.join(','),
        required: requirements,
        createdAt: this.now,
        resolved: false,
      });
      this.challenges.set(input.walletId, [...(this.challenges.get(input.walletId) ?? []), challenge]);
      this.record(input.walletId, 'HIGH_RISK_TRANSACTION_CHALLENGED', challenge.reason);
    }
    const preview = this.buildTransactionPreview(input.walletId, input.built, requirements);
    return { ok: true, preview, requirements };
  }

  buildSigningIntent(walletId: string, built: BuiltTransaction, requirements: readonly TransactionRequirementKind[]): SigningIntent {
    const intent: SigningIntent = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      intentId: `intent.${built.clientTxId}`,
      walletId,
      assetId: built.assetId,
      quantity: built.amount?.toString() ?? null,
      destination: built.counterpartyAccountId,
      networkFee: built.fee.maximumAuthorizedFee.toString(),
      marketOrContractAction: built.family === 'NATIVE_ASSET' ? null : built.family,
      expectedChainOperation: built.family,
      policyRequirements: Object.freeze([...requirements]),
      networkId: built.networkId,
      chainId: built.chainId,
      transactionHash: built.bodyHash,
      canonicalBytesHash: hashHex(built.signBytesHex),
      humanReadable: [
        `Authorize ${built.family}`,
        built.amount !== null ? `quantity ${built.amount.toString()}` : null,
        built.assetId ? `asset ${built.assetId}` : null,
        built.counterpartyAccountId ? `destination ${built.counterpartyAccountId}` : null,
        `max fee ${built.fee.maximumAuthorizedFee.toString()}`,
        `network ${built.networkId}`,
        `hash ${built.bodyHash}`,
      ]
        .filter(Boolean)
        .join('; '),
    });
    return intent;
  }

  buildTransactionPreview(
    walletId: string,
    built: BuiltTransaction,
    requirements: readonly TransactionRequirementKind[],
  ): TransactionPreview {
    const signingIntent = this.buildSigningIntent(walletId, built, requirements);
    return Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      assetId: built.assetId,
      quantity: built.amount?.toString() ?? null,
      destination: built.counterpartyAccountId,
      networkFee: built.fee.maximumAuthorizedFee.toString(),
      marketOrContractAction: built.family === 'NATIVE_ASSET' ? null : built.family,
      expectedChainOperation: built.family,
      policyRequirements: Object.freeze([...requirements]),
      signingIntent,
    });
  }

  approveSigningIntent(sessionId: string, intent: SigningIntent): { readonly ok: true; readonly approvalHash: string } | WalletSecurityRejection {
    const session = this.assertSessionUsable(sessionId, 'TRANSACTION_APPROVAL');
    if ('ok' in session) {
      return session;
    }
    if (session.grantsNativeSigning !== false) {
      return this.sessionCannotSign(sessionId);
    }
    const approvalHash = hashHex(`${intent.intentId}:${intent.transactionHash}:${intent.canonicalBytesHash}`);
    this.approvals.set(intent.intentId, { intent, hash: approvalHash });
    return { ok: true, approvalHash };
  }

  assertApprovalHolds(intentId: string, candidate: SigningIntent): { readonly ok: true } | WalletSecurityRejection {
    const recorded = this.approvals.get(intentId);
    if (!recorded) {
      return { ok: false, code: 'TAMPERED_SIGNING_INTENT', detail: 'no approval recorded' };
    }
    const fields: Array<keyof SigningIntent> = [
      'destination',
      'quantity',
      'assetId',
      'networkFee',
      'marketOrContractAction',
      'networkId',
      'chainId',
      'transactionHash',
      'canonicalBytesHash',
    ];
    for (const field of fields) {
      if (recorded.intent[field] !== candidate[field]) {
        this.approvals.delete(intentId);
        return { ok: false, code: 'TAMPERED_SIGNING_INTENT', detail: `changing ${field} after approval invalidates the approval` };
      }
    }
    return { ok: true };
  }

  bindDelegatedKey(input: {
    readonly walletId: string;
    readonly keyId: string;
    readonly purpose: string;
    readonly assets: readonly WalletDelegatedKeyBinding['assets'][number][];
    readonly quantityLimit: bigint | null;
    readonly destinations: readonly string[];
    readonly actionClasses: WalletDelegatedKeyBinding['actionClasses'];
    readonly expiresAt: string | null;
    readonly environment: string;
  }): WalletDelegatedKeyBinding | WalletSecurityRejection {
    const profile = this.requireProfile(input.walletId);
    if ('ok' in profile) {
      return profile;
    }
    if (input.purpose.toLowerCase().includes('master') || input.quantityLimit === null && input.destinations.length === 0) {
      if (input.purpose.toLowerCase().includes('master')) {
        return { ok: false, code: 'DELEGATED_MASTER_AUTHORITY_FORBIDDEN', detail: 'a delegated key cannot obtain unrestricted wallet authority' };
      }
    }
    const binding: WalletDelegatedKeyBinding = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      keyId: input.keyId,
      walletId: input.walletId,
      purpose: input.purpose,
      assets: Object.freeze([...input.assets]),
      quantityLimit: input.quantityLimit,
      destinations: Object.freeze([...input.destinations]),
      actionClasses: Object.freeze([...input.actionClasses]),
      expiresAt: input.expiresAt,
      environment: input.environment,
      revocationPolicy: 'OWNER_MAY_REVOKE',
      revoked: false,
      inheritsMasterAuthority: false,
    });
    this.delegations.set(input.walletId, [...(this.delegations.get(input.walletId) ?? []), binding]);
    this.record(input.walletId, 'DELEGATED_KEY_CREATED', `delegated key ${input.keyId} purpose ${input.purpose}`);
    return binding;
  }

  bindExistingDelegation(walletId: string, limit: DelegatedKeyLimit, environment: string): WalletDelegatedKeyBinding {
    const binding = this.bindDelegatedKey({
      walletId,
      keyId: limit.keyId,
      purpose: limit.purpose,
      assets: limit.allowedAsset ? [limit.allowedAsset] : [],
      quantityLimit: limit.maximumAmount,
      destinations: limit.allowedCounterparty ? [limit.allowedCounterparty] : [],
      actionClasses: limit.allowedTransactionTypes,
      expiresAt: null,
      environment,
    });
    if ('ok' in binding) {
      throw new Error(binding.detail);
    }
    return binding;
  }

  revokeDelegatedKey(walletId: string, keyId: string): { readonly ok: true } | WalletSecurityRejection {
    const list = this.delegations.get(walletId) ?? [];
    const found = list.find((row) => row.keyId === keyId);
    if (!found) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'delegated key not found' };
    }
    this.delegations.set(
      walletId,
      list.map((row) => (row.keyId === keyId ? Object.freeze({ ...row, revoked: true }) : row)),
    );
    this.record(walletId, 'DELEGATED_KEY_REVOKED', `delegated key ${keyId} revoked`);
    return { ok: true };
  }

  installRecoveryPolicy(policy: WalletRecoveryPolicy): WalletRecoveryPolicy | WalletSecurityRejection {
    if (policy.threshold < 1 || policy.threshold > policy.components.length) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'recovery threshold must be in 1..=N' };
    }
    if (policy.components.length === 1 && policy.threshold === 1 && policy.components[0]?.kind === 'RECOVERY_PASSKEY') {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'avoid a single universal recovery credential' };
    }
    for (const component of policy.components) {
      if (component.grantsEverydaySpend !== false || component.grantsWalletPrivateView !== false) {
        return { ok: false, code: 'GUARDIAN_CANNOT_SPEND', detail: 'recovery components cannot spend or view private wallet data' };
      }
    }
    this.recoveries.set(policy.walletId, policy);
    const profile = this.profiles.get(policy.walletId);
    if (profile) {
      this.profiles.set(policy.walletId, Object.freeze({ ...profile, recoveryPolicyVersion: policy.version }));
    }
    return policy;
  }

  requestRecovery(input: {
    readonly walletId: string;
    readonly requestedNewAuthorityPublicKey: string;
    readonly reasonClass: WalletRecoveryRequest['reasonClass'];
    readonly evidence: WalletRecoveryRequest['evidence'];
    readonly authorizingComponentIds: readonly string[];
    readonly production?: boolean;
  }): WalletRecoveryRequest | WalletSecurityRejection {
    const policy = this.recoveries.get(input.walletId);
    if (!policy) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'recovery policy is not installed' };
    }
    const unique = new Set(input.authorizingComponentIds);
    if (unique.size !== input.authorizingComponentIds.length) {
      return { ok: false, code: 'RECOVERY_REPLAY', detail: 'duplicate recovery approval' };
    }
    const allowed = new Set(policy.components.map((component) => component.componentId));
    for (const id of unique) {
      if (!allowed.has(id)) {
        return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: `recovery component ${id} is not in the policy` };
      }
    }
    if (unique.size < policy.threshold) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: `recovery requires ${policy.threshold} approvals` };
    }
    const delay = input.production === true ? policy.delayMs : policy.rehearsalDelayMs;
    const challenge = randomBytes(32).toString('hex');
    const approvals: WalletRecoveryApproval[] = [...unique].map((componentId) =>
      Object.freeze({
        approvalId: `rap.${componentId}`,
        componentId,
        actorRef: policy.components.find((component) => component.componentId === componentId)?.actorRef ?? componentId,
        approvedAt: this.now,
        scopedToRecovery: true,
        grantsSpend: false,
      }),
    );
    const requestId = `rec.${input.walletId}.${hashHex(challenge).slice(0, 12)}`;
    const requestHash = hashHex(
      [
        input.walletId,
        String(policy.version),
        input.requestedNewAuthorityPublicKey,
        input.reasonClass,
        challenge,
        ...approvals.map((row) => row.componentId),
      ].join(':'),
    );
    const request: WalletRecoveryRequest = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      requestId,
      walletId: input.walletId,
      policyId: policy.policyId,
      policyVersion: policy.version,
      requestedNewAuthorityPublicKey: input.requestedNewAuthorityPublicKey,
      reasonClass: input.reasonClass,
      evidence: Object.freeze([...input.evidence]),
      challenge,
      approvals: Object.freeze(approvals),
      expiresAt: later(this.now, 24 * 60 * 60 * 1000),
      requestHash,
      status: 'PENDING',
      activationAt: later(this.now, delay),
      consumed: false,
    });
    this.recoveryRequests.set(requestId, request);
    this.record(input.walletId, 'RECOVERY_INITIATED', `recovery ${requestId} pending until ${request.activationAt}`);
    return request;
  }

  replayRecovery(requestId: string): WalletSecurityRejection {
    const request = this.recoveryRequests.get(requestId);
    if (!request) {
      return { ok: false, code: 'RECOVERY_REPLAY', detail: 'unknown recovery request' };
    }
    if (request.consumed || request.status === 'ACTIVATED') {
      return { ok: false, code: 'RECOVERY_REPLAY', detail: 'recovery request already consumed' };
    }
    return { ok: false, code: 'RECOVERY_REPLAY', detail: 'recovery request cannot be replayed' };
  }

  cancelRecovery(walletId: string, requestId: string, existingAuthority: true): { readonly ok: true } | WalletSecurityRejection {
    const policy = this.recoveries.get(walletId);
    const request = this.recoveryRequests.get(requestId);
    if (!policy || !request) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'no pending recovery' };
    }
    if (!policy.ownerMayCancel || existingAuthority !== true) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'existing authority cannot cancel this recovery' };
    }
    this.recoveryRequests.set(requestId, Object.freeze({ ...request, status: 'CANCELLED' }));
    return { ok: true };
  }

  challengeRecovery(walletId: string, requestId: string): { readonly ok: true } | WalletSecurityRejection {
    const request = this.recoveryRequests.get(requestId);
    if (!request || request.walletId !== walletId) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'recovery request not found' };
    }
    this.recoveryRequests.set(requestId, Object.freeze({ ...request, status: 'CHALLENGED' }));
    return { ok: true };
  }

  activateRecovery(requestId: string): { readonly ok: true; readonly newAuthority: string } | WalletSecurityRejection {
    const request = this.recoveryRequests.get(requestId);
    if (!request) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'recovery request not found' };
    }
    if (request.consumed) {
      return { ok: false, code: 'RECOVERY_REPLAY', detail: 'recovery already activated' };
    }
    if (request.status === 'CANCELLED' || request.status === 'CHALLENGED') {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: `recovery is ${request.status}` };
    }
    if (Date.parse(this.now) < Date.parse(request.activationAt)) {
      return { ok: false, code: 'RECOVERY_DELAY_ACTIVE', detail: 'recovery delay has not elapsed' };
    }
    this.recoveryRequests.set(requestId, Object.freeze({ ...request, status: 'ACTIVATED', consumed: true }));
    this.signingAuthorities.set(request.walletId, [request.requestedNewAuthorityPublicKey]);
    this.record(request.walletId, 'RECOVERY_COMPLETED', `future signing authority replaced; finalized transfers unchanged`);
    return { ok: true, newAuthority: request.requestedNewAuthorityPublicKey };
  }

  refuseHistoryRewrite(txId: string): WalletSecurityRejection {
    if (this.finalizedTransfers.has(txId)) {
      return { ok: false, code: 'RECOVERY_CANNOT_REWRITE_HISTORY', detail: 'wallet recovery cannot reverse a finalized transfer' };
    }
    return { ok: false, code: 'RECOVERY_CANNOT_REWRITE_HISTORY', detail: 'recovery cannot rewrite finalized chain state' };
  }

  markFinalized(txId: string): void {
    this.finalizedTransfers.add(txId);
  }

  planKeyRotation(input: {
    readonly walletId: string;
    readonly oldKeyId: string;
    readonly newPublicKeyHex: string;
    readonly policyId: string;
    readonly authorizationRef: string;
  }): WalletKeyRotationPlan | WalletSecurityRejection {
    const profile = this.requireProfile(input.walletId);
    if ('ok' in profile) {
      return profile;
    }
    if (containsPrivateMaterial(input.newPublicKeyHex)) {
      return { ok: false, code: 'PRIVATE_KEY_EXPOSURE', detail: 'rotation plan accepts the new public key only' };
    }
    const plan: WalletKeyRotationPlan = Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      planId: `rot.${input.walletId}.${randomBytes(4).toString('hex')}`,
      walletId: input.walletId,
      oldKeyId: input.oldKeyId,
      newPublicKeyHex: input.newPublicKeyHex,
      policyId: input.policyId,
      authorizationRef: input.authorizationRef,
      activationState: 'AUTHORIZED',
      auditEvidence: hashHex(`${input.oldKeyId}:${input.newPublicKeyHex}:${this.now}`),
      createdAt: this.now,
    });
    this.rotations.set(input.walletId, [...(this.rotations.get(input.walletId) ?? []), plan]);
    return plan;
  }

  activateKeyRotation(planId: string): WalletKeyRotationPlan | WalletSecurityRejection {
    for (const [walletId, plans] of this.rotations) {
      const plan = plans.find((row) => row.planId === planId);
      if (!plan) {
        continue;
      }
      const next = Object.freeze({ ...plan, activationState: 'ACTIVE' as const });
      this.rotations.set(
        walletId,
        plans.map((row) => (row.planId === planId ? next : row)),
      );
      this.signingAuthorities.set(walletId, [plan.newPublicKeyHex]);
      this.record(walletId, 'KEY_ROTATED', `key ${plan.oldKeyId} superseded by public ${plan.newPublicKeyHex.slice(0, 12)}`);
      return next;
    }
    return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'rotation plan not found' };
  }

  lostDevice(input: {
    readonly walletId: string;
    readonly deviceId: string;
    readonly initiateRecovery?: boolean;
  }): LostDeviceWorkflowResult | WalletSecurityRejection {
    const revoked = this.setDeviceTrust(input.walletId, input.deviceId, 'REVOKED');
    if ('ok' in revoked) {
      return revoked;
    }
    const sessionsRevoked = this.revokeDeviceSessions(input.walletId, input.deviceId);
    const delegated = this.delegations.get(input.walletId) ?? [];
    return {
      walletId: input.walletId,
      deviceRevoked: true,
      sessionsRevoked,
      delegatedKeysReviewed: delegated.map((row) => row.keyId),
      agentMandatesReviewed: delegated.filter((row) => row.purpose.includes('agent')).map((row) => row.keyId),
      recoveryInitiated: input.initiateRecovery === true,
    };
  }

  selfCustodyServerView(walletId: string): { readonly publicDescriptors: readonly string[] } | WalletSecurityRejection {
    const profile = this.requireProfile(walletId);
    if ('ok' in profile) {
      return profile;
    }
    if (profile.custodyClass === 'SELF_CUSTODY' || profile.custodyClass === 'ASSISTED_SELF_CUSTODY') {
      if (this.serverKeystore.has(walletId)) {
        return { ok: false, code: 'PRIVATE_KEY_EXPOSURE', detail: 'self-custody private key must not exist on the server' };
      }
      return {
        publicDescriptors: this.getWalletDevices(walletId).map((device) => device.devicePublicDescriptor),
      };
    }
    return { publicDescriptors: this.signingAuthorities.get(walletId) ?? [] };
  }

  retrieveSelfCustodyPrivateKey(_walletId: string): WalletSecurityRejection {
    return { ok: false, code: 'SELF_CUSTODY_KEY_UNAVAILABLE', detail: 'server cannot retrieve a self-custody private key' };
  }

  testnetKeyCannotAuthorizeProduction(keyEnvironment: string, walletNetworkId: string): WalletSecurityRejection | { readonly ok: true } {
    const test = keyEnvironment.includes('test') || keyEnvironment.includes('testnet') || keyEnvironment.includes('rehearsal');
    const production = walletNetworkId.includes('production') || walletNetworkId.includes('mainnet');
    if (test && production) {
      return { ok: false, code: 'TESTNET_KEY_PRODUCTION', detail: 'a test/rehearsal key cannot authorize production' };
    }
    return { ok: true };
  }

  audit(walletId: string): WalletSecurityAuditReport | WalletSecurityRejection {
    const profile = this.requireProfile(walletId);
    if ('ok' in profile) {
      return profile;
    }
    const pending: string[] = [];
    for (const request of this.getRecoveryState(walletId).pending) {
      if (request.status === 'PENDING') {
        pending.push(`recovery:${request.requestId}`);
      }
    }
    for (const challenge of this.challenges.get(walletId) ?? []) {
      if (!challenge.resolved) {
        pending.push(`challenge:${challenge.challengeId}`);
      }
    }
    return Object.freeze({
      schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
      walletId,
      generatedAt: this.now,
      activeDevices: Object.freeze(this.getWalletDevices(walletId).filter((device) => device.revocationState === 'ACTIVE')),
      activeSessions: Object.freeze(this.getWalletSessions(walletId).filter((session) => session.revocationState === 'ACTIVE')),
      activeSigningAuthorities: Object.freeze([...(this.signingAuthorities.get(walletId) ?? [])]),
      delegations: Object.freeze([...(this.delegations.get(walletId) ?? [])]),
      recoveryPolicy: this.recoveries.get(walletId) ?? null,
      destinationPolicy: this.destinations.get(walletId) ?? {
        schemaVersion: WALLET_SECURITY_SCHEMA_VERSION,
        walletId,
        version: 0,
        destinations: [],
      },
      pendingSecurityActions: Object.freeze(pending),
    });
  }

  notificationHooks(walletId: string): readonly WalletSecurityNotificationHook[] {
    return this.events.get(walletId)?.map((event) => event.notificationHook) ?? [];
  }

  eventsFor(walletId: string): readonly WalletSecurityEvent[] {
    return this.events.get(walletId) ?? [];
  }

  publicExplorerView(walletId: string): { readonly walletId: string; readonly publicKeyChange: string | null } {
    const authorities = this.signingAuthorities.get(walletId) ?? [];
    return {
      walletId,
      publicKeyChange: authorities[0] ?? null,
    };
  }

  private requireProfile(walletId: string): WalletSecurityProfile | WalletSecurityRejection {
    const profile = this.profiles.get(walletId);
    return profile ?? { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'wallet security profile not attached' };
  }

  private deviceOf(walletId: string, deviceId: string): WalletDeviceBinding | undefined {
    return this.getWalletDevices(walletId).find((device) => device.deviceId === deviceId);
  }

  private replaceDevice(next: WalletDeviceBinding): void {
    this.devices.set(
      next.walletId,
      this.getWalletDevices(next.walletId).map((device) => (device.deviceId === next.deviceId ? next : device)),
    );
  }

  private sessionById(sessionId: string): WalletSession | undefined {
    for (const list of this.sessions.values()) {
      const found = list.find((session) => session.sessionId === sessionId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private mutateSession(walletId: string, sessionId: string, patch: Partial<WalletSession>): void {
    this.sessions.set(
      walletId,
      this.getWalletSessions(walletId).map((session) =>
        session.sessionId === sessionId ? Object.freeze({ ...session, ...patch }) : session,
      ),
    );
  }

  private enforceDelegatedKey(
    walletId: string,
    keyId: string,
    built: BuiltTransaction,
  ): WalletSecurityRejection | null {
    const binding = (this.delegations.get(walletId) ?? []).find((row) => row.keyId === keyId);
    if (!binding) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'delegated key is not bound' };
    }
    if (binding.revoked) {
      return { ok: false, code: 'DELEGATED_MASTER_AUTHORITY_FORBIDDEN', detail: 'revoked delegation cannot authorize' };
    }
    if (binding.inheritsMasterAuthority !== false) {
      return { ok: false, code: 'DELEGATED_MASTER_AUTHORITY_FORBIDDEN', detail: 'delegated key cannot inherit master authority' };
    }
    if (binding.expiresAt && Date.parse(this.now) >= Date.parse(binding.expiresAt)) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key expired' };
    }
    if (built.assetId && binding.assets.length > 0 && !binding.assets.includes(built.assetId)) {
      return { ok: false, code: 'DELEGATED_WRONG_ASSET', detail: 'delegated key cannot move this asset' };
    }
    if (binding.quantityLimit !== null && built.amount !== null && built.amount > binding.quantityLimit) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key quantity limit exceeded' };
    }
    if (
      binding.destinations.length > 0 &&
      built.counterpartyAccountId &&
      !binding.destinations.includes(built.counterpartyAccountId)
    ) {
      return { ok: false, code: 'DELEGATED_WRONG_DESTINATION', detail: 'delegated key destination is not permitted' };
    }
    if (binding.actionClasses.length > 0 && !binding.actionClasses.includes(built.family)) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key cannot sign this action class' };
    }
    return null;
  }

  private enforceSpendControls(profile: WalletSecurityProfile, built: BuiltTransaction): WalletSecurityRejection | null {
    for (const control of profile.transactionPolicy.spendControls) {
      if (control.assetId && built.assetId && control.assetId !== built.assetId) {
        continue;
      }
      if (control.destinationId && built.counterpartyAccountId && control.destinationId !== built.counterpartyAccountId) {
        continue;
      }
      if (control.perTransactionQuantity !== null && built.amount !== null && built.amount > control.perTransactionQuantity) {
        return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'per-transaction spend control exceeded' };
      }
      if (
        control.rollingPeriodQuantity !== null &&
        built.amount !== null &&
        control.spentInPeriod + built.amount > control.rollingPeriodQuantity
      ) {
        return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'rolling-period spend control exceeded' };
      }
    }
    return null;
  }

  private requireCustodyApproval(walletId: string, built: BuiltTransaction): WalletSecurityRejection | null {
    const destState = built.counterpartyAccountId
      ? this.destinationState(walletId, built.counterpartyAccountId)
      : 'UNRECOGNIZED';
    if (destState !== 'TRUSTED') {
      return {
        ok: false,
        code: 'CUSTODY_CONTROL_REQUIRED',
        detail: 'institutional custody requires the canonical custody destination and approval controls',
      };
    }
    return null;
  }

  private record(walletId: string, kind: WalletSecurityEvent['kind'], summary: string): void {
    const hook: WalletSecurityNotificationHook = Object.freeze({
      channel: 'CHUNK_97_NOTIFICATION',
      privacySafe: true,
      payload: Object.freeze({
        walletId,
        kind,
        occurredAt: this.now,
        summary,
      }),
    });
    const event: WalletSecurityEvent = Object.freeze({
      eventId: `wse.${randomBytes(6).toString('hex')}`,
      walletId,
      kind,
      occurredAt: this.now,
      publicSummary: summary,
      notificationHook: hook,
    });
    this.events.set(walletId, [...(this.events.get(walletId) ?? []), event]);
  }
}

export { defaultRequirements, highRiskRequirements };
