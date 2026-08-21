import type { UtcInstant } from '../../domain/src/time.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import type { DeviceId, SecurityEventId, SessionId, SolsticeIdentityId } from './ids.ts';

export const SECURITY_EVENT_KINDS = [
  'REGISTRATION',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'MFA_CHALLENGE',
  'MFA_FAILURE',
  'NEW_DEVICE',
  'DEVICE_TRUSTED',
  'DEVICE_REVOKED',
  'CREDENTIAL_CHANGED',
  'PASSKEY_ADDED',
  'SESSION_REVOKED',
  'RECOVERY_STARTED',
  'RECOVERY_COMPLETED',
  'SUSPICIOUS_AUTHENTICATION',
] as const;

export type SecurityEventKind = (typeof SECURITY_EVENT_KINDS)[number];

/**
 * Security audit record. Identifiers are hashed or omitted.
 * Passwords, TOTP secrets, refresh tokens, and raw emails are forbidden.
 */
export type IdentitySecurityEvent = {
  readonly eventId: SecurityEventId;
  readonly kind: SecurityEventKind;
  readonly identityId: SolsticeIdentityId | null;
  readonly sessionId: SessionId | null;
  readonly deviceId: DeviceId | null;
  readonly authenticationStrength: AuthenticationAssurance | null;
  readonly ipHash: string | null;
  readonly userAgentHash: string | null;
  readonly reasonCode: string;
  readonly occurredAt: UtcInstant;
};

export function assertSecurityEventRedacted(event: IdentitySecurityEvent, rawSecrets: readonly string[]): void {
  const serialized = JSON.stringify(event);
  for (const secret of rawSecrets) {
    if (secret.length > 0 && serialized.includes(secret)) {
      throw new Error('security event leaked a secret');
    }
  }
}
