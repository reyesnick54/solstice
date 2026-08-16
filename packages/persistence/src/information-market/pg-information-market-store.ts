import type { Pool } from 'pg';

import type { InformationMarketStoreSnapshot } from '../../../information-market/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function persistInformationMarketState(
  pool: Pool,
  state: InformationMarketStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const requester of state.requesters) {
        await client.query(
          `INSERT INTO information_market.requester
             (requester_id, kind, legal_entity_ref, jurisdiction, verification_state,
              status, simulation_fixture, live_verified_institution, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,FALSE,$7)
           ON CONFLICT (requester_id) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical`,
          [
            requester.requesterId,
            requester.kind,
            requester.legalEntityRef,
            requester.jurisdiction,
            requester.verificationState,
            requester.status,
            canonicalJson(requester),
          ],
        );
      }
      for (const request of state.requests) {
        await client.query(
          `INSERT INTO information_market.request
             (request_id, requester_id, product_type, purpose_ref, jurisdiction, status,
              legal_review_state, created_at, published_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,'RESEARCH_REQUIRED',$7,$8,$9)
           ON CONFLICT (request_id) DO UPDATE SET
             status = EXCLUDED.status,
             published_at = EXCLUDED.published_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            request.requestId,
            request.requesterId,
            request.productType,
            request.purposeRef,
            request.jurisdiction,
            request.status,
            request.createdAt,
            request.publishedAt,
            canonicalJson(request),
          ],
        );
      }
      for (const attestation of state.attestations) {
        await client.query(
          `INSERT INTO information_market.attestation
             (attestation_id, subject_ref, claim_type, purpose_ref, issued_at, expires_at,
              source_record_revealed, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7)
           ON CONFLICT (attestation_id) DO NOTHING`,
          [
            attestation.attestationId,
            attestation.subjectRef,
            attestation.claimType,
            attestation.purposeRef,
            attestation.issuedAt,
            attestation.expiresAt,
            canonicalJson(attestation),
          ],
        );
      }
      for (const opportunity of state.opportunities) {
        await client.query(
          `INSERT INTO information_market.opportunity
             (opportunity_id, request_id, subject_id, purpose_ref, decision, dark_pattern, body_canonical)
           VALUES ($1,$2,$3,$4,$5,FALSE,$6)
           ON CONFLICT (opportunity_id) DO UPDATE SET
             decision = EXCLUDED.decision,
             body_canonical = EXCLUDED.body_canonical`,
          [
            opportunity.opportunityId,
            opportunity.requestId,
            opportunity.subjectId,
            opportunity.purposeRef,
            opportunity.decision,
            canonicalJson(opportunity),
          ],
        );
      }
      for (const contribution of state.contributions) {
        await client.query(
          `INSERT INTO information_market.contribution
             (contribution_id, request_id, opportunity_id, subject_ref, consent_ref, status,
              computation_receipt_id, provenance_hash, settlement_ref, raw_data_included,
              created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11)
           ON CONFLICT (contribution_id) DO UPDATE SET
             status = EXCLUDED.status,
             settlement_ref = EXCLUDED.settlement_ref,
             body_canonical = EXCLUDED.body_canonical`,
          [
            contribution.contributionId,
            contribution.requestId,
            contribution.opportunityId,
            contribution.subjectRef,
            contribution.consentRef,
            contribution.status,
            contribution.computationReceiptId,
            contribution.provenanceHash,
            contribution.settlementRef,
            contribution.createdAt,
            canonicalJson(contribution),
          ],
        );
      }
      for (const settlement of state.settlements) {
        await client.query(
          `INSERT INTO information_market.settlement_ref
             (settlement_ref, contribution_id, asset, intent_id, journal_id, transfer_id,
              realization, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,'REALIZED',$7)
           ON CONFLICT (settlement_ref) DO NOTHING`,
          [
            settlement.settlementRef,
            settlement.contributionId,
            settlement.asset,
            settlement.intentId,
            settlement.journalId ?? null,
            settlement.transferId ?? null,
            canonicalJson(settlement),
          ],
        );
      }
      for (const observation of state.observations) {
        await client.query(
          `INSERT INTO information_market.demand_observation
             (observed_at, request_count, is_coin_price, is_human_worth, is_token_valuation, body_canonical)
           VALUES ($1,$2,FALSE,FALSE,FALSE,$3)
           ON CONFLICT (observed_at) DO NOTHING`,
          [observation.observedAt, observation.requestCount, canonicalJson(observation)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
