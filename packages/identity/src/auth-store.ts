import type { UtcInstant } from '../../domain/src/time.ts';
import type { EncryptedEnvelope } from '../../security/src/envelope.ts';
import type { AuthenticationFactor } from './auth.ts';
import type {
  AuthChallengeId,
  DeviceId,
  LoginHandleId,
  PasswordCredentialId,
  RefreshTokenId,
  SessionId,
  SolsticeIdentityId,
  TotpCredentialId,
} from './ids.ts';
import type { HandleVerificationState, LoginHandle, LoginHandleKind } from './login-handle.ts';
import type { PasswordDigest } from './password.ts';
import type { IdentitySecurityEvent } from './security-events.ts';

export type PasswordCredential = {
  readonly credentialId: PasswordCredentialId;
  readonly identityId: SolsticeIdentityId;
  readonly digest: PasswordDigest;
  readonly createdAt: UtcInstant;
  readonly rotatedAt: UtcInstant | null;
};

export type TotpCredential = {
  readonly credentialId: TotpCredentialId;
  readonly identityId: SolsticeIdentityId;
  readonly secretEnvelope: EncryptedEnvelope;
  readonly confirmedAt: UtcInstant | null;
  readonly createdAt: UtcInstant;
};

export type RefreshSession = {
  readonly refreshId: RefreshTokenId;
  readonly sessionId: SessionId;
  readonly identityId: SolsticeIdentityId;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
  readonly replacedBy: RefreshTokenId | null;
  readonly reuseDetectedAt: UtcInstant | null;
};

export const AUTH_CHALLENGE_PURPOSES = [
  'MFA_LOGIN',
  'MFA_STEP_UP',
  'TOTP_ENROLL',
  'RECOVERY',
  'PASSKEY_REGISTRATION',
  'PASSKEY_AUTHENTICATION',
] as const;
export type AuthChallengePurpose = (typeof AUTH_CHALLENGE_PURPOSES)[number];

export type AuthChallenge = {
  readonly challengeId: AuthChallengeId;
  readonly identityId: SolsticeIdentityId | null;
  readonly purpose: AuthChallengePurpose;
  readonly tokenHash: string;
  readonly expiresAt: UtcInstant;
  readonly consumedAt: UtcInstant | null;
  readonly failedAttempts: number;
  readonly sessionId: SessionId | null;
  readonly deviceId: DeviceId | null;
  readonly factors: readonly AuthenticationFactor[];
};

export type TermsAcknowledgement = {
  readonly identityId: SolsticeIdentityId;
  readonly termsVersion: string;
  readonly acceptedAt: UtcInstant;
};

export type AuthenticationSnapshot = {
  readonly handles: readonly LoginHandle[];
  readonly passwords: readonly PasswordCredential[];
  readonly totp: readonly TotpCredential[];
  readonly refreshSessions: readonly RefreshSession[];
  readonly challenges: readonly AuthChallenge[];
  readonly securityEvents: readonly IdentitySecurityEvent[];
  readonly terms: readonly TermsAcknowledgement[];
};

export class AuthenticationStore {
  readonly handles = new Map<LoginHandleId, LoginHandle>();
  readonly handleByLookup = new Map<string, LoginHandleId>();
  readonly passwords = new Map<SolsticeIdentityId, PasswordCredential>();
  readonly totp = new Map<SolsticeIdentityId, TotpCredential>();
  readonly refreshSessions = new Map<RefreshTokenId, RefreshSession>();
  readonly refreshByHash = new Map<string, RefreshTokenId>();
  readonly challenges = new Map<AuthChallengeId, AuthChallenge>();
  readonly challengeByHash = new Map<string, AuthChallengeId>();
  readonly securityEvents: IdentitySecurityEvent[] = [];
  readonly terms = new Map<SolsticeIdentityId, TermsAcknowledgement>();

  snapshot(): AuthenticationSnapshot {
    return Object.freeze({
      handles: Object.freeze([...this.handles.values()]),
      passwords: Object.freeze([...this.passwords.values()]),
      totp: Object.freeze([...this.totp.values()]),
      refreshSessions: Object.freeze([...this.refreshSessions.values()]),
      challenges: Object.freeze([...this.challenges.values()]),
      securityEvents: Object.freeze([...this.securityEvents]),
      terms: Object.freeze([...this.terms.values()]),
    });
  }

  hydrate(snapshot: AuthenticationSnapshot): void {
    this.handles.clear();
    this.handleByLookup.clear();
    this.passwords.clear();
    this.totp.clear();
    this.refreshSessions.clear();
    this.refreshByHash.clear();
    this.challenges.clear();
    this.challengeByHash.clear();
    this.securityEvents.length = 0;
    this.terms.clear();
    for (const handle of snapshot.handles) {
      this.handles.set(handle.handleId, handle);
      this.handleByLookup.set(`${handle.kind}:${handle.lookupHash}`, handle.handleId);
    }
    for (const password of snapshot.passwords) {
      this.passwords.set(password.identityId, password);
    }
    for (const totp of snapshot.totp) {
      this.totp.set(totp.identityId, totp);
    }
    for (const refresh of snapshot.refreshSessions) {
      this.refreshSessions.set(refresh.refreshId, refresh);
      this.refreshByHash.set(refresh.tokenHash, refresh.refreshId);
    }
    for (const challenge of snapshot.challenges) {
      this.challenges.set(challenge.challengeId, challenge);
      this.challengeByHash.set(challenge.tokenHash, challenge.challengeId);
    }
    this.securityEvents.push(...snapshot.securityEvents);
    for (const term of snapshot.terms) {
      this.terms.set(term.identityId, term);
    }
  }

  putHandle(handle: LoginHandle): void {
    this.handles.set(handle.handleId, handle);
    this.handleByLookup.set(`${handle.kind}:${handle.lookupHash}`, handle.handleId);
  }

  findHandle(kind: LoginHandleKind, lookupHash: string): LoginHandle | undefined {
    const id = this.handleByLookup.get(`${kind}:${lookupHash}`);
    return id ? this.handles.get(id) : undefined;
  }

  putRefresh(session: RefreshSession): void {
    this.refreshSessions.set(session.refreshId, session);
    this.refreshByHash.set(session.tokenHash, session.refreshId);
  }

  findRefreshByHash(hash: string): RefreshSession | undefined {
    const id = this.refreshByHash.get(hash);
    return id ? this.refreshSessions.get(id) : undefined;
  }

  putChallenge(challenge: AuthChallenge): void {
    this.challenges.set(challenge.challengeId, challenge);
    this.challengeByHash.set(challenge.tokenHash, challenge.challengeId);
  }

  findChallengeByHash(hash: string): AuthChallenge | undefined {
    const id = this.challengeByHash.get(hash);
    return id ? this.challenges.get(id) : undefined;
  }

  markHandleVerified(handleId: LoginHandleId, state: HandleVerificationState): void {
    const current = this.handles.get(handleId);
    if (!current) {
      return;
    }
    this.handles.set(handleId, Object.freeze({ ...current, verificationState: state }));
  }
}
