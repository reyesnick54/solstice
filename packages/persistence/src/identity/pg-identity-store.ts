import type { Pool } from 'pg';

import type { CustomerId } from '../../../domain/src/customer.ts';
import type { IdentitySnapshot } from '../../../identity/src/store.ts';
import type { PersonIdentity } from '../../../identity/src/model.ts';
import type { BusinessIdentity } from '../../../identity/src/model.ts';
import type { WebAuthnCredential, IdentitySession, RegisteredDevice } from '../../../identity/src/auth.ts';
import type { KycRecord } from '../../../identity/src/kyc.ts';
import type { CapabilityGrant } from '../../../identity/src/capability.ts';
import type { RecoveryRequest } from '../../../identity/src/recovery.ts';
import type { SolsticeIdentityId } from '../../../identity/src/ids.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistIdentitySnapshot(pool: Pool, snapshot: IdentitySnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const identity of snapshot.identities) {
        await client.query(
          `INSERT INTO identity.person_identity
             (id, status, home_jurisdiction, customer_id, attributes_json, created_at, version)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             customer_id = EXCLUDED.customer_id,
             attributes_json = EXCLUDED.attributes_json,
             version = EXCLUDED.version`,
          [
            identity.id,
            identity.status,
            identity.homeJurisdiction,
            identity.customerId,
            JSON.stringify(identity.attributes),
            identity.createdAt,
            identity.version,
          ],
        );
      }
      for (const link of snapshot.customerLinks) {
        await client.query(
          `INSERT INTO identity.customer_link (identity_id, customer_id) VALUES ($1,$2)
           ON CONFLICT (identity_id) DO UPDATE SET customer_id = EXCLUDED.customer_id`,
          [link.identityId, link.customerId],
        );
      }
      for (const business of snapshot.businesses) {
        await client.query(
          `INSERT INTO identity.business_identity
             (id, subject_id, legal_name_ref, registration_ref, jurisdiction, business_status,
              representatives_json, beneficial_owner_refs, control_person_refs, verification_state,
              created_at, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE SET
             business_status = EXCLUDED.business_status,
             representatives_json = EXCLUDED.representatives_json,
             beneficial_owner_refs = EXCLUDED.beneficial_owner_refs,
             control_person_refs = EXCLUDED.control_person_refs,
             verification_state = EXCLUDED.verification_state,
             version = EXCLUDED.version`,
          [
            business.id,
            business.subjectId,
            business.legalNameRef,
            business.registrationRef,
            business.jurisdiction,
            business.businessStatus,
            JSON.stringify(business.authorizedRepresentatives),
            JSON.stringify(business.beneficialOwnerRefs),
            JSON.stringify(business.controlPersonRefs),
            business.verificationState,
            business.createdAt,
            business.version,
          ],
        );
      }
      for (const credential of snapshot.credentials) {
        await client.query(
          `INSERT INTO identity.webauthn_credential
             (credential_id, identity_id, public_key_material, sign_count, transports, device_id,
              created_at, last_used_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
           ON CONFLICT (credential_id) DO UPDATE SET
             sign_count = EXCLUDED.sign_count,
             last_used_at = EXCLUDED.last_used_at,
             device_id = EXCLUDED.device_id`,
          [
            credential.credentialId,
            credential.identityId,
            credential.publicKeyMaterial,
            credential.signCount,
            JSON.stringify(credential.transports),
            credential.deviceId,
            credential.createdAt,
            credential.lastUsedAt,
          ],
        );
      }
      for (const session of snapshot.sessions) {
        await client.query(
          `INSERT INTO identity.session
             (session_id, subject_id, actor_id, authentication_strength, factors, issued_at,
              expires_at, last_used_at, device_id, risk_state, revocation_state,
              revoked_at, ip_hash, user_agent_hash)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (session_id) DO UPDATE SET
             last_used_at = EXCLUDED.last_used_at,
             risk_state = EXCLUDED.risk_state,
             revocation_state = EXCLUDED.revocation_state,
             revoked_at = EXCLUDED.revoked_at,
             ip_hash = EXCLUDED.ip_hash,
             user_agent_hash = EXCLUDED.user_agent_hash`,
          [
            session.sessionId,
            session.subjectId,
            session.actorId,
            session.authenticationStrength,
            JSON.stringify(session.factors),
            session.issuedAt,
            session.expiresAt,
            session.lastUsedAt,
            session.deviceId,
            session.riskState,
            session.revocationState,
            session.revokedAt ?? null,
            session.ipHash ?? null,
            session.userAgentHash ?? null,
          ],
        );
      }
      for (const device of snapshot.devices) {
        await client.query(
          `INSERT INTO identity.device
             (device_id, identity_id, device_ref, first_seen_at, last_seen_at,
              authentication_method, trust_state, revoked_at, risk_state, authentication_strength)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (device_id) DO UPDATE SET
             last_seen_at = EXCLUDED.last_seen_at,
             authentication_method = EXCLUDED.authentication_method,
             trust_state = EXCLUDED.trust_state,
             revoked_at = EXCLUDED.revoked_at,
             risk_state = EXCLUDED.risk_state,
             authentication_strength = EXCLUDED.authentication_strength`,
          [
            device.deviceId,
            device.identityId,
            device.deviceRef,
            device.firstSeenAt,
            device.lastSeenAt,
            device.authenticationMethod,
            device.trustState,
            device.revokedAt ?? null,
            device.riskState ?? 'CLEAR',
            device.authenticationStrength ?? null,
          ],
        );
      }
      for (const record of snapshot.kycRecords) {
        await client.query(
          `INSERT INTO identity.kyc_record
             (id, identity_id, provider_ref, verification_state, verification_level, jurisdiction,
              verified_attributes, verified_at, expires_at, reason_codes, evidence_refs, version)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12)
           ON CONFLICT (id) DO UPDATE SET
             verification_state = EXCLUDED.verification_state,
             verified_attributes = EXCLUDED.verified_attributes,
             verified_at = EXCLUDED.verified_at,
             expires_at = EXCLUDED.expires_at,
             reason_codes = EXCLUDED.reason_codes,
             evidence_refs = EXCLUDED.evidence_refs,
             version = EXCLUDED.version`,
          [
            record.id,
            record.identityId,
            record.providerRef,
            record.verificationState,
            record.verificationLevel,
            record.jurisdiction,
            JSON.stringify(record.verifiedAttributes),
            record.verifiedAt,
            record.expiresAt,
            JSON.stringify(record.reasonCodes),
            JSON.stringify(record.evidenceRefs),
            record.version,
          ],
        );
      }
      for (const grant of snapshot.grants) {
        await client.query(
          `INSERT INTO identity.capability_grant
             (grant_id, identity_id, capability, source, issued_at, expires_at, revoked_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (grant_id) DO UPDATE SET revoked_at = EXCLUDED.revoked_at`,
          [
            grant.grantId,
            grant.identityId,
            grant.capability,
            grant.source,
            grant.issuedAt,
            grant.expiresAt,
            grant.revokedAt,
          ],
        );
      }
      for (const recovery of snapshot.recoveries) {
        await client.query(
          `INSERT INTO identity.recovery_request
             (id, identity_id, state, evidence_refs, step_up_completed_at, reason_codes,
              created_at, updated_at, version)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             state = EXCLUDED.state,
             evidence_refs = EXCLUDED.evidence_refs,
             step_up_completed_at = EXCLUDED.step_up_completed_at,
             reason_codes = EXCLUDED.reason_codes,
             updated_at = EXCLUDED.updated_at,
             version = EXCLUDED.version`,
          [
            recovery.id,
            recovery.identityId,
            recovery.state,
            JSON.stringify(recovery.evidenceRefs),
            recovery.stepUpCompletedAt,
            JSON.stringify(recovery.reasonCodes),
            recovery.createdAt,
            recovery.updatedAt,
            recovery.version,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadIdentitySnapshot(pool: Pool): Promise<IdentitySnapshot | null> {
  return withClient(pool, async (client) => {
    const identities = await client.query('SELECT * FROM identity.person_identity');
    if (identities.rows.length === 0) {
      return null;
    }
    const links = await client.query('SELECT * FROM identity.customer_link');
    const businesses = await client.query('SELECT * FROM identity.business_identity');
    const credentials = await client.query('SELECT * FROM identity.webauthn_credential');
    const sessions = await client.query('SELECT * FROM identity.session');
    const devices = await client.query('SELECT * FROM identity.device');
    const kyc = await client.query('SELECT * FROM identity.kyc_record');
    const grants = await client.query('SELECT * FROM identity.capability_grant');
    const recoveries = await client.query('SELECT * FROM identity.recovery_request');
    return Object.freeze({
      identities: identities.rows.map(rowToPerson),
      businesses: businesses.rows.map(rowToBusiness),
      credentials: credentials.rows.map(rowToCredential),
      challenges: Object.freeze([]),
      sessions: sessions.rows.map(rowToSession),
      devices: devices.rows.map(rowToDevice),
      kycRecords: kyc.rows.map(rowToKyc),
      grants: grants.rows.map(rowToGrant),
      recoveries: recoveries.rows.map(rowToRecovery),
      customerLinks: links.rows.map((row) =>
        Object.freeze({
          identityId: row.identity_id as SolsticeIdentityId,
          customerId: row.customer_id as CustomerId,
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

function rowToPerson(row: Record<string, unknown>): PersonIdentity {
  return Object.freeze({
    id: row.id as PersonIdentity['id'],
    kind: 'PERSON',
    status: row.status as PersonIdentity['status'],
    homeJurisdiction: row.home_jurisdiction as PersonIdentity['homeJurisdiction'],
    attributes: row.attributes_json as PersonIdentity['attributes'],
    customerId: (row.customer_id as PersonIdentity['customerId'] | null) ?? null,
    createdAt: asIso(row.created_at as string | Date) as PersonIdentity['createdAt'],
    version: Number(row.version),
  });
}

function rowToBusiness(row: Record<string, unknown>): BusinessIdentity {
  return Object.freeze({
    id: row.id as BusinessIdentity['id'],
    subjectId: row.subject_id as BusinessIdentity['subjectId'],
    kind: 'BUSINESS',
    legalNameRef: row.legal_name_ref as string,
    registrationRef: (row.registration_ref as string | null) ?? null,
    jurisdiction: row.jurisdiction as BusinessIdentity['jurisdiction'],
    businessStatus: row.business_status as BusinessIdentity['businessStatus'],
    authorizedRepresentatives: row.representatives_json as BusinessIdentity['authorizedRepresentatives'],
    beneficialOwnerRefs: row.beneficial_owner_refs as readonly string[],
    controlPersonRefs: row.control_person_refs as readonly string[],
    verificationState: row.verification_state as BusinessIdentity['verificationState'],
    createdAt: asIso(row.created_at as string | Date) as BusinessIdentity['createdAt'],
    version: Number(row.version),
  });
}

function rowToCredential(row: Record<string, unknown>): WebAuthnCredential {
  return Object.freeze({
    credentialId: row.credential_id as WebAuthnCredential['credentialId'],
    identityId: row.identity_id as WebAuthnCredential['identityId'],
    publicKeyMaterial: row.public_key_material as string,
    signCount: Number(row.sign_count),
    transports: row.transports as WebAuthnCredential['transports'],
    deviceId: (row.device_id as WebAuthnCredential['deviceId'] | null) ?? null,
    createdAt: asIso(row.created_at as string | Date) as WebAuthnCredential['createdAt'],
    lastUsedAt: asIso(row.last_used_at as string | Date | null) as WebAuthnCredential['lastUsedAt'],
  });
}

function rowToSession(row: Record<string, unknown>): IdentitySession {
  return Object.freeze({
    sessionId: row.session_id as IdentitySession['sessionId'],
    subjectId: row.subject_id as IdentitySession['subjectId'],
    actorId: row.actor_id as string,
    authenticationStrength: row.authentication_strength as IdentitySession['authenticationStrength'],
    factors: row.factors as IdentitySession['factors'],
    issuedAt: asIso(row.issued_at as string | Date) as IdentitySession['issuedAt'],
    expiresAt: asIso(row.expires_at as string | Date) as IdentitySession['expiresAt'],
    lastUsedAt: asIso(row.last_used_at as string | Date) as IdentitySession['lastUsedAt'],
    revokedAt: asIso((row.revoked_at as string | Date | null) ?? null) as IdentitySession['revokedAt'],
    deviceId: (row.device_id as IdentitySession['deviceId'] | null) ?? null,
    riskState: row.risk_state as IdentitySession['riskState'],
    revocationState: row.revocation_state as IdentitySession['revocationState'],
    ipHash: (row.ip_hash as string | null) ?? null,
    userAgentHash: (row.user_agent_hash as string | null) ?? null,
  });
}

function rowToDevice(row: Record<string, unknown>): RegisteredDevice {
  return Object.freeze({
    deviceId: row.device_id as RegisteredDevice['deviceId'],
    identityId: row.identity_id as RegisteredDevice['identityId'],
    deviceRef: row.device_ref as string,
    firstSeenAt: asIso(row.first_seen_at as string | Date) as RegisteredDevice['firstSeenAt'],
    lastSeenAt: asIso(row.last_seen_at as string | Date) as RegisteredDevice['lastSeenAt'],
    revokedAt: asIso((row.revoked_at as string | Date | null) ?? null) as RegisteredDevice['revokedAt'],
    authenticationMethod: (row.authentication_method as RegisteredDevice['authenticationMethod'] | null) ?? null,
    authenticationStrength: (row.authentication_strength as RegisteredDevice['authenticationStrength'] | null) ?? null,
    trustState: row.trust_state as RegisteredDevice['trustState'],
    riskState: ((row.risk_state as RegisteredDevice['riskState'] | null) ?? 'CLEAR'),
  });
}

function rowToKyc(row: Record<string, unknown>): KycRecord {
  return Object.freeze({
    id: row.id as KycRecord['id'],
    identityId: row.identity_id as KycRecord['identityId'],
    providerRef: row.provider_ref as string,
    verificationState: row.verification_state as KycRecord['verificationState'],
    verificationLevel: row.verification_level as KycRecord['verificationLevel'],
    jurisdiction: row.jurisdiction as KycRecord['jurisdiction'],
    verifiedAttributes: row.verified_attributes as KycRecord['verifiedAttributes'],
    verifiedAt: asIso(row.verified_at as string | Date | null) as KycRecord['verifiedAt'],
    expiresAt: asIso(row.expires_at as string | Date | null) as KycRecord['expiresAt'],
    reasonCodes: row.reason_codes as readonly string[],
    evidenceRefs: row.evidence_refs as readonly string[],
    version: Number(row.version),
  });
}

function rowToGrant(row: Record<string, unknown>): CapabilityGrant {
  return Object.freeze({
    grantId: row.grant_id as CapabilityGrant['grantId'],
    identityId: row.identity_id as CapabilityGrant['identityId'],
    capability: row.capability as CapabilityGrant['capability'],
    source: row.source as CapabilityGrant['source'],
    issuedAt: asIso(row.issued_at as string | Date) as CapabilityGrant['issuedAt'],
    expiresAt: asIso(row.expires_at as string | Date) as CapabilityGrant['expiresAt'],
    revokedAt: asIso(row.revoked_at as string | Date | null) as CapabilityGrant['revokedAt'],
  });
}

function rowToRecovery(row: Record<string, unknown>): RecoveryRequest {
  return Object.freeze({
    id: row.id as RecoveryRequest['id'],
    identityId: row.identity_id as RecoveryRequest['identityId'],
    state: row.state as RecoveryRequest['state'],
    evidenceRefs: row.evidence_refs as readonly string[],
    stepUpCompletedAt: asIso(row.step_up_completed_at as string | Date | null) as RecoveryRequest['stepUpCompletedAt'],
    reasonCodes: row.reason_codes as readonly string[],
    createdAt: asIso(row.created_at as string | Date) as RecoveryRequest['createdAt'],
    updatedAt: asIso(row.updated_at as string | Date) as RecoveryRequest['updatedAt'],
    version: Number(row.version),
  });
}
