import { addMs, isExpired, type Clock } from '../../config/src/clock.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { newSecurityToken, secureRandomHex } from '../../security/src/random.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import {
  ACTOR_CONTEXT_TTL_MS,
  ActorContextIssuer,
  type ActorContext,
  type ActorContextFailure,
  type VerifiedActorContext,
} from './actor-context.ts';
import { assuranceFromFactors, type AuthenticationAssurance } from './assurance.ts';
import type {
  DeviceTrustState,
  IdentitySession,
  RegisteredDevice,
  WebAuthnAuthenticationResponse,
  WebAuthnCredential,
  WebAuthnRegistrationResponse,
  WebAuthnRelyingParty,
} from './auth.ts';
import {
  deriveCapabilities,
  type CapabilityGrant,
  type IdentityCapability,
} from './capability.ts';
import type { IdentityFacts } from './facts.ts';
import {
  asActorId,
  asBusinessIdentityId,
  asCapabilityGrantId,
  asDeviceId,
  asKycRecordId,
  asRecoveryRequestId,
  asSessionId,
  asSolsticeIdentityId,
  type DeviceId,
  type SessionId,
  type SolsticeIdentityId,
} from './ids.ts';
import { kycEffectiveState, kycIsFresh, type KycRecord } from './kyc.ts';
import {
  emptyPersonalAttributes,
  isBlockedIdentityStatus,
  type BusinessIdentity,
  type IdentityStatus,
  type PersonIdentity,
} from './model.ts';
import type { IdentityProviderPorts } from './ports.ts';
import type { RecoveryRequest, RecoveryState } from './recovery.ts';
import { IdentityStore, type IdentitySnapshot } from './store.ts';

export const SESSION_TTL_MS = 8n * 60n * 60n * 1000n;
export const CAPABILITY_GRANT_TTL_MS = 24n * 60n * 60n * 1000n;
export const CHALLENGE_TTL_MS = 5n * 60n * 1000n;

export type IdentityFailure = {
  readonly code: string;
  readonly message: string;
};

export type IdentityAuthorityPort = {
  resolveActorContext(actorId: string): Result<VerifiedActorContext, IdentityFailure>;
  identityFactsFor(actorId: string): IdentityFacts;
};

function fail<T>(code: string, message: string): Result<T, IdentityFailure> {
  return err({ code, message });
}

export class IdentityService implements IdentityAuthorityPort {
  readonly store: IdentityStore;
  private readonly clock: Clock;
  private readonly actorContextIssuer: ActorContextIssuer;
  private readonly webauthn: WebAuthnRelyingParty;
  private readonly evidence: EvidenceVault | undefined;
  private readonly events: DomainEventLog | undefined;
  private readonly providers: IdentityProviderPorts | undefined;

  constructor(input: {
    readonly clock: Clock;
    readonly keys: KeyProvider;
    readonly webauthn: WebAuthnRelyingParty;
    readonly evidence?: EvidenceVault;
    readonly events?: DomainEventLog;
    readonly providers?: IdentityProviderPorts;
    readonly store?: IdentityStore;
  }) {
    this.clock = input.clock;
    this.actorContextIssuer = new ActorContextIssuer(input.keys);
    this.webauthn = input.webauthn;
    this.evidence = input.evidence;
    this.events = input.events;
    this.providers = input.providers;
    this.store = input.store ?? new IdentityStore();
  }

  snapshot(): IdentitySnapshot {
    return this.store.snapshot();
  }

  hydrate(snapshot: IdentitySnapshot): void {
    this.store.hydrate(snapshot);
  }

  createPersonIdentity(input: {
    readonly id?: string;
    readonly homeJurisdiction: Jurisdiction;
    readonly customerId?: CustomerId;
  }): PersonIdentity {
    const now = this.clock.now();
    const identity: PersonIdentity = Object.freeze({
      id: asSolsticeIdentityId(input.id ?? `idn_${newSecurityToken()}`),
      kind: 'PERSON',
      status: 'PENDING',
      homeJurisdiction: input.homeJurisdiction,
      attributes: emptyPersonalAttributes(),
      customerId: input.customerId ?? null,
      createdAt: now,
      version: 0,
    });
    this.store.identities.set(identity.id, identity);
    if (input.customerId) {
      this.linkCustomer(identity.id, input.customerId);
    }
    this.emit('IdentityCreated', identity.id, { identityId: identity.id, kind: 'PERSON' });
    return identity;
  }

