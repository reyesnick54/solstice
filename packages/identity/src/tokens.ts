/**
 * Compact access tokens and opaque refresh tokens.
 *
 * Access tokens carry sessionId / actorId / expiry only — no email, phone,
 * legal name, or KYC attributes. Integrity is HMAC-SHA256 via SESSION_SIGNING.
 * Refresh tokens are CSPRNG opaques stored as SHA-256 hashes.
 */

import { createHash } from 'node:crypto';

import { addMs, isExpired, type Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { newSecurityToken, secureRandomHex } from '../../security/src/random.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { SessionId } from './ids.ts';

export const ACCESS_TOKEN_TTL_MS = 15n * 60n * 1000n;
export const REFRESH_TOKEN_TTL_MS = 30n * 24n * 60n * 60n * 1000n;
export const ACCESS_TOKEN_PREFIX = 'sr_at.';
export const REFRESH_TOKEN_PREFIX = 'sr_rt.';

export type AccessTokenClaims = {
  readonly v: 1;
  readonly sid: SessionId;
  readonly aid: string;
  readonly iat: UtcInstant;
  readonly exp: UtcInstant;
  readonly kv: number;
};

export type IssuedTokenPair = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenHash: string;
  readonly refreshFamilyId: string;
  readonly accessExpiresAt: UtcInstant;
  readonly refreshExpiresAt: UtcInstant;
};

export type TokenFailure = {
  readonly code: 'ACCESS_TOKEN_INVALID' | 'ACCESS_TOKEN_EXPIRED';
  readonly message: string;
};

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function issueRefreshToken(): { readonly token: string; readonly hash: string; readonly familyId: string } {
  const token = `${REFRESH_TOKEN_PREFIX}${secureRandomHex(32)}`;
  return {
    token,
    hash: hashRefreshToken(token),
    familyId: `rtf_${newSecurityToken()}`,
  };
}

export function rotateRefreshToken(familyId: string): { readonly token: string; readonly hash: string; readonly familyId: string } {
  const token = `${REFRESH_TOKEN_PREFIX}${secureRandomHex(32)}`;
  return { token, hash: hashRefreshToken(token), familyId };
}

export function issueAccessToken(
  keys: KeyProvider,
  clock: Clock,
  input: { readonly sessionId: SessionId; readonly actorId: string },
): Result<{ readonly token: string; readonly claims: AccessTokenClaims }, TokenFailure> {
  const now = clock.now();
  const version = keys.resolveKeyVersion('SESSION_SIGNING');
  if (!version.ok) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: version.error.message });
  }
  const claims: AccessTokenClaims = Object.freeze({
    v: 1,
    sid: input.sessionId,
    aid: input.actorId,
    iat: now,
    exp: addMs(now, ACCESS_TOKEN_TTL_MS),
    kv: version.value.version,
  });
  const payload = encodeClaims(claims);
  const signed = keys.sign('SESSION_SIGNING', payload, claims.kv);
  if (!signed.ok) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: signed.error.message });
  }
  return ok({
    token: `${ACCESS_TOKEN_PREFIX}${Buffer.from(payload, 'utf8').toString('base64url')}.${signed.value.hex}`,
    claims,
  });
}

export function verifyAccessToken(
  keys: KeyProvider,
  clock: Clock,
  token: string,
): Result<AccessTokenClaims, TokenFailure> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: 'access token format is invalid' });
  }
  const raw = token.slice(ACCESS_TOKEN_PREFIX.length);
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: 'access token format is invalid' });
  }
  const body = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: 'access token encoding is invalid' });
  }
  const claims = decodeClaims(payload);
  if (!claims) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: 'access token claims are invalid' });
  }
  const verified = keys.verify('SESSION_SIGNING', payload, signature, claims.kv);
  if (!verified.ok) {
    return err({ code: 'ACCESS_TOKEN_INVALID', message: 'access token integrity is invalid' });
  }
  if (isExpired(claims.exp, clock.now())) {
    return err({ code: 'ACCESS_TOKEN_EXPIRED', message: 'access token has expired' });
  }
  return ok(claims);
}

function encodeClaims(claims: AccessTokenClaims): string {
  return JSON.stringify({
    v: claims.v,
    sid: claims.sid,
    aid: claims.aid,
    iat: claims.iat,
    exp: claims.exp,
    kv: claims.kv,
  });
}

function decodeClaims(payload: string): AccessTokenClaims | null {
  try {
    const parsed = JSON.parse(payload) as Partial<AccessTokenClaims>;
    if (parsed.v !== 1 || typeof parsed.sid !== 'string' || typeof parsed.aid !== 'string') {
      return null;
    }
    if (typeof parsed.iat !== 'string' || typeof parsed.exp !== 'string' || typeof parsed.kv !== 'number') {
      return null;
    }
    if ('email' in parsed || 'phone' in parsed || 'name' in parsed) {
      return null;
    }
    return Object.freeze({
      v: 1,
      sid: parsed.sid as SessionId,
      aid: parsed.aid,
      iat: parsed.iat as UtcInstant,
      exp: parsed.exp as UtcInstant,
      kv: parsed.kv,
    });
  } catch {
    return null;
  }
}

export function refreshExpiry(clock: Clock): UtcInstant {
  return addMs(clock.now(), REFRESH_TOKEN_TTL_MS);
}
