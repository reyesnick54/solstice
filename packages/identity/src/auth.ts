import type { UtcInstant } from '../../domain/src/time.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import type { ChallengeId, CredentialId, DeviceId, SessionId, SolsticeIdentityId } from './ids.ts';

export const AUTHENTICATION_FACTORS = [
  'PASSKEY',
  'PASSWORD',
  'TOTP',
  'RECOVERY',
  'HARDWARE_KEY',
  'DEVICE_BOUND',
] as const;

export type AuthenticationFactor = (typeof AUTHENTICATION_FACTORS)[number];

export const WEBAUTHN_CHALLENGE_PURPOSES = ['REGISTRATION', 'AUTHENTICATION'] as const;
export type WebAuthnChallengePurpose = (typeof WEBAUTHN_CHALLENGE_PURPOSES)[number];

export const WEBAUTHN_TRANSPORTS = ['usb', 'nfc', 'ble', 'internal', 'hybrid'] as const;
export type WebAuthnTransport = (typeof WEBAUTHN_TRANSPORTS)[number];

/**
 * Server-side WebAuthn credential. Public material and metadata only.
 * The user's private passkey is never stored.
 */
export type WebAuthnCredential = {
  readonly credentialId: CredentialId;
  readonly identityId: SolsticeIdentityId;
  readonly publicKeyMaterial: string;
  readonly signCount: number;
  readonly transports: readonly WebAuthnTransport[];
  readonly deviceId: DeviceId | null;
  readonly createdAt: UtcInstant;
  readonly lastUsedAt: UtcInstant | null;
};

export type WebAuthnChallenge = {
  readonly challengeId: ChallengeId;
  readonly identityId: SolsticeIdentityId | null;
  readonly purpose: WebAuthnChallengePurpose;
  readonly challenge: string;
  readonly rpId: string;
  readonly origin: string;
  readonly expiresAt: UtcInstant;
  readonly consumedAt: UtcInstant | null;
};

export type WebAuthnRegistrationRequest = {
  readonly identityId: SolsticeIdentityId;
  readonly rpId: string;
  readonly origin: string;
};

export type WebAuthnRegistrationResponse = {
  readonly challengeId: ChallengeId;
  readonly credentialId: string;
  readonly publicKeyMaterial: string;
  readonly transports: readonly WebAuthnTransport[];
  readonly attestationRef: string | null;
};

export type WebAuthnAuthenticationRequest = {
  readonly identityId: SolsticeIdentityId;
  readonly rpId: string;
  readonly origin: string;
};

export type WebAuthnAuthenticationResponse = {
  readonly challengeId: ChallengeId;
  readonly credentialId: string;
  readonly authenticatorData: string;
  readonly clientDataJSON: string;
  readonly signature: string;
  readonly signCount: number;
};

export type WebAuthnRelyingParty = {
  beginRegistration(request: WebAuthnRegistrationRequest, now: UtcInstant): WebAuthnChallenge;
  completeRegistration(
    response: WebAuthnRegistrationResponse,
    now: UtcInstant,
  ): WebAuthnCredential;
  beginAuthentication(request: WebAuthnAuthenticationRequest, now: UtcInstant): WebAuthnChallenge;
  completeAuthentication(
    response: WebAuthnAuthenticationResponse,
    now: UtcInstant,
  ): WebAuthnCredential;
};

export const SESSION_RISK_STATES = ['CLEAR', 'ELEVATED', 'BLOCKED'] as const;
export type SessionRiskState = (typeof SESSION_RISK_STATES)[number];

export const SESSION_REVOCATION_STATES = ['ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type SessionRevocationState = (typeof SESSION_REVOCATION_STATES)[number];

export type IdentitySession = {
  readonly sessionId: SessionId;
  readonly subjectId: SolsticeIdentityId;
  readonly actorId: string;
  readonly authenticationStrength: AuthenticationAssurance;
  readonly factors: readonly AuthenticationFactor[];
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly lastUsedAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
  readonly deviceId: DeviceId | null;
  readonly riskState: SessionRiskState;
  readonly revocationState: SessionRevocationState;
  readonly ipHash: string | null;
  readonly userAgentHash: string | null;
};

export const DEVICE_TRUST_STATES = ['KNOWN', 'TRUSTED', 'REVIEW_REQUIRED', 'BLOCKED'] as const;
export type DeviceTrustState = (typeof DEVICE_TRUST_STATES)[number];

export type RegisteredDevice = {
  readonly deviceId: DeviceId;
  readonly identityId: SolsticeIdentityId;
  readonly deviceRef: string;
  readonly firstSeenAt: UtcInstant;
  readonly lastSeenAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
  readonly authenticationMethod: AuthenticationFactor | null;
  readonly authenticationStrength: AuthenticationAssurance | null;
  readonly trustState: DeviceTrustState;
  readonly riskState: SessionRiskState;
};

export type DeviceRiskSignal = {
  readonly deviceId: DeviceId;
  readonly recommendedState: DeviceTrustState;
  readonly reasonCode: string;
  readonly observedAt: UtcInstant;
};

export type DeviceRiskProvider = {
  assess(device: RegisteredDevice, now: UtcInstant): DeviceRiskSignal;
};
