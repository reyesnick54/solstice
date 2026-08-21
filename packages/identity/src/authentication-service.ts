/**
 * Canonical consumer authentication service.
 *
 * Authentication answers WHO IS THIS USER?
 * It does not grant KYC, financial capabilities, or Execution Authority.
 * Callers must not treat a successful login as Kernel ALLOW.
 *
 * Frontend userId / actorId in the request body is ignored.
 * AI runtimes cannot mint sessions through this service.
 */

import { addMs, isExpired, type Clock } from '../../config/src/clock.ts';
import { ENVIRONMENT } from '../../config/src/flags.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { newSecurityToken, secureRandomHex } from '../../security/src/random.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { assuranceFromFactors, type AuthenticationAssurance } from './assurance.ts';
import type {
  AuthenticationFactor,
  DeviceTrustState,
  IdentitySession,
  RegisteredDevice,
  WebAuthnAuthenticationResponse,
  WebAuthnChallenge,
  WebAuthnCredential,
  WebAuthnRegistrationResponse,
} from './auth.ts';
import type { VerifiedActorContext } from './actor-context.ts';
import {
  AuthRateLimiter,
  type AuthRateLimitPort,
  type AuthRateLimitPurpose,
} from './auth-rate-limit.ts';
import {
  AuthenticationStore,
  type AuthChallenge,
  type AuthenticationSnapshot,
  type RefreshSession,
} from './auth-store.ts';
import {
  asAuthChallengeId,
  asLoginHandleId,
  asPasswordCredentialId,
  asRefreshTokenId,
  asSecurityEventId,
  asSessionId,
  asSolsticeIdentityId,
  asTotpCredentialId,
  type DeviceId,
  type SessionId,
  type SolsticeIdentityId,
} from './ids.ts';
import {
  handleLookupHash,
  networkMetadataHash,
  normalizeHandle,
  type LoginHandleKind,
} from './login-handle.ts';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './password.ts';
import { IdentityService, SESSION_TTL_MS, type IdentityFailure } from './service.ts';
import { type IdentitySecurityEvent, type SecurityEventKind } from './security-events.ts';
import { evaluateStepUp } from './step-up.ts';
import {
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  refreshExpiry,
  rotateRefreshToken,
  verifyAccessToken,
} from './tokens.ts';
import { fromBase32, generateTotpSecret, otpauthUri, totpAt, verifyTotp } from './totp.ts';
import { WEBAUTHN_PRODUCTION_BLOCKER, isProductionWebAuthnAvailable } from './webauthn-production.ts';

export const MFA_CHALLENGE_TTL_MS = 5n * 60n * 1000n;
export const RECOVERY_CHALLENGE_TTL_MS = 15n * 60n * 1000n;
export const TOTP_ISSUER = 'SunRey';

export type AuthFailure = {
  readonly code: string;
  readonly message: string;
  readonly retryAfterMs?: number;
};

export type RegisterInput = {
  readonly email?: string;
  readonly phone?: string;
  readonly password: string;
  readonly homeJurisdiction: Jurisdiction;
  readonly termsVersion: string;
  readonly ip?: string;
  readonly userAgent?: string;
};

export type RegisterResult = {
  readonly identityId: SolsticeIdentityId;
  readonly actorId: string;
  readonly verificationState: 'UNVERIFIED';
  readonly kycCompleted: false;
  readonly termsVersion: string;
};

export type AuthenticateInput = {
  readonly email?: string;
  readonly phone?: string;
  readonly password: string;
  readonly deviceRef?: string;
  readonly ip?: string;
  readonly userAgent?: string;
};

export type TokenBundle = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: UtcInstant;
  readonly refreshExpiresAt: UtcInstant;
  readonly session: IdentitySession;
  readonly context: VerifiedActorContext;
  readonly authenticationStrength: AuthenticationAssurance;
};

export type MfaRequiredResult = {
  readonly status: 'MFA_REQUIRED';
  readonly mfaToken: string;
  readonly methods: readonly AuthenticationFactor[];
};

export type AuthenticateResult = TokenBundle | MfaRequiredResult;

export type AuthenticatedRequestContext = {
  readonly identityId: SolsticeIdentityId;
  readonly actorId: string;
  readonly session: IdentitySession;
  readonly device: RegisteredDevice | null;
  readonly authenticationStrength: AuthenticationAssurance;
  readonly context: VerifiedActorContext;
};

function fail<T>(code: string, message: string, retryAfterMs?: number): Result<T, AuthFailure> {
  return err({ code, message, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) });
}

export function isMfaRequired(value: AuthenticateResult): value is MfaRequiredResult {
  return 'status' in value && value.status === 'MFA_REQUIRED';
}

export class AuthenticationService {
  readonly store: AuthenticationStore;
  readonly identity: IdentityService;
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;
  private readonly limiter: AuthRateLimitPort;

  constructor(input: {
    readonly identity: IdentityService;
    readonly clock: Clock;
    readonly keys: KeyProvider;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly store?: AuthenticationStore;
    readonly limiter?: AuthRateLimitPort;
  }) {
    this.identity = input.identity;
    this.clock = input.clock;
    this.keys = input.keys;
    this.events = input.events;
    this.evidence = input.evidence;
    this.store = input.store ?? new AuthenticationStore();
    this.limiter = input.limiter ?? new AuthRateLimiter();
  }

  snapshot(): AuthenticationSnapshot {
    return this.store.snapshot();
  }

  hydrate(snapshot: AuthenticationSnapshot): void {
    this.store.hydrate(snapshot);
  }

