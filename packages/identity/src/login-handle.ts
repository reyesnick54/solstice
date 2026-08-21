import type { UtcInstant } from '../../domain/src/time.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { LoginHandleId, SolsticeIdentityId } from './ids.ts';

export const LOGIN_HANDLE_KINDS = ['EMAIL', 'PHONE'] as const;
export type LoginHandleKind = (typeof LOGIN_HANDLE_KINDS)[number];

export const HANDLE_VERIFICATION_STATES = ['UNVERIFIED', 'VERIFIED'] as const;
export type HandleVerificationState = (typeof HANDLE_VERIFICATION_STATES)[number];

export type LoginHandle = {
  readonly handleId: LoginHandleId;
  readonly identityId: SolsticeIdentityId;
  readonly kind: LoginHandleKind;
  readonly lookupHash: string;
  readonly verificationState: HandleVerificationState;
  readonly createdAt: UtcInstant;
};

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  return trimmed;
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) {
    return null;
  }
  return digits;
}

export function normalizeHandle(kind: LoginHandleKind, value: string): string | null {
  return kind === 'EMAIL' ? normalizeEmail(value) : normalizePhone(value);
}

/**
 * Deterministic lookup hash. Uses SESSION_SIGNING HMAC so the raw identifier
 * is not stored and raw keys never leave KeyProvider.
 */
export function handleLookupHash(keys: KeyProvider, kind: LoginHandleKind, normalized: string): string | null {
  const signed = keys.sign('SESSION_SIGNING', `login-handle:${kind}:${normalized}`);
  if (!signed.ok) {
    return null;
  }
  return signed.value.hex;
}

export function networkMetadataHash(keys: KeyProvider, kind: 'ip' | 'ua', value: string | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  const signed = keys.sign('SESSION_SIGNING', `net:${kind}:${value.trim()}`);
  return signed.ok ? signed.value.hex : null;
}