  createBusinessIdentity(input: {
    readonly subjectId: SolsticeIdentityId;
    readonly legalNameRef: string;
    readonly jurisdiction: Jurisdiction;
    readonly registrationRef?: string;
  }): Result<BusinessIdentity, IdentityFailure> {
    const person = this.store.identities.get(input.subjectId);
    if (!person) {
      return fail('IDENTITY_NOT_FOUND', 'business subject identity does not exist');
    }
    const now = this.clock.now();
    const business: BusinessIdentity = Object.freeze({
      id: asBusinessIdentityId(`biz_${newSecurityToken()}`),
      subjectId: input.subjectId,
      kind: 'BUSINESS',
      legalNameRef: input.legalNameRef,
      registrationRef: input.registrationRef ?? null,
      jurisdiction: input.jurisdiction,
      businessStatus: 'PENDING',
      authorizedRepresentatives: Object.freeze([
        { identityId: input.subjectId, role: 'AUTHORIZED_REPRESENTATIVE' as const },
      ]),
      beneficialOwnerRefs: Object.freeze([]),
      controlPersonRefs: Object.freeze([]),
      verificationState: 'UNDECLARED',
      createdAt: now,
      version: 0,
    });
    this.store.businesses.set(business.id, business);
    this.seal('IDENTITY_BUSINESS_CREATED', { businessId: business.id, subjectId: input.subjectId });
    return ok(business);
  }

  activateIdentity(identityId: SolsticeIdentityId): Result<PersonIdentity, IdentityFailure> {
    return this.transition(identityId, 'ACTIVE', 'IdentityActivated', 'IDENTITY_ACTIVATED');
  }

  suspendIdentity(identityId: SolsticeIdentityId): Result<PersonIdentity, IdentityFailure> {
    const result = this.transition(identityId, 'SUSPENDED', 'IdentitySuspended', 'IDENTITY_SUSPENDED');
    if (result.ok) {
      this.revokeAllSessions(identityId);
    }
    return result;
  }

  lockIdentity(identityId: SolsticeIdentityId): Result<PersonIdentity, IdentityFailure> {
    const result = this.transition(identityId, 'LOCKED', 'IdentitySuspended', 'IDENTITY_LOCKED');
    if (result.ok) {
      this.revokeAllSessions(identityId);
    }
    return result;
  }

  closeIdentity(identityId: SolsticeIdentityId): Result<PersonIdentity, IdentityFailure> {
    const result = this.transition(identityId, 'CLOSED', 'IdentitySuspended', 'IDENTITY_CLOSED');
    if (result.ok) {
      this.revokeAllSessions(identityId);
    }
    return result;
  }

  linkCustomer(identityId: SolsticeIdentityId, customerId: CustomerId): void {
    this.store.customerByIdentity.set(identityId, customerId);
    this.store.identityByCustomer.set(customerId, identityId);
    const current = this.store.identities.get(identityId);
    if (current) {
      this.store.identities.set(identityId, Object.freeze({ ...current, customerId, version: current.version + 1 }));
    }
  }

  beginPasskeyRegistration(identityId: SolsticeIdentityId, rpId = 'simulation.solstice.local', origin = 'https://simulation.solstice.local') {
    return this.webauthn.beginRegistration({ identityId, rpId, origin }, this.clock.now());
  }

  completePasskeyRegistration(
    response: WebAuthnRegistrationResponse,
    deviceRef?: string,
  ): Result<WebAuthnCredential, IdentityFailure> {
    try {
      const credential = this.webauthn.completeRegistration(response, this.clock.now());
      this.store.credentials.set(credential.credentialId, credential);
      if (deviceRef) {
        this.registerDevice(credential.identityId, deviceRef, 'PASSKEY');
      }
      return ok(credential);
    } catch (error) {
      return fail('WEBAUTHN_REGISTRATION_FAILED', error instanceof Error ? error.message : 'registration failed');
    }
  }

  beginPasskeyAuthentication(identityId: SolsticeIdentityId, rpId = 'simulation.solstice.local', origin = 'https://simulation.solstice.local') {
    return this.webauthn.beginAuthentication({ identityId, rpId, origin }, this.clock.now());
  }