  async register(input: RegisterInput): Promise<Result<RegisterResult, AuthFailure>> {
    const limited = this.limit('register', this.ipKey(input.ip));
    if (!limited.ok) {
      return limited;
    }
    const passwordError = assertPasswordPolicy(input.password);
    if (passwordError) {
      return fail('PASSWORD_POLICY', passwordError);
    }
    if (!input.termsVersion || input.termsVersion.trim().length === 0) {
      return fail('TERMS_REQUIRED', 'terms acknowledgement is required');
    }
    const handles: Array<{ kind: LoginHandleKind; normalized: string; hash: string }> = [];
    for (const [kind, raw] of [
      ['EMAIL', input.email],
      ['PHONE', input.phone],
    ] as const) {
      if (!raw) {
        continue;
      }
      const normalized = normalizeHandle(kind, raw);
      if (!normalized) {
        return fail('IDENTIFIER_INVALID', `${kind.toLowerCase()} is not a valid identifier`);
      }
      const hash = handleLookupHash(this.keys, kind, normalized);
      if (!hash) {
        return fail('CRYPTO_UNAVAILABLE', 'login-handle pepper is unavailable');
      }
      if (this.store.findHandle(kind, hash)) {
        return fail('IDENTIFIER_UNAVAILABLE', 'identifier is not available');
      }
      handles.push({ kind, normalized, hash });
    }
    if (handles.length === 0) {
      return fail('IDENTIFIER_REQUIRED', 'email or phone is required');
    }
    const identity = this.identity.createPersonIdentity({
      homeJurisdiction: input.homeJurisdiction,
    });
    const activated = this.identity.activateIdentity(identity.id);
    if (!activated.ok) {
      return fail(activated.error.code, activated.error.message);
    }
    const digest = await hashPassword(input.password);
    this.store.passwords.set(
      identity.id,
      Object.freeze({
        credentialId: asPasswordCredentialId(`pwd_${newSecurityToken()}`),
        identityId: identity.id,
        digest,
        createdAt: this.clock.now(),
        rotatedAt: null,
      }),
    );
    for (const handle of handles) {
      this.store.putHandle(
        Object.freeze({
          handleId: asLoginHandleId(`hdl_${newSecurityToken()}`),
          identityId: identity.id,
          kind: handle.kind,
          lookupHash: handle.hash,
          verificationState: 'UNVERIFIED',
          createdAt: this.clock.now(),
        }),
      );
    }
    this.store.terms.set(
      identity.id,
      Object.freeze({
        identityId: identity.id,
        termsVersion: input.termsVersion.trim(),
        acceptedAt: this.clock.now(),
      }),
    );
    this.record('REGISTRATION', {
      identityId: identity.id,
      reasonCode: 'REGISTERED',
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return ok({
      identityId: identity.id,
      actorId: this.actorIdFor(identity.id),
      verificationState: 'UNVERIFIED',
      kycCompleted: false,
      termsVersion: input.termsVersion.trim(),
    });
  }

  async authenticate(input: AuthenticateInput): Promise<Result<AuthenticateResult, AuthFailure>> {
    const ipLimit = this.limit('login', this.ipKey(input.ip));
    if (!ipLimit.ok) {
      return ipLimit;
    }
    const resolved = this.resolveHandle(input.email, input.phone);
    if (!resolved.ok) {
      await verifyPassword(input.password, null);
      this.record('LOGIN_FAILURE', { reasonCode: 'IDENTIFIER_INVALID', ip: input.ip, userAgent: input.userAgent });
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    const handleLimit = this.limit('loginHandle', `h:${resolved.value.hash}`);
    if (!handleLimit.ok) {
      return handleLimit;
    }
    const handle = this.store.findHandle(resolved.value.kind, resolved.value.hash);
    const password = handle ? this.store.passwords.get(handle.identityId) ?? null : null;
    const matches = await verifyPassword(input.password, password?.digest ?? null);
    if (!handle || !password || !matches) {
      this.record('LOGIN_FAILURE', {
        identityId: handle?.identityId ?? null,
        reasonCode: 'CREDENTIAL_INVALID',
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    const person = this.identity.store.identities.get(handle.identityId);
    if (!person || person.status === 'SUSPENDED' || person.status === 'LOCKED' || person.status === 'CLOSED') {
      this.record('LOGIN_FAILURE', {
        identityId: handle.identityId,
        reasonCode: 'IDENTITY_BLOCKED',
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    const totp = this.store.totp.get(handle.identityId);
    if (totp?.confirmedAt) {
      const challenge = this.issueChallenge({
        identityId: handle.identityId,
        purpose: 'MFA_LOGIN',
        ttlMs: MFA_CHALLENGE_TTL_MS,
        factors: ['PASSWORD', 'TOTP'],
        deviceRef: input.deviceRef,
      });
      this.record('MFA_CHALLENGE', {
        identityId: handle.identityId,
        reasonCode: 'TOTP_REQUIRED',
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return ok({
        status: 'MFA_REQUIRED',
        mfaToken: challenge.token,
        methods: Object.freeze(['TOTP'] as const),
      });
    }
    return this.completeAuthenticatedSession({
      identityId: handle.identityId,
      factors: ['PASSWORD'],
      deviceRef: input.deviceRef,
      ip: input.ip,
      userAgent: input.userAgent,
      stepUp: false,
    });
  }

  logout(accessToken: string): Result<IdentitySession, AuthFailure> {
    const authenticated = this.authenticateRequest(accessToken);
    if (!authenticated.ok) {
      return fail(authenticated.error.code, authenticated.error.message);
    }
    return this.revokeSession(authenticated.value.session.sessionId, authenticated.value);
  }

  refreshSession(input: {
    readonly refreshToken: string;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Result<TokenBundle, AuthFailure> {
    const limited = this.limit('refresh', this.ipKey(input.ip));
    if (!limited.ok) {
      return limited;
    }
    const hash = hashRefreshToken(input.refreshToken);
    const current = this.store.findRefreshByHash(hash);
    if (!current) {
      this.record('SUSPICIOUS_AUTHENTICATION', { reasonCode: 'REFRESH_UNKNOWN', ip: input.ip, userAgent: input.userAgent });
      return fail('REFRESH_INVALID', 'refresh token is invalid');
    }
    if (current.revokedAt !== null || current.replacedBy !== null) {
      this.revokeRefreshFamily(current.familyId, 'reuse');
      const session = this.identity.store.sessions.get(current.sessionId);
      if (session && session.revocationState === 'ACTIVE') {
        this.identity.revokeSession(session.sessionId, 'refresh_reuse');
      }
      this.record('SUSPICIOUS_AUTHENTICATION', {
        identityId: current.identityId,
        sessionId: current.sessionId,
        reasonCode: 'REFRESH_REUSE',
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return fail('REFRESH_REUSE', 'refresh token reuse detected');
    }
    if (isExpired(current.expiresAt, this.clock.now())) {
      return fail('REFRESH_EXPIRED', 'refresh token has expired');
    }
    const usable = this.requireUsableSession(current.sessionId);
    if (!usable.ok) {
      return usable;
    }
    const rotated = rotateRefreshToken(current.familyId);
    const now = this.clock.now();
    const nextId = asRefreshTokenId(`rfr_${newSecurityToken()}`);
    this.store.putRefresh(
      Object.freeze({
        ...current,
        revokedAt: now,
        replacedBy: nextId,
      }),
    );
    this.store.putRefresh(
      Object.freeze({
        refreshId: nextId,
        sessionId: current.sessionId,
        identityId: current.identityId,
        tokenHash: rotated.hash,
        familyId: current.familyId,
        createdAt: now,
        expiresAt: refreshExpiry(this.clock),
        revokedAt: null,
        replacedBy: null,
        reuseDetectedAt: null,
      }),
    );
    const extended = Object.freeze({
      ...usable.value,
      lastUsedAt: now,
      expiresAt: addMs(now, SESSION_TTL_MS),
      ipHash: networkMetadataHash(this.keys, 'ip', input.ip) ?? usable.value.ipHash,
      userAgentHash: networkMetadataHash(this.keys, 'ua', input.userAgent) ?? usable.value.userAgentHash,
    });
    this.identity.store.sessions.set(extended.sessionId, extended);
    return this.bundle(extended, rotated.token, refreshExpiry(this.clock));
  }

  revokeSession(sessionId: SessionId, caller: AuthenticatedRequestContext): Result<IdentitySession, AuthFailure> {
    if (caller.session.subjectId !== this.identity.store.sessions.get(sessionId)?.subjectId) {
      return fail('SESSION_NOT_FOUND', 'session does not exist');
    }
    const revoked = this.identity.revokeSession(sessionId, 'user_revoke');
    if (!revoked.ok) {
      return fail(revoked.error.code, revoked.error.message);
    }
    this.revokeRefreshForSession(sessionId, 'session_revoked');
    this.record('SESSION_REVOKED', {
      identityId: caller.identityId,
      sessionId,
      reasonCode: 'REVOKED',
    });
    return ok(revoked.value);
  }

  listSessions(caller: AuthenticatedRequestContext): readonly IdentitySession[] {
    return Object.freeze(
      [...this.identity.store.sessions.values()].filter((session) => session.subjectId === caller.identityId),
    );
  }

  revokeAllOtherSessions(caller: AuthenticatedRequestContext): Result<{ readonly revoked: number }, AuthFailure> {
    let revoked = 0;
    for (const session of this.identity.store.sessions.values()) {
      if (session.subjectId === caller.identityId && session.sessionId !== caller.session.sessionId && session.revocationState === 'ACTIVE') {
        this.identity.revokeSession(session.sessionId, 'revoke_others');
        this.revokeRefreshForSession(session.sessionId, 'revoke_others');
        revoked += 1;
      }
    }
    this.record('SESSION_REVOKED', {
      identityId: caller.identityId,
      sessionId: caller.session.sessionId,
      reasonCode: 'REVOKE_OTHERS',
    });
    return ok({ revoked });
  }

  beginMfa(caller: AuthenticatedRequestContext): Result<{ readonly mfaToken: string; readonly methods: readonly AuthenticationFactor[] }, AuthFailure> {
    const limited = this.limit('mfa', caller.identityId);
    if (!limited.ok) {
      return limited;
    }
    const totp = this.store.totp.get(caller.identityId);
    if (!totp?.confirmedAt) {
      return fail('MFA_NOT_ENROLLED', 'TOTP is not enrolled');
    }
    const challenge = this.issueChallenge({
      identityId: caller.identityId,
      purpose: 'MFA_STEP_UP',
      ttlMs: MFA_CHALLENGE_TTL_MS,
      factors: [...caller.session.factors, 'TOTP'],
      sessionId: caller.session.sessionId,
    });
    this.record('MFA_CHALLENGE', {
      identityId: caller.identityId,
      sessionId: caller.session.sessionId,
      reasonCode: 'STEP_UP',
    });
    return ok({ mfaToken: challenge.token, methods: Object.freeze(['TOTP'] as const) });
  }

  async verifyMfa(input: {
    readonly mfaToken: string;
    readonly code: string;
    readonly deviceRef?: string;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Promise<Result<TokenBundle, AuthFailure>> {
    const limited = this.limit('mfa', this.ipKey(input.ip));
    if (!limited.ok) {
      return limited;
    }
    const challenge = this.peekChallenge(input.mfaToken, ['MFA_LOGIN', 'MFA_STEP_UP']);
    if (!challenge.ok) {
      this.record('MFA_FAILURE', { reasonCode: challenge.error.code, ip: input.ip, userAgent: input.userAgent });
      return challenge;
    }
    if (!challenge.value.identityId) {
      return fail('MFA_INVALID', 'MFA challenge is invalid');
    }
    const totp = this.store.totp.get(challenge.value.identityId);
    if (!totp?.confirmedAt) {
      return fail('MFA_NOT_ENROLLED', 'TOTP is not enrolled');
    }
    const opened = this.keys.decrypt(totp.secretEnvelope);
    if (!opened.ok) {
      return fail('CRYPTO_UNAVAILABLE', 'TOTP secret cannot be opened');
    }
    const unix = Math.floor(Date.parse(this.clock.now()) / 1000);
    if (!verifyTotp(opened.value, input.code, unix)) {
      this.store.putChallenge(
        Object.freeze({ ...challenge.value, failedAttempts: challenge.value.failedAttempts + 1 }),
      );
      this.record('MFA_FAILURE', {
        identityId: challenge.value.identityId,
        reasonCode: 'TOTP_INVALID',
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return fail('MFA_INVALID', 'MFA verification failed');
    }
    const consumed = this.consumeChallenge(input.mfaToken, ['MFA_LOGIN', 'MFA_STEP_UP']);
    if (!consumed.ok) {
      return consumed;
    }
    if (consumed.value.purpose === 'MFA_STEP_UP' && consumed.value.sessionId) {
      return this.elevateSession(consumed.value.sessionId, [...consumed.value.factors], input);
    }
    return this.completeAuthenticatedSession({
      identityId: consumed.value.identityId!,
      factors: ['PASSWORD', 'TOTP'],
      deviceRef: input.deviceRef,
      ip: input.ip,
      userAgent: input.userAgent,
      stepUp: false,
    });
  }

  enrollTotp(caller: AuthenticatedRequestContext): Result<
    { readonly secretBase32: string; readonly otpauth: string; readonly enrollToken: string },
    AuthFailure
  > {
    const existing = this.store.totp.get(caller.identityId);
    if (existing?.confirmedAt) {
      return fail('MFA_ALREADY_ENROLLED', 'TOTP is already enrolled');
    }
    const generated = generateTotpSecret();
    const sealed = this.keys.encrypt('DATA_ENCRYPTION', generated.secretBytes);
    if (!sealed.ok) {
      return fail('CRYPTO_UNAVAILABLE', sealed.error.message);
    }
    this.store.totp.set(
      caller.identityId,
      Object.freeze({
        credentialId: asTotpCredentialId(`totp_${newSecurityToken()}`),
        identityId: caller.identityId,
        secretEnvelope: sealed.value,
        confirmedAt: null,
        createdAt: this.clock.now(),
      }),
    );
    const challenge = this.issueChallenge({
      identityId: caller.identityId,
      purpose: 'TOTP_ENROLL',
      ttlMs: MFA_CHALLENGE_TTL_MS,
      factors: [...caller.session.factors],
      sessionId: caller.session.sessionId,
    });
    return ok({
      secretBase32: generated.secretBase32,
      otpauth: otpauthUri({
        issuer: TOTP_ISSUER,
        accountLabel: caller.identityId,
        secretBase32: generated.secretBase32,
      }),
      enrollToken: challenge.token,
    });
  }

  confirmTotpEnrollment(
    caller: AuthenticatedRequestContext,
    enrollToken: string,
    code: string,
  ): Result<{ readonly enrolled: true }, AuthFailure> {
    const challenge = this.consumeChallenge(enrollToken, ['TOTP_ENROLL']);
    if (!challenge.ok) {
      return challenge;
    }
    const totp = this.store.totp.get(caller.identityId);
    if (!totp) {
      return fail('MFA_NOT_ENROLLED', 'TOTP enrollment was not started');
    }
    const opened = this.keys.decrypt(totp.secretEnvelope);
    if (!opened.ok) {
      return fail('CRYPTO_UNAVAILABLE', 'TOTP secret cannot be opened');
    }
    const unix = Math.floor(Date.parse(this.clock.now()) / 1000);
    if (!verifyTotp(opened.value, code, unix)) {
      this.record('MFA_FAILURE', { identityId: caller.identityId, reasonCode: 'TOTP_ENROLL_INVALID' });
      return fail('MFA_INVALID', 'MFA verification failed');
    }
    this.store.totp.set(caller.identityId, Object.freeze({ ...totp, confirmedAt: this.clock.now() }));
    this.record('CREDENTIAL_CHANGED', { identityId: caller.identityId, reasonCode: 'TOTP_ENROLLED' });
    return ok({ enrolled: true });
  }

  beginPasskeyRegistration(
    caller: AuthenticatedRequestContext,
    rpId?: string,
    origin?: string,
  ): Result<WebAuthnChallenge, AuthFailure> {
    const limited = this.limit('passkey', caller.identityId);
    if (!limited.ok) {
      return limited;
    }
    if (ENVIRONMENT !== 'simulation' && !isProductionWebAuthnAvailable()) {
      return fail('WEBAUTHN_UNAVAILABLE', WEBAUTHN_PRODUCTION_BLOCKER.message);
    }
    return ok(this.identity.beginPasskeyRegistration(caller.identityId, rpId, origin));
  }

  completePasskeyRegistration(
    caller: AuthenticatedRequestContext,
    response: WebAuthnRegistrationResponse,
    deviceRef?: string,
  ): Result<WebAuthnCredential, AuthFailure> {
    const registered = this.identity.completePasskeyRegistration(response, deviceRef);
    if (!registered.ok) {
      return fail(registered.error.code, registered.error.message);
    }
    this.record('PASSKEY_ADDED', {
      identityId: caller.identityId,
      deviceId: registered.value.deviceId,
      reasonCode: 'PASSKEY_REGISTERED',
    });
    return ok(registered.value);
  }

  beginPasskeyAuthentication(identityHint: { readonly email?: string; readonly phone?: string }, rpId?: string, origin?: string, ip?: string): Result<WebAuthnChallenge, AuthFailure> {
    const limited = this.limit('passkey', this.ipKey(ip));
    if (!limited.ok) {
      return limited;
    }
    if (ENVIRONMENT !== 'simulation' && !isProductionWebAuthnAvailable()) {
      return fail('WEBAUTHN_UNAVAILABLE', WEBAUTHN_PRODUCTION_BLOCKER.message);
    }
    const resolved = this.resolveHandle(identityHint.email, identityHint.phone);
    if (!resolved.ok) {
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    const handle = this.store.findHandle(resolved.value.kind, resolved.value.hash);
    if (!handle) {
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    return ok(this.identity.beginPasskeyAuthentication(handle.identityId, rpId, origin));
  }

  verifyPasskey(input: {
    readonly response: WebAuthnAuthenticationResponse;
    readonly deviceRef?: string;
    readonly ip?: string;
    readonly userAgent?: string;
    readonly stepUp?: boolean;
  }): Result<TokenBundle, AuthFailure> {
    const actorId = `actor_passkey_${secureRandomHex(8)}`;
    const authenticated = this.identity.authenticatePasskey(input.response, actorId, input.deviceRef, input.stepUp === true);
    if (!authenticated.ok) {
      this.record('LOGIN_FAILURE', { reasonCode: authenticated.error.code, ip: input.ip, userAgent: input.userAgent });
      return fail(authenticated.error.code, authenticated.error.message);
    }
    this.bindActor(authenticated.value.session.subjectId, authenticated.value.session.actorId);
    return this.attachTokens(authenticated.value.session, input.ip, input.userAgent);
  }

  listTrustedDevices(caller: AuthenticatedRequestContext): readonly RegisteredDevice[] {
    return Object.freeze(
      [...this.identity.store.devices.values()].filter((device) => device.identityId === caller.identityId),
    );
  }

  revokeDevice(caller: AuthenticatedRequestContext, deviceId: DeviceId): Result<RegisteredDevice, AuthFailure> {
    const device = this.identity.getDevice(deviceId);
    if (!device || device.identityId !== caller.identityId) {
      return fail('DEVICE_NOT_FOUND', 'device does not exist');
    }
    const updated = this.identity.setDeviceTrust(deviceId, 'BLOCKED');
    if (!updated.ok) {
      return fail(updated.error.code, updated.error.message);
    }
    this.record('DEVICE_REVOKED', {
      identityId: caller.identityId,
      deviceId,
      reasonCode: 'REVOKED',
    });
    return ok(updated.value);
  }

  trustDevice(caller: AuthenticatedRequestContext, deviceId: DeviceId): Result<RegisteredDevice, AuthFailure> {
    const stepUp = evaluateStepUp(caller.session, 'STANDARD');
    if (!stepUp.ok) {
      return fail(stepUp.error.code, stepUp.error.message);
    }
    if (stepUp.value.required) {
      return fail('STEP_UP_REQUIRED', 'trusting a device requires additional authentication');
    }
    const device = this.identity.getDevice(deviceId);
    if (!device || device.identityId !== caller.identityId) {
      return fail('DEVICE_NOT_FOUND', 'device does not exist');
    }
    const updated = this.identity.setDeviceTrust(deviceId, 'TRUSTED');
    if (!updated.ok) {
      return fail(updated.error.code, updated.error.message);
    }
    this.record('DEVICE_TRUSTED', { identityId: caller.identityId, deviceId, reasonCode: 'TRUSTED' });
    return ok(updated.value);
  }

  beginRecovery(input: { readonly email?: string; readonly phone?: string; readonly ip?: string; readonly userAgent?: string }): Result<
    { readonly accepted: true },
    AuthFailure
  > {
    const limited = this.limit('recovery', this.ipKey(input.ip));
    if (!limited.ok) {
      return limited;
    }
    const resolved = this.resolveHandle(input.email, input.phone);
    if (resolved.ok) {
      const handle = this.store.findHandle(resolved.value.kind, resolved.value.hash);
      if (handle) {
        const challenge = this.issueChallenge({
          identityId: handle.identityId,
          purpose: 'RECOVERY',
          ttlMs: RECOVERY_CHALLENGE_TTL_MS,
          factors: ['RECOVERY'],
        });
        this.identity.requestRecovery(handle.identityId);
        this.record('RECOVERY_STARTED', {
          identityId: handle.identityId,
          reasonCode: 'RECOVERY_CHALLENGE_ISSUED',
          ip: input.ip,
          userAgent: input.userAgent,
        });
        void challenge;
      }
    }
    return ok({ accepted: true });
  }

  /**
   * Test/operator hook: issue the recovery token for an identity that already
   * started recovery. Not an HTTP enumeration oracle — beginRecovery stays opaque.
   */
  debugRecoveryTokenFor(identityId: SolsticeIdentityId): string | null {
    if (ENVIRONMENT !== 'simulation') {
      return null;
    }
    for (const challenge of this.store.challenges.values()) {
      if (challenge.identityId === identityId && challenge.purpose === 'RECOVERY' && challenge.consumedAt === null) {
        return [...this.store.challengeByHash.entries()].find(([, id]) => id === challenge.challengeId)?.[0] ?? null;
      }
    }
    return null;
  }

  peekIssuedRecoveryToken(identityId: SolsticeIdentityId): string | null {
    return this.issuedChallengeTokens.get(`RECOVERY:${identityId}`) ?? null;
  }

  async completeRecovery(input: {
    readonly recoveryToken: string;
    readonly newPassword: string;
    readonly totpCode?: string;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Promise<Result<{ readonly recovered: true }, AuthFailure>> {
    const limited = this.limit('recovery', this.ipKey(input.ip));
    if (!limited.ok) {
      return limited;
    }
    const passwordError = assertPasswordPolicy(input.newPassword);
    if (passwordError) {
      return fail('PASSWORD_POLICY', passwordError);
    }
    const challenge = this.consumeChallenge(input.recoveryToken, ['RECOVERY']);
    if (!challenge.ok || !challenge.value.identityId) {
      await verifyPassword(input.newPassword, null);
      return fail('RECOVERY_INVALID', 'recovery challenge is invalid');
    }
    const identityId = challenge.value.identityId;
    const totp = this.store.totp.get(identityId);
    if (totp?.confirmedAt) {
      if (!input.totpCode) {
        return fail('RECOVERY_STEP_UP_REQUIRED', 'high-risk recovery requires additional verification');
      }
      const opened = this.keys.decrypt(totp.secretEnvelope);
      if (!opened.ok) {
        return fail('CRYPTO_UNAVAILABLE', 'TOTP secret cannot be opened');
      }
      const unix = Math.floor(Date.parse(this.clock.now()) / 1000);
      if (!verifyTotp(opened.value, input.totpCode, unix)) {
        this.record('MFA_FAILURE', { identityId, reasonCode: 'RECOVERY_TOTP_INVALID', ip: input.ip });
        return fail('RECOVERY_INVALID', 'recovery challenge is invalid');
      }
    }
    const digest = await hashPassword(input.newPassword);
    const existing = this.store.passwords.get(identityId);
    this.store.passwords.set(
      identityId,
      Object.freeze({
        credentialId: existing?.credentialId ?? asPasswordCredentialId(`pwd_${newSecurityToken()}`),
        identityId,
        digest,
        createdAt: existing?.createdAt ?? this.clock.now(),
        rotatedAt: this.clock.now(),
      }),
    );
    this.identity.revokeAllSessions(identityId);
    for (const refresh of this.store.refreshSessions.values()) {
      if (refresh.identityId === identityId && refresh.revokedAt === null) {
        this.store.putRefresh(Object.freeze({ ...refresh, revokedAt: this.clock.now() }));
      }
    }
    this.record('RECOVERY_COMPLETED', { identityId, reasonCode: 'PASSWORD_ROTATED', ip: input.ip, userAgent: input.userAgent });
    this.record('CREDENTIAL_CHANGED', { identityId, reasonCode: 'PASSWORD_RECOVERY' });
    return ok({ recovered: true });
  }

  async changePassword(
    caller: AuthenticatedRequestContext,
    currentPassword: string,
    nextPassword: string,
  ): Promise<Result<{ readonly changed: true }, AuthFailure>> {
    const passwordError = assertPasswordPolicy(nextPassword);
    if (passwordError) {
      return fail('PASSWORD_POLICY', passwordError);
    }
    const existing = this.store.passwords.get(caller.identityId) ?? null;
    if (!(await verifyPassword(currentPassword, existing?.digest ?? null))) {
      return fail('CREDENTIAL_INVALID', 'credentials are invalid');
    }
    const digest = await hashPassword(nextPassword);
    this.store.passwords.set(
      caller.identityId,
      Object.freeze({
        credentialId: existing?.credentialId ?? asPasswordCredentialId(`pwd_${newSecurityToken()}`),
        identityId: caller.identityId,
        digest,
        createdAt: existing?.createdAt ?? this.clock.now(),
        rotatedAt: this.clock.now(),
      }),
    );
    this.record('CREDENTIAL_CHANGED', { identityId: caller.identityId, reasonCode: 'PASSWORD_CHANGED' });
    return ok({ changed: true });
  }

  requireAssurance(
    caller: AuthenticatedRequestContext,
    needed: AuthenticationAssurance,
  ): Result<{ readonly satisfied: true } | { readonly satisfied: false; readonly needed: AuthenticationAssurance; readonly current: AuthenticationAssurance }, AuthFailure> {
    const decision = evaluateStepUp(caller.session, needed);
    if (!decision.ok) {
      return fail(decision.error.code, decision.error.message);
    }
    if (decision.value.required) {
      return ok({ satisfied: false, needed: decision.value.needed, current: decision.value.current });
    }
    return ok({ satisfied: true });
  }

  authenticateRequest(accessToken: string): Result<AuthenticatedRequestContext, AuthFailure> {
    const claims = verifyAccessToken(this.keys, this.clock, accessToken);
    if (!claims.ok) {
      return fail(claims.error.code === 'ACCESS_TOKEN_EXPIRED' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED', claims.error.message);
    }
    const session = this.identity.store.sessions.get(asSessionId(claims.value.sid));
    if (!session) {
      return fail('AUTH_REQUIRED', 'session does not exist');
    }
    if (session.actorId !== claims.value.aid) {
      return fail('AUTH_REQUIRED', 'session actor mismatch');
    }
    if (session.revocationState === 'REVOKED' || session.revokedAt !== null) {
      return fail('SESSION_REVOKED', 'session has been revoked');
    }
    if (isExpired(session.expiresAt, this.clock.now())) {
      return fail('SESSION_EXPIRED', 'session has expired');
    }
    const resolved = this.identity.resolveActorContext(session.actorId);
    if (!resolved.ok) {
      return fail(resolved.error.code, resolved.error.message);
    }
    const person = this.identity.store.identities.get(session.subjectId);
    if (!person) {
      return fail('AUTH_REQUIRED', 'identity does not exist');
    }
    const device = session.deviceId ? this.identity.getDevice(session.deviceId) ?? null : null;
    if (device?.trustState === 'BLOCKED') {
      return fail('DEVICE_REVOKED', 'session device is blocked');
    }
    const touched = Object.freeze({ ...session, lastUsedAt: this.clock.now() });
    this.identity.store.sessions.set(touched.sessionId, touched);
    return ok({
      identityId: session.subjectId,
      actorId: session.actorId,
      session: touched,
      device,
      authenticationStrength: session.authenticationStrength,
      context: resolved.value,
    });
  }

  listSecurityEvents(identityId: SolsticeIdentityId): readonly IdentitySecurityEvent[] {
    return Object.freeze(this.store.securityEvents.filter((event) => event.identityId === identityId));
  }

  webauthnProductionStatus(): typeof WEBAUTHN_PRODUCTION_BLOCKER {
    return WEBAUTHN_PRODUCTION_BLOCKER;
  }

  totpCodeForTests(identityId: SolsticeIdentityId): string | null {
    if (ENVIRONMENT !== 'simulation') {
      return null;
    }
    const totp = this.store.totp.get(identityId);
    if (!totp) {
      return null;
    }
    const opened = this.keys.decrypt(totp.secretEnvelope);
    if (!opened.ok) {
      return null;
    }
    return totpAt(opened.value, Math.floor(Date.parse(this.clock.now()) / 1000));
  }

  private readonly issuedChallengeTokens = new Map<string, string>();

  private actorIdFor(identityId: SolsticeIdentityId): string {
    return `actor_${identityId}`;
  }

  private bindActor(identityId: SolsticeIdentityId, actorId: string): void {
    this.identity.bindActor(actorId, identityId);
  }

  private resolveHandle(email: string | undefined, phone: string | undefined): Result<{ kind: LoginHandleKind; hash: string }, AuthFailure> {
    if (email) {
      const normalized = normalizeHandle('EMAIL', email);
      const hash = normalized ? handleLookupHash(this.keys, 'EMAIL', normalized) : null;
      if (!normalized || !hash) {
        return fail('IDENTIFIER_INVALID', 'email is not a valid identifier');
      }
      return ok({ kind: 'EMAIL', hash });
    }
    if (phone) {
      const normalized = normalizeHandle('PHONE', phone);
      const hash = normalized ? handleLookupHash(this.keys, 'PHONE', normalized) : null;
      if (!normalized || !hash) {
        return fail('IDENTIFIER_INVALID', 'phone is not a valid identifier');
      }
      return ok({ kind: 'PHONE', hash });
    }
    return fail('IDENTIFIER_REQUIRED', 'email or phone is required');
  }

  private limit(purpose: AuthRateLimitPurpose, key: string): Result<true, AuthFailure> {
    const nowMs = Date.parse(this.clock.now());
    const decision = this.limiter.consume(purpose, key, nowMs);
    if (!decision.allowed) {
      return fail('RATE_LIMITED', `${purpose} rate limit exceeded`, decision.retryAfterMs);
    }
    return ok(true);
  }

  private ipKey(ip: string | undefined): string {
    return networkMetadataHash(this.keys, 'ip', ip) ?? 'ip:unknown';
  }

  private requireUsableSession(sessionId: SessionId): Result<IdentitySession, AuthFailure> {
    const session = this.identity.store.sessions.get(sessionId);
    if (!session) {
      return fail('SESSION_NOT_FOUND', 'session does not exist');
    }
    if (session.revocationState !== 'ACTIVE' || session.revokedAt !== null) {
      return fail('SESSION_REVOKED', 'session has been revoked');
    }
    if (isExpired(session.expiresAt, this.clock.now())) {
      return fail('SESSION_EXPIRED', 'session has expired');
    }
    return ok(session);
  }

  private completeAuthenticatedSession(input: {
    readonly identityId: SolsticeIdentityId;
    readonly factors: readonly AuthenticationFactor[];
    readonly deviceRef?: string;
    readonly ip?: string;
    readonly userAgent?: string;
    readonly stepUp: boolean;
  }): Result<TokenBundle, AuthFailure> {
    const actorId = this.actorIdFor(input.identityId);
    this.bindActor(input.identityId, actorId);
    let deviceId: DeviceId | null = null;
    let newDevice = false;
    if (input.deviceRef) {
      const before = [...this.identity.store.devices.values()].find(
        (device) => device.identityId === input.identityId && device.deviceRef === input.deviceRef,
      );
      const device = this.identity.registerDevice(input.identityId, input.deviceRef, input.factors.includes('PASSKEY') ? 'PASSKEY' : 'PASSWORD');
      if (device.trustState === 'BLOCKED') {
        return fail('DEVICE_REVOKED', 'device is blocked');
      }
      deviceId = device.deviceId;
      newDevice = before === undefined;
    }
    const session = this.identity.createSession({
      subjectId: input.identityId,
      actorId,
      assurance: assuranceFromFactors(input.factors, input.stepUp),
      factors: input.factors,
      deviceId,
      ipHash: networkMetadataHash(this.keys, 'ip', input.ip),
      userAgentHash: networkMetadataHash(this.keys, 'ua', input.userAgent),
    });
    if (newDevice) {
      this.record('NEW_DEVICE', {
        identityId: input.identityId,
        sessionId: session.sessionId,
        deviceId,
        reasonCode: 'FIRST_SEEN',
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }
    this.record('LOGIN_SUCCESS', {
      identityId: input.identityId,
      sessionId: session.sessionId,
      deviceId,
      reasonCode: 'AUTHENTICATED',
      ip: input.ip,
      userAgent: input.userAgent,
      authenticationStrength: session.authenticationStrength,
    });
    return this.attachTokens(session, input.ip, input.userAgent);
  }

  private elevateSession(
    sessionId: SessionId,
    factors: readonly AuthenticationFactor[],
    input: { readonly ip?: string; readonly userAgent?: string },
  ): Result<TokenBundle, AuthFailure> {
    const session = this.identity.store.sessions.get(sessionId);
    if (!session) {
      return fail('SESSION_NOT_FOUND', 'session does not exist');
    }
    const next = Object.freeze({
      ...session,
      factors: Object.freeze([...factors]),
      authenticationStrength: assuranceFromFactors(factors, true),
      lastUsedAt: this.clock.now(),
    });
    this.identity.store.sessions.set(sessionId, next);
    return this.attachTokens(next, input.ip, input.userAgent);
  }

  private attachTokens(session: IdentitySession, ip?: string, userAgent?: string): Result<TokenBundle, AuthFailure> {
    const issued = issueRefreshToken();
    this.store.putRefresh(
      Object.freeze({
        refreshId: asRefreshTokenId(`rfr_${newSecurityToken()}`),
        sessionId: session.sessionId,
        identityId: session.subjectId,
        tokenHash: issued.hash,
        familyId: issued.familyId,
        createdAt: this.clock.now(),
        expiresAt: refreshExpiry(this.clock),
        revokedAt: null,
        replacedBy: null,
        reuseDetectedAt: null,
      }),
    );
    return this.bundle(session, issued.token, refreshExpiry(this.clock));
  }

  private bundle(session: IdentitySession, refreshToken: string, refreshExpiresAt: UtcInstant): Result<TokenBundle, AuthFailure> {
    const access = issueAccessToken(this.keys, this.clock, {
      sessionId: session.sessionId,
      actorId: session.actorId,
    });
    if (!access.ok) {
      return fail(access.error.code, access.error.message);
    }
    const context = this.identity.issueContext(session);
    if (!context.ok) {
      return fail(context.error.code, context.error.message);
    }
    return ok({
      accessToken: access.value.token,
      refreshToken,
      accessExpiresAt: access.value.claims.exp,
      refreshExpiresAt,
      session,
      context: context.value,
      authenticationStrength: session.authenticationStrength,
    });
  }

  private issueChallenge(input: {
    readonly identityId: SolsticeIdentityId | null;
    readonly purpose: AuthChallenge['purpose'];
    readonly ttlMs: bigint;
    readonly factors: readonly AuthenticationFactor[];
    readonly sessionId?: SessionId;
    readonly deviceRef?: string;
  }): { readonly token: string; readonly challenge: AuthChallenge } {
    const token = `sr_ch_${secureRandomHex(24)}`;
    const challenge: AuthChallenge = Object.freeze({
      challengeId: asAuthChallengeId(`ach_${newSecurityToken()}`),
      identityId: input.identityId,
      purpose: input.purpose,
      tokenHash: hashRefreshToken(token),
      expiresAt: addMs(this.clock.now(), input.ttlMs),
      consumedAt: null,
      failedAttempts: 0,
      sessionId: input.sessionId ?? null,
      deviceId: null,
      factors: Object.freeze([...input.factors]),
    });
    this.store.putChallenge(challenge);
    if (input.identityId) {
      this.issuedChallengeTokens.set(`${input.purpose}:${input.identityId}`, token);
    }
    return { token, challenge };
  }

  private peekChallenge(
    token: string,
    purposes: readonly AuthChallenge['purpose'][],
  ): Result<AuthChallenge, AuthFailure> {
    const found = this.store.findChallengeByHash(hashRefreshToken(token));
    if (!found) {
      return fail('CHALLENGE_INVALID', 'challenge is invalid');
    }
    if (!purposes.includes(found.purpose)) {
      return fail('CHALLENGE_INVALID', 'challenge is invalid');
    }
    if (found.consumedAt !== null || found.failedAttempts >= 5) {
      return fail('CHALLENGE_INVALID', 'challenge is invalid');
    }
    if (isExpired(found.expiresAt, this.clock.now())) {
      return fail('CHALLENGE_EXPIRED', 'challenge has expired');
    }
    return ok(found);
  }

  private consumeChallenge(
    token: string,
    purposes: readonly AuthChallenge['purpose'][],
  ): Result<AuthChallenge, AuthFailure> {
    const found = this.peekChallenge(token, purposes);
    if (!found.ok) {
      return found;
    }
    const consumed = Object.freeze({ ...found.value, consumedAt: this.clock.now() });
    this.store.putChallenge(consumed);
    return ok(consumed);
  }

  private revokeRefreshForSession(sessionId: SessionId, _reason: string): void {
    const now = this.clock.now();
    for (const refresh of this.store.refreshSessions.values()) {
      if (refresh.sessionId === sessionId && refresh.revokedAt === null) {
        this.store.putRefresh(Object.freeze({ ...refresh, revokedAt: now }));
      }
    }
  }

  private revokeRefreshFamily(familyId: string, reason: 'reuse' | 'revoke'): void {
    const now = this.clock.now();
    for (const refresh of this.store.refreshSessions.values()) {
      if (refresh.familyId === familyId) {
        this.store.putRefresh(
          Object.freeze({
            ...refresh,
            revokedAt: refresh.revokedAt ?? now,
            reuseDetectedAt: reason === 'reuse' ? now : refresh.reuseDetectedAt,
          }),
        );
      }
    }
  }

  private record(
    kind: SecurityEventKind,
    input: {
      readonly identityId?: SolsticeIdentityId | null;
      readonly sessionId?: SessionId | null;
      readonly deviceId?: DeviceId | null;
      readonly reasonCode: string;
      readonly ip?: string;
      readonly userAgent?: string;
      readonly authenticationStrength?: AuthenticationAssurance | null;
    },
  ): void {
    const event: IdentitySecurityEvent = Object.freeze({
      eventId: asSecurityEventId(`sec_${newSecurityToken()}`),
      kind,
      identityId: input.identityId ?? null,
      sessionId: input.sessionId ?? null,
      deviceId: input.deviceId ?? null,
      authenticationStrength: input.authenticationStrength ?? null,
      ipHash: networkMetadataHash(this.keys, 'ip', input.ip),
      userAgentHash: networkMetadataHash(this.keys, 'ua', input.userAgent),
      reasonCode: input.reasonCode,
      occurredAt: this.clock.now(),
    });
    this.store.securityEvents.push(event);
    this.events?.append({
      eventType: 'IdentitySecurityRecorded',
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      aggregateType: 'identity',
      aggregateId: event.identityId ?? 'identity:unknown',
      payload: {
        identityId: event.identityId ?? 'unknown',
        sessionId: event.sessionId ?? undefined,
        deviceId: event.deviceId ?? undefined,
        kind,
        reason: input.reasonCode,
        trustState: undefined,
      },
    });
    this.evidence?.seal('IDENTITY_SECURITY_EVENT', {
      kind,
      identityId: event.identityId,
      sessionId: event.sessionId,
      reasonCode: input.reasonCode,
    });
  }
}

export type { IdentityFailure };
