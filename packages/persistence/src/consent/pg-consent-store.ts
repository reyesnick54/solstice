import type { Pool } from 'pg';

import type { ConsentStoreSnapshot } from '../../../consent/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function persistConsentState(pool: Pool, state: ConsentStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const purpose of state.purposes) {
        await client.query(
          `INSERT INTO consent.purpose
             (purpose_version, purpose_id, version_number, code, description, category, status,
              legal_hook, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (purpose_version) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical`,
          [
            purpose.purposeVersion,
            purpose.purposeId,
            purpose.versionNumber,
            purpose.code,
            purpose.description,
            purpose.category,
            purpose.status,
            purpose.legalHook,
            purpose.createdAt,
            canonicalJson(purpose),
          ],
        );
      }
      for (const recipient of state.recipients) {
        await client.query(
          `INSERT INTO consent.recipient
             (recipient_id, kind, service_id, label, simulation_fixture, live_buyer, body_canonical)
           VALUES ($1,$2,$3,$4,TRUE,FALSE,$5)
           ON CONFLICT (recipient_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [recipient.recipientId, recipient.kind, recipient.serviceId, recipient.label, canonicalJson(recipient)],
        );
      }
      for (const record of state.records) {
        await client.query(
          `INSERT INTO consent.record
             (consent_id, version, grant_id, subject_id, version_sequence, recipient_id, purpose_id,
              purpose_version, purpose_code, state, effective_from, expires_at, created_at, revision,
              supersedes, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (consent_id, version) DO UPDATE SET
             state = EXCLUDED.state,
             revision = EXCLUDED.revision,
             body_canonical = EXCLUDED.body_canonical`,
          [
            record.consentId,
            record.version,
            record.grantId,
            record.subjectId,
            record.versionSequence,
            record.recipientId,
            record.purposeId,
            record.purposeVersion,
            record.purposeCode,
            record.state,
            record.effectiveFrom,
            record.expiresAt,
            record.createdAt,
            record.revision,
            record.supersedes,
            canonicalJson(record),
          ],
        );
      }
      for (const receipt of state.receipts) {
        await client.query(
          `INSERT INTO consent.receipt
             (receipt_id, consent_id, version, subject_id, confirmed_at, consent_hash, immutable, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
           ON CONFLICT (receipt_id) DO NOTHING`,
          [
            receipt.receiptId,
            receipt.consentId,
            receipt.version,
            receipt.subjectId,
            receipt.confirmedAt,
            receipt.consentHash,
            canonicalJson(receipt),
          ],
        );
      }
      for (const revocation of state.revocations) {
        await client.query(
          `INSERT INTO consent.revocation
             (revocation_id, consent_id, version, subject_id, revoked_at,
              erases_delivered_third_party_data, body_canonical)
           VALUES ($1,$2,$3,$4,$5,FALSE,$6)
           ON CONFLICT (revocation_id) DO NOTHING`,
          [
            revocation.revocationId,
            revocation.consentId,
            revocation.version,
            revocation.subjectId,
            revocation.revokedAt,
            canonicalJson(revocation),
          ],
        );
      }
      for (const permit of state.permits) {
        await client.query(
          `INSERT INTO consent.permit
             (permit_id, subject_id, consent_id, consent_version, purpose_id, purpose_version,
              recipient_id, allowed_operation, issued_at, expires_at, nonce, issuer, signature_hex,
              body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (permit_id) DO NOTHING`,
          [
            permit.permitId,
            permit.subjectId,
            permit.consentId,
            permit.consentVersion,
            permit.purposeId,
            permit.purposeVersion,
            permit.recipientId,
            permit.allowedOperation,
            permit.issuedAt,
            permit.expiresAt,
            permit.nonce,
            permit.issuer,
            permit.signatureHex,
            canonicalJson(permit),
          ],
        );
      }
      for (const decision of state.decisions) {
        await client.query(
          `INSERT INTO consent.decision
             (decision_id, decision, reason_code, subject_id, consent_id, purpose_id, permit_id,
              resource_id, occurred_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            decision.decisionId,
            decision.decision,
            decision.reasonCode,
            decision.subjectId,
            decision.consentId,
            decision.purposeId,
            decision.permitId,
            decision.resourceId,
            decision.occurredAt,
            canonicalJson(decision),
          ],
        );
      }
      for (const entry of state.ledger) {
        await client.query(
          `INSERT INTO consent.ledger_entry
             (sequence, consent_id, version, kind, occurred_at, hash, previous_hash, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (sequence) DO NOTHING`,
          [
            entry.sequence,
            entry.consentId,
            entry.version,
            entry.kind,
            entry.occurredAt,
            entry.hash,
            entry.previousHash,
            canonicalJson(entry),
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