  authenticatePasskey(
    response: WebAuthnAuthenticationResponse,
    actorId: string,
    deviceRef?: string,
    stepUp = false,
  ): Result<{ readonly session: IdentitySession; readonly context: VerifiedActorContext }, IdentityFailure> {
    const now = this.clock.now();
    let credential: WebAuthnCredential;
    try {
      credential = this.webauthn.completeAuthentication(response, now);
    } catch (error) {
      return fail('INVALID_CREDENTIAL', error instanceof Error ? error.message : 'authentication failed');
    }
    this.store.credentials.set(credential.credentialId, credential);
    const identity = this.store.identities.get(credential.identityId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'authenticated credential has no identity');
    }
    if (isBlockedIdentityStatus(identity.status) || identity.status === 'PENDING') {
      return fail('IDENTITY_BLOCKED', `identity status ${identity.status} cannot authenticate`);
    }
    let deviceId: DeviceId | null = credential.deviceId;
    if (deviceRef) {
      const device = this.registerDevice(identity.id, deviceRef, 'PASSKEY');
      if (device.trustState === 'BLOCKED') {
        return fail('DEVICE_BLOCKED', 'device is blocked');
      }
      deviceId = device.deviceId;
    }
    const session = this.createSession({
      subjectId: identity.id,
      actorId,
      assurance: assuranceFromFactors(['PASSKEY'], stepUp),
      factors: ['PASSKEY'],
      deviceId,
    });
    const context = this.issueContext(session);
    if (!context.ok) {
      return context;
    }
    return ok({ session, context: context.value });
  }

  createSession(input: {
    readonly subjectId: SolsticeIdentityId;
    readonly actorId: string;
    readonly assurance: AuthenticationAssurance;
    readonly factors: IdentitySession['factors'];
    readonly deviceId: DeviceId | null;
  }): IdentitySession {
    const now = this.clock.now();
    const session: IdentitySession = Object.freeze({
      sessionId: asSessionId(`ses_${secureRandomHex(16)}`),
      subjectId: input.subjectId,
      actorId: input.actorId,
      authenticationStrength: input.assurance,
      factors: Object.freeze([...input.factors]),
      issuedAt: now,
      expiresAt: addMs(now, SESSION_TTL_MS),
      lastUsedAt: now,
      deviceId: input.deviceId,
      riskState: 'CLEAR',
      revocationState: 'ACTIVE',
    });
    this.store.sessions.set(session.sessionId, session);
    const list = this.store.sessionsByActor.get(input.actorId) ?? [];
    list.push(session.sessionId);
    this.store.sessionsByActor.set(input.actorId, list);
    this.store.identityByActor.set(input.actorId, input.subjectId);
    this.emit('IdentitySessionCreated', input.subjectId, {
      identityId: input.subjectId,
      sessionId: session.sessionId,
    });
    return session;
  }

  logout(sessionId: SessionId): Result<IdentitySession, IdentityFailure> {
    return this.revokeSession(sessionId, 'logout');
  }

  revokeSession(sessionId: SessionId, reason = 'revoked'): Result<IdentitySession, IdentityFailure> {
    const session = this.store.sessions.get(sessionId);
    if (!session) {
      return fail('SESSION_NOT_FOUND', 'session does not exist');
    }
    const next = Object.freeze({ ...session, revocationState: 'REVOKED' as const, lastUsedAt: this.clock.now() });
    this.store.sessions.set(sessionId, next);
    this.emit('IdentitySessionRevoked', session.subjectId, {
      identityId: session.subjectId,
      sessionId,
      reason,
    });
    return ok(next);
  }

  revokeAllSessions(identityId: SolsticeIdentityId): number {
    let count = 0;
    for (const session of this.store.sessions.values()) {
      if (session.subjectId === identityId && session.revocationState === 'ACTIVE') {
        this.revokeSession(session.sessionId, 'revoke_all');
        count += 1;
      }
    }
    return count;
  }

  revokeDeviceSessions(deviceId: DeviceId): number {
    let count = 0;
    for (const session of this.store.sessions.values()) {
      if (session.deviceId === deviceId && session.revocationState === 'ACTIVE') {
        this.revokeSession(session.sessionId, 'device_revoked');
        count += 1;
      }
    }
    return count;
  }

  registerDevice(
    identityId: SolsticeIdentityId,
    deviceRef: string,
    method: RegisteredDevice['authenticationMethod'],
  ): RegisteredDevice {
    const existing = [...this.store.devices.values()].find(
      (device) => device.identityId === identityId && device.deviceRef === deviceRef,
    );
    const now = this.clock.now();
    if (existing) {
      const next = Object.freeze({ ...existing, lastSeenAt: now, authenticationMethod: method });
      this.store.devices.set(existing.deviceId, next);
      return next;
    }
    const device: RegisteredDevice = Object.freeze({
      deviceId: asDeviceId(`dev_${newSecurityToken()}`),
      identityId,
      deviceRef,
      firstSeenAt: now,
      lastSeenAt: now,
      authenticationMethod: method,
      trustState: 'KNOWN',
    });
    this.store.devices.set(device.deviceId, device);
    this.emit('IdentityDeviceRegistered', identityId, {
      identityId,
      deviceId: device.deviceId,
    });
    return device;
  }

  setDeviceTrust(deviceId: DeviceId, trustState: DeviceTrustState): Result<RegisteredDevice, IdentityFailure> {
    const device = this.store.devices.get(deviceId);
    if (!device) {
      return fail('DEVICE_NOT_FOUND', 'device does not exist');
    }
    const next = Object.freeze({ ...device, trustState, lastSeenAt: this.clock.now() });
    this.store.devices.set(deviceId, next);
    this.emit('IdentityDeviceTrustChanged', device.identityId, {
      identityId: device.identityId,
      deviceId,
      trustState,
      status: trustState,
    });
    this.seal('IDENTITY_DEVICE_TRUST_CHANGED', {
      identityId: device.identityId,
      deviceId,
      trustState,
    });
    if (trustState === 'BLOCKED') {
      this.revokeDeviceSessions(deviceId);
    }
    return ok(next);
  }

  getDevice(deviceId: DeviceId): RegisteredDevice | undefined {
    return this.store.devices.get(deviceId);
  }

  getBusiness(businessId: string): BusinessIdentity | undefined {
    return this.store.businesses.get(businessId);
  }

  activateBusinessIdentity(businessId: string): Result<BusinessIdentity, IdentityFailure> {
    const current = this.store.businesses.get(businessId);
    if (!current) {
      return fail('BUSINESS_NOT_FOUND', 'business identity does not exist');
    }
    const next = Object.freeze({
      ...current,
      businessStatus: 'ACTIVE' as const,
      verificationState: 'PROVIDER_VERIFIED' as const,
      version: current.version + 1,
    });
    this.store.businesses.set(next.id, next);
    this.seal('IDENTITY_BUSINESS_ACTIVATED', {
      businessId: next.id,
      subjectId: next.subjectId,
      verificationState: next.verificationState,
    });
    return ok(next);
  }

  recordKyc(input: Omit<KycRecord, 'id' | 'version'> & { readonly id?: string }): KycRecord {
    const current = [...this.store.kycRecords.values()]
      .filter((row) => row.identityId === input.identityId)
      .sort((a, b) => b.version - a.version)[0];
    const record: KycRecord = Object.freeze({
      ...input,
      id: asKycRecordId(input.id ?? `kyc_${newSecurityToken()}`),
      verifiedAttributes: Object.freeze([...input.verifiedAttributes]),
      reasonCodes: Object.freeze([...input.reasonCodes]),
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      version: (current?.version ?? 0) + 1,
    });
    this.store.kycRecords.set(record.id, record);
    this.emit('IdentityKycUpdated', input.identityId, {
      identityId: input.identityId,
      kycRecordId: record.id,
      verificationState: record.verificationState,
      version: record.version,
    });
    this.seal('IDENTITY_KYC_UPDATED', {
      identityId: input.identityId,
      kycRecordId: record.id,
      verificationState: record.verificationState,
      version: record.version,
      evidenceRefs: record.evidenceRefs,
    });
    return record;
  }

  latestKyc(identityId: SolsticeIdentityId): KycRecord | undefined {
    return [...this.store.kycRecords.values()]
      .filter((row) => row.identityId === identityId)
      .sort((a, b) => b.version - a.version)[0];
  }

  grantCapability(
    identityId: SolsticeIdentityId,
    capability: IdentityCapability,
    source: CapabilityGrant['source'],
    actorId?: string,
  ): Result<CapabilityGrant, IdentityFailure> {
    if (actorId) {
      const subject = this.store.identityByActor.get(actorId);
      if (subject === identityId) {
        return fail('SELF_GRANT_FORBIDDEN', 'an actor cannot grant a capability to themselves');
      }
    }
    const now = this.clock.now();
    const grant: CapabilityGrant = Object.freeze({
      grantId: asCapabilityGrantId(`cap_${newSecurityToken()}`),
      identityId,
      capability,
      source,
      issuedAt: now,
      expiresAt: addMs(now, CAPABILITY_GRANT_TTL_MS),
      revokedAt: null,
    });
    this.store.grants.set(grant.grantId, grant);
    this.seal('IDENTITY_CAPABILITY_GRANTED', {
      identityId,
      grantId: grant.grantId,
      capability,
      source,
    });
    return ok(grant);
  }

  revokeCapability(grantId: string): Result<CapabilityGrant, IdentityFailure> {
    const grant = this.store.grants.get(grantId);
    if (!grant) {
      return fail('GRANT_NOT_FOUND', 'capability grant does not exist');
    }
    const next = Object.freeze({ ...grant, revokedAt: this.clock.now() });
    this.store.grants.set(grantId, next);
    this.seal('IDENTITY_CAPABILITY_REVOKED', {
      identityId: grant.identityId,
      grantId,
      capability: grant.capability,
    });
    return ok(next);
  }

  requestRecovery(identityId: SolsticeIdentityId): RecoveryRequest {
    const now = this.clock.now();
    const request: RecoveryRequest = Object.freeze({
      id: asRecoveryRequestId(`rec_${newSecurityToken()}`),
      identityId,
      state: 'EVIDENCE_REQUIRED',
      evidenceRefs: Object.freeze([]),
      stepUpCompletedAt: null,
      reasonCodes: Object.freeze(['RECOVERY_REQUESTED']),
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
    this.store.recoveries.set(request.id, request);
    this.emit('IdentityRecoveryRequested', identityId, {
      identityId,
      recoveryRequestId: request.id,
    });
    return request;
  }

  submitRecoveryEvidence(
    requestId: string,
    evidenceRef: string,
  ): Result<RecoveryRequest, IdentityFailure> {
    const request = this.store.recoveries.get(requestId);
    if (!request) {
      return fail('RECOVERY_NOT_FOUND', 'recovery request does not exist');
    }
    if (request.state !== 'EVIDENCE_REQUIRED' && request.state !== 'REQUESTED') {
      return fail('RECOVERY_ILLEGAL_STATE', `cannot attach evidence in state ${request.state}`);
    }
    const next = Object.freeze({
      ...request,
      state: 'STEP_UP_REQUIRED' as const,
      evidenceRefs: Object.freeze([...request.evidenceRefs, evidenceRef]),
      updatedAt: this.clock.now(),
      version: request.version + 1,
    });
    this.store.recoveries.set(requestId, next);
    return ok(next);
  }

  completeRecovery(
    requestId: string,
    stepUpSession: IdentitySession,
  ): Result<RecoveryRequest, IdentityFailure> {
    const request = this.store.recoveries.get(requestId);
    if (!request) {
      return fail('RECOVERY_NOT_FOUND', 'recovery request does not exist');
    }
    if (request.state !== 'STEP_UP_REQUIRED') {
      return fail('RECOVERY_STEP_UP_REQUIRED', 'recovery requires step-up authentication');
    }
    if (stepUpSession.subjectId !== request.identityId) {
      return fail('RECOVERY_SUBJECT_MISMATCH', 'step-up session is for a different identity');
    }
    if (stepUpSession.authenticationStrength !== 'HIGH_ASSURANCE') {
      return fail('RECOVERY_STEP_UP_REQUIRED', 'recovery requires high-assurance step-up');
    }
    if (request.evidenceRefs.length === 0) {
      return fail('RECOVERY_EVIDENCE_REQUIRED', 'recovery requires evidence references');
    }
    const next = Object.freeze({
      ...request,
      state: 'APPROVED' as const,
      stepUpCompletedAt: this.clock.now(),
      updatedAt: this.clock.now(),
      version: request.version + 1,
    });
    this.store.recoveries.set(requestId, next);
    this.seal('IDENTITY_RECOVERY_APPROVED', {
      identityId: request.identityId,
      recoveryRequestId: request.id,
      evidenceRefs: request.evidenceRefs,
    });
    return ok(next);
  }

  denyRecovery(requestId: string, reason: string): Result<RecoveryRequest, IdentityFailure> {
    const request = this.store.recoveries.get(requestId);
    if (!request) {
      return fail('RECOVERY_NOT_FOUND', 'recovery request does not exist');
    }
    const next: RecoveryRequest = Object.freeze({
      ...request,
      state: 'DENIED' as RecoveryState,
      reasonCodes: Object.freeze([...request.reasonCodes, reason]),
      updatedAt: this.clock.now(),
      version: request.version + 1,
    });
    this.store.recoveries.set(requestId, next);
    this.seal('IDENTITY_RECOVERY_DENIED', {
      identityId: request.identityId,
      recoveryRequestId: request.id,
      reason,
    });
    return ok(next);
  }

  issueContext(session: IdentitySession): Result<VerifiedActorContext, IdentityFailure> {
    const usable = this.usableSession(session);
    if (!usable.ok) {
      return usable;
    }
    const identity = this.store.identities.get(session.subjectId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'session subject does not exist');
    }
    const now = this.clock.now();
    const capabilities = deriveCapabilities({
      identityStatus: identity.status,
      session,
      kyc: this.latestKyc(identity.id) ?? null,
      grants: [...this.store.grants.values()].filter((grant) => grant.identityId === identity.id),
      now,
    });
    const issued = this.actorContextIssuer.issue({
      actorId: session.actorId,
      subjectId: session.subjectId,
      sessionId: session.sessionId,
      authenticationAssurance: session.authenticationStrength,
      authorizedCapabilities: capabilities,
      issuedAt: now,
      expiresAt: addMs(now, ACTOR_CONTEXT_TTL_MS),
    });
    if (!issued.ok) {
      return fail(issued.error.code, issued.error.message);
    }
    return issued;
  }

  verifyActorContext(context: ActorContext): Result<VerifiedActorContext, ActorContextFailure> {
    return this.actorContextIssuer.verify(context, this.clock);
  }

  resolveActorContext(actorId: string): Result<VerifiedActorContext, IdentityFailure> {
    const subjectId = this.store.identityByActor.get(actorId);
    if (subjectId) {
      const identity = this.store.identities.get(subjectId);
      if (!identity) {
        return fail('IDENTITY_NOT_FOUND', 'actor is bound to a missing identity');
      }
      if (isBlockedIdentityStatus(identity.status) || identity.status === 'PENDING') {
        return fail('IDENTITY_BLOCKED', `identity status ${identity.status} forbids the session`);
      }
    }
    const ids = this.store.sessionsByActor.get(actorId) ?? [];
    if (ids.length === 0) {
      return fail('SESSION_NOT_FOUND', 'no active session for actor');
    }
    let lastFailure: IdentityFailure | null = null;
    for (const id of [...ids].reverse()) {
      const session = this.store.sessions.get(id);
      if (!session) {
        continue;
      }
      const usable = this.usableSession(session);
      if (usable.ok) {
        const touched = Object.freeze({ ...usable.value, lastUsedAt: this.clock.now() });
        this.store.sessions.set(touched.sessionId, touched);
        return this.issueContext(touched);
      }
      lastFailure = usable.error;
    }
    return fail(
      lastFailure?.code ?? 'SESSION_NOT_FOUND',
      lastFailure?.message ?? 'no active session for actor',
    );
  }

  identityFactsFor(actorId: string): IdentityFacts {
    const subjectId = this.store.identityByActor.get(actorId) ?? null;
    const identity = subjectId ? this.store.identities.get(subjectId) : undefined;
    const session = this.activeSessionForActor(actorId);
    const kyc = identity ? this.latestKyc(identity.id) : undefined;
    const now = this.clock.now();
    const kycState = kyc ? kycEffectiveState(kyc, now) : null;
    const capabilities = identity
      ? deriveCapabilities({
          identityStatus: identity.status,
          session,
          kyc: kyc ?? null,
          grants: [...this.store.grants.values()].filter((grant) => grant.identityId === identity.id),
          now,
        })
      : [];
    return Object.freeze({
      identityExists: identity !== undefined,
      identityStatus: identity?.status ?? null,
      subjectId: identity?.id ?? null,
      actorId,
      actorSubjectMatch: identity !== undefined && this.store.identityByActor.get(actorId) === identity.id,
      authenticated: session !== null,
      sessionValid: session !== null,
      authenticationAssurance: session?.authenticationStrength ?? null,
      kycState,
      kycLevel: kyc?.verificationLevel ?? null,
      kycFresh: kyc ? kycIsFresh(kyc, now) : false,
      kycVersion: kyc?.version ?? null,
      customerId: identity?.customerId ?? this.store.customerByIdentity.get(identity?.id ?? '') ?? null,
      authorizedCapabilities: capabilities,
    });
  }

  getSession(sessionId: SessionId): IdentitySession | undefined {
    return this.store.sessions.get(sessionId);
  }

  getIdentity(identityId: SolsticeIdentityId): PersonIdentity | undefined {
    return this.store.identities.get(identityId);
  }

  resolveFromSession(sessionId: SessionId): Result<VerifiedActorContext, IdentityFailure> {
    const session = this.store.sessions.get(sessionId);
    if (!session) {
      return fail('SESSION_NOT_FOUND', 'session does not exist');
    }
    const usable = this.usableSession(session);
    if (!usable.ok) {
      return usable;
    }
    const touched = Object.freeze({ ...usable.value, lastUsedAt: this.clock.now() });
    this.store.sessions.set(touched.sessionId, touched);
    return this.issueContext(touched);
  }

  activeSessionForActor(actorId: string): IdentitySession | null {
    const ids = this.store.sessionsByActor.get(actorId) ?? [];
    const now = this.clock.now();
    for (const id of [...ids].reverse()) {
      const session = this.store.sessions.get(id);
      if (!session) {
        continue;
      }
      if (this.usableSession(session).ok) {
        const touched = Object.freeze({ ...session, lastUsedAt: now });
        this.store.sessions.set(session.sessionId, touched);
        return touched;
      }
    }
    return null;
  }

  bindActor(actorId: string, identityId: SolsticeIdentityId): void {
    asActorId(actorId);
    this.store.identityByActor.set(actorId, identityId);
  }

  private usableSession(session: IdentitySession): Result<IdentitySession, IdentityFailure> {
    if (session.revocationState === 'REVOKED') {
      return fail('SESSION_REVOKED', 'session has been revoked');
    }
    if (isExpired(session.expiresAt, this.clock.now())) {
      const expired = Object.freeze({ ...session, revocationState: 'EXPIRED' as const });
      this.store.sessions.set(session.sessionId, expired);
      return fail('SESSION_EXPIRED', 'session has expired');
    }
    if (session.riskState === 'BLOCKED') {
      return fail('SESSION_BLOCKED', 'session risk state is blocked');
    }
    const identity = this.store.identities.get(session.subjectId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'session subject does not exist');
    }
    if (isBlockedIdentityStatus(identity.status) || identity.status === 'PENDING') {
      return fail('IDENTITY_BLOCKED', `identity status ${identity.status} forbids the session`);
    }
    if (session.deviceId) {
      const device = this.store.devices.get(session.deviceId);
      if (device?.trustState === 'BLOCKED') {
        return fail('DEVICE_BLOCKED', 'session device is blocked');
      }
    }
    return ok(session);
  }

  private transition(
    identityId: SolsticeIdentityId,
    status: IdentityStatus,
    eventType: 'IdentityActivated' | 'IdentitySuspended',
    evidenceKind: string,
  ): Result<PersonIdentity, IdentityFailure> {
    const current = this.store.identities.get(identityId);
    if (!current) {
      return fail('IDENTITY_NOT_FOUND', 'identity does not exist');
    }
    const next = Object.freeze({ ...current, status, version: current.version + 1 });
    this.store.identities.set(identityId, next);
    this.emit(eventType, identityId, { identityId, status });
    this.seal(evidenceKind, { identityId, status });
    return ok(next);
  }

  private emit(
    eventType:
      | 'IdentityCreated'
      | 'IdentityActivated'
      | 'IdentitySuspended'
      | 'IdentityKycUpdated'
      | 'IdentitySessionCreated'
      | 'IdentitySessionRevoked'
      | 'IdentityDeviceRegistered'
      | 'IdentityDeviceTrustChanged'
      | 'IdentityRecoveryRequested',
    identityId: SolsticeIdentityId,
    payload: Record<string, unknown>,
  ): void {
    this.events?.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      aggregateType: 'identity',
      aggregateId: identityId,
      payload: payload as { readonly identityId: string },
    });
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
