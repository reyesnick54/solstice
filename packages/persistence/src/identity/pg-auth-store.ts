import type { Pool } from 'pg';

import type {
  AuthChallenge,
  AuthenticationSnapshot,
  PasswordCredential,
  RefreshSession,
  TotpCredential,
} from '../../../identity/src/auth-store.ts';
import type { LoginHandle } from '../../../identity/src/login-handle.ts';
import type { IdentitySecurityEvent } from '../../../identity/src/security-events.ts';
import type { EncryptedEnvelope } from '../../../security/src/envelope.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistAuthenticationSnapshot(pool: Pool, snapshot: AuthenticationSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const handle of snapshot.handles) {
        await client.query(
          `INSERT INTO identity.login_handle
             (handle_id, identity_id, kind, lookup_hash, verification_state, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (handle_id) DO UPDATE SET verification_state = EXCLUDED.verification_state`,
          [handle.handleId, handle.identityId, handle.kind, handle.lookupHash, handle.verificationState, handle.createdAt],
        );
      }
      for (const password of snapshot.passwords) {
        await client.query(
          `INSERT INTO identity.password_credential
             (credential_id, identity_id, kdf, salt_hex, digest_hex, n, r, p, dk_len, created_at, rotated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (credential_id) DO UPDATE SET
             digest_hex = EXCLUDED.digest_hex,
             salt_hex = EXCLUDED.salt_hex,
             rotated_at = EXCLUDED.rotated_at`,
          [
            password.credentialId,
            password.identityId,
            password.digest.kdf,
            password.digest.saltHex,
            password.digest.digestHex,
            password.digest.N,
            password.digest.r,
            password.digest.p,
            password.digest.dkLen,
            password.createdAt,
            password.rotatedAt,
          ],
        );
      }
      for (const totp of snapshot.totp) {
        await client.query(
          `INSERT INTO identity.totp_credential
             (credential_id, identity_id, secret_envelope, confirmed_at, created_at)
           VALUES ($1,$2,$3::jsonb,$4,$5)
           ON CONFLICT (credential_id) DO UPDATE SET confirmed_at = EXCLUDED.confirmed_at`,
          [totp.credentialId, totp.identityId, JSON.stringify(totp.secretEnvelope), totp.confirmedAt, totp.createdAt],
        );
      }
      for (const refresh of snapshot.refreshSessions) {
        await client.query(
          `INSERT INTO identity.refresh_session
             (refresh_id, session_id, identity_id, token_hash, family_id, created_at, expires_at,
              revoked_at, replaced_by, reuse_detected_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (refresh_id) DO UPDATE SET
             revoked_at = EXCLUDED.revoked_at,
             replaced_by = EXCLUDED.replaced_by,
             reuse_detected_at = EXCLUDED.reuse_detected_at`,
          [
            refresh.refreshId,
            refresh.sessionId,
            refresh.identityId,
            refresh.tokenHash,
            refresh.familyId,
            refresh.createdAt,
            refresh.expiresAt,
            refresh.revokedAt,
            refresh.replacedBy,
            refresh.reuseDetectedAt,
          ],
        );
      }
      for (const challenge of snapshot.challenges) {
        await client.query(
          `INSERT INTO identity.auth_challenge
             (challenge_id, identity_id, purpose, token_hash, expires_at, consumed_at,
              failed_attempts, session_id, device_id, factors)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           ON CONFLICT (challenge_id) DO UPDATE SET
             consumed_at = EXCLUDED.consumed_at,
             failed_attempts = EXCLUDED.failed_attempts`,
          [
            challenge.challengeId,
            challenge.identityId,
            challenge.purpose,
            challenge.tokenHash,
            challenge.expiresAt,
            challenge.consumedAt,
            challenge.failedAttempts,
            challenge.sessionId,
            challenge.deviceId,
            JSON.stringify(challenge.factors),
          ],
        );
      }
      for (const event of snapshot.securityEvents) {
        await client.query(
          `INSERT INTO identity.security_event
             (event_id, kind, identity_id, session_id, device_id, authentication_strength,
              ip_hash, user_agent_hash, reason_code, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId,
            event.kind,
            event.identityId,
            event.sessionId,
            event.deviceId,
            event.authenticationStrength,
            event.ipHash,
            event.userAgentHash,
            event.reasonCode,
            event.occurredAt,
          ],
        );
      }
      for (const term of snapshot.terms) {
        await client.query(
          `INSERT INTO identity.terms_acknowledgement (identity_id, terms_version, accepted_at)
           VALUES ($1,$2,$3)
           ON CONFLICT (identity_id) DO UPDATE SET
             terms_version = EXCLUDED.terms_version,
             accepted_at = EXCLUDED.accepted_at`,
          [term.identityId, term.termsVersion, term.acceptedAt],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadAuthenticationSnapshot(pool: Pool): Promise<AuthenticationSnapshot | null> {
  return withClient(pool, async (client) => {
    const handles = await client.query('SELECT * FROM identity.login_handle');
    if (handles.rows.length === 0) {
      return null;
    }
    const passwords = await client.query('SELECT * FROM identity.password_credential');
    const totp = await client.query('SELECT * FROM identity.totp_credential');
    const refresh = await client.query('SELECT * FROM identity.refresh_session');
    const challenges = await client.query('SELECT * FROM identity.auth_challenge');
    const events = await client.query('SELECT * FROM identity.security_event');
    const terms = await client.query('SELECT * FROM identity.terms_acknowledgement');
    return Object.freeze({
      handles: handles.rows.map(rowToHandle),
      passwords: passwords.rows.map(rowToPassword),
      totp: totp.rows.map(rowToTotp),
      refreshSessions: refresh.rows.map(rowToRefresh),
      challenges: challenges.rows.map(rowToChallenge),
      securityEvents: events.rows.map(rowToEvent),
      terms: terms.rows.map((row) =>
        Object.freeze({
          identityId: row.identity_id,
          termsVersion: row.terms_version,
          acceptedAt: asIso(row.accepted_at) as LoginHandle['createdAt'],
        }),
      ),
    });
  });
}

function asIso(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }
  return new Date(value).toISOString();
}

function rowToHandle(row: Record<string, unknown>): LoginHandle {
  return Object.freeze({
    handleId: row.handle_id as LoginHandle['handleId'],
    identityId: row.identity_id as LoginHandle['identityId'],
    kind: row.kind as LoginHandle['kind'],
    lookupHash: row.lookup_hash as string,
    verificationState: row.verification_state as LoginHandle['verificationState'],
    createdAt: asIso(row.created_at as string | Date) as LoginHandle['createdAt'],
  });
}

function rowToPassword(row: Record<string, unknown>): PasswordCredential {
  return Object.freeze({
    credentialId: row.credential_id as PasswordCredential['credentialId'],
    identityId: row.identity_id as PasswordCredential['identityId'],
    digest: Object.freeze({
      kdf: 'scrypt' as const,
      saltHex: row.salt_hex as string,
      digestHex: row.digest_hex as string,
      N: Number(row.n),
      r: Number(row.r),
      p: Number(row.p),
      dkLen: Number(row.dk_len),
    }),
    createdAt: asIso(row.created_at as string | Date) as PasswordCredential['createdAt'],
    rotatedAt: asIso((row.rotated_at as string | Date | null) ?? null) as PasswordCredential['rotatedAt'],
  });
}

function rowToTotp(row: Record<string, unknown>): TotpCredential {
  return Object.freeze({
    credentialId: row.credential_id as TotpCredential['credentialId'],
    identityId: row.identity_id as TotpCredential['identityId'],
    secretEnvelope: row.secret_envelope as EncryptedEnvelope,
    confirmedAt: asIso((row.confirmed_at as string | Date | null) ?? null) as TotpCredential['confirmedAt'],
    createdAt: asIso(row.created_at as string | Date) as TotpCredential['createdAt'],
  });
}

function rowToRefresh(row: Record<string, unknown>): RefreshSession {
  return Object.freeze({
    refreshId: row.refresh_id as RefreshSession['refreshId'],
    sessionId: row.session_id as RefreshSession['sessionId'],
    identityId: row.identity_id as RefreshSession['identityId'],
    tokenHash: row.token_hash as string,
    familyId: row.family_id as string,
    createdAt: asIso(row.created_at as string | Date) as RefreshSession['createdAt'],
    expiresAt: asIso(row.expires_at as string | Date) as RefreshSession['expiresAt'],
    revokedAt: asIso((row.revoked_at as string | Date | null) ?? null) as RefreshSession['revokedAt'],
    replacedBy: (row.replaced_by as RefreshSession['replacedBy'] | null) ?? null,
    reuseDetectedAt: asIso((row.reuse_detected_at as string | Date | null) ?? null) as RefreshSession['reuseDetectedAt'],
  });
}

function rowToChallenge(row: Record<string, unknown>): AuthChallenge {
  return Object.freeze({
    challengeId: row.challenge_id as AuthChallenge['challengeId'],
    identityId: (row.identity_id as AuthChallenge['identityId'] | null) ?? null,
    purpose: row.purpose as AuthChallenge['purpose'],
    tokenHash: row.token_hash as string,
    expiresAt: asIso(row.expires_at as string | Date) as AuthChallenge['expiresAt'],
    consumedAt: asIso((row.consumed_at as string | Date | null) ?? null) as AuthChallenge['consumedAt'],
    failedAttempts: Number(row.failed_attempts),
    sessionId: (row.session_id as AuthChallenge['sessionId'] | null) ?? null,
    deviceId: (row.device_id as AuthChallenge['deviceId'] | null) ?? null,
    factors: row.factors as AuthChallenge['factors'],
  });
}

function rowToEvent(row: Record<string, unknown>): IdentitySecurityEvent {
  return Object.freeze({
    eventId: row.event_id as IdentitySecurityEvent['eventId'],
    kind: row.kind as IdentitySecurityEvent['kind'],
    identityId: (row.identity_id as IdentitySecurityEvent['identityId'] | null) ?? null,
    sessionId: (row.session_id as IdentitySecurityEvent['sessionId'] | null) ?? null,
    deviceId: (row.device_id as IdentitySecurityEvent['deviceId'] | null) ?? null,
    authenticationStrength: (row.authentication_strength as IdentitySecurityEvent['authenticationStrength'] | null) ?? null,
    ipHash: (row.ip_hash as string | null) ?? null,
    userAgentHash: (row.user_agent_hash as string | null) ?? null,
    reasonCode: row.reason_code as string,
    occurredAt: asIso(row.occurred_at as string | Date) as IdentitySecurityEvent['occurredAt'],
  });
}
