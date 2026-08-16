import type { Pool } from 'pg';

import type { SunReyChainStoreSnapshot } from '../../../sunrey-chain/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function persistSunReyChainState(
  pool: Pool,
  state: SunReyChainStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const intent of state.intents) {
        await client.query(
          `INSERT INTO sunrey_chain.write_intent
             (intent_id, operation_id, record_type, source_subsystem, source_record_reference,
              payload_commitment, data_class, jurisdiction_cell, correlation_id,
              economic_value_movement, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11)
           ON CONFLICT (intent_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical`,
          [
            intent.intentId,
            intent.operationId,
            intent.recordType,
            intent.sourceSubsystem,
            intent.sourceRecordReference,
            intent.payloadCommitment,
            intent.dataClass,
            intent.jurisdictionCell,
            intent.correlationId,
            intent.createdAt,
            canonicalJson(intent),
          ],
        );
      }
      for (const operation of state.operations) {
        await client.query(
          `INSERT INTO sunrey_chain.operation
             (operation_id, intent_id, adapter_id, chain_id, network_id, network_mode,
              record_type, payload_commitment, state, transaction_id, receipt_id,
              confirmations, unknown_after_broadcast, created_at, updated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,'SIMULATION',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (operation_id) DO UPDATE SET
             state = EXCLUDED.state,
             confirmations = EXCLUDED.confirmations,
             unknown_after_broadcast = EXCLUDED.unknown_after_broadcast,
             updated_at = EXCLUDED.updated_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            operation.operationId,
            operation.intentId,
            operation.adapterId,
            operation.chainId,
            operation.networkId,
            operation.recordType,
            operation.payloadCommitment,
            operation.state,
            operation.transactionId,
            operation.receiptId,
            operation.confirmations,
            operation.unknownAfterBroadcast,
            operation.createdAt,
            operation.updatedAt,
            canonicalJson(operation),
          ],
        );
      }
      for (const receipt of state.receipts) {
        await client.query(
          `INSERT INTO sunrey_chain.receipt
             (receipt_id, operation_id, transaction_id, payload_commitment, accepted,
              finalized, reorg_observed, recorded_at, raw_data_included, private_key_included,
              body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,FALSE,$9)
           ON CONFLICT (receipt_id) DO UPDATE SET
             finalized = EXCLUDED.finalized,
             reorg_observed = EXCLUDED.reorg_observed,
             body_canonical = EXCLUDED.body_canonical`,
          [
            receipt.receiptId,
            receipt.operationId,
            receipt.transactionId,
            receipt.payloadCommitment,
            receipt.accepted,
            receipt.finalized,
            receipt.reorgObserved,
            receipt.recordedAt,
            canonicalJson(receipt),
          ],
        );
      }
      for (const record of state.reconciliations) {
        await client.query(
          `INSERT INTO sunrey_chain.reconciliation
             (reconciliation_id, operation_id, outcome, source_record_reference,
              intent_commitment, chain_commitment, auto_fixed, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8)
           ON CONFLICT (reconciliation_id) DO NOTHING`,
          [
            record.reconciliationId,
            record.operationId,
            record.outcome,
            record.sourceRecordReference,
            record.intentCommitment,
            record.chainCommitment,
            record.createdAt,
            canonicalJson(record),
          ],
        );
      }
      await client.query(
        `INSERT INTO sunrey_chain.health
           (adapter_id, status, network_mode, height, reason, observed_at, body_canonical)
         VALUES ($1,$2,'SIMULATION',$3,$4,$5,$6)
         ON CONFLICT (adapter_id) DO UPDATE SET
           status = EXCLUDED.status,
           height = EXCLUDED.height,
           reason = EXCLUDED.reason,
           observed_at = EXCLUDED.observed_at,
           body_canonical = EXCLUDED.body_canonical`,
        [
          state.health.adapterId,
          state.health.status,
          state.health.height,
          state.health.reason,
          state.health.observedAt,
          canonicalJson(state.health),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
