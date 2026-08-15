import type { Pool } from 'pg';

import { Money } from '../../money/src/money.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { freezeTreasuryAccount, type TreasuryAccount } from '../../treasury/src/account.ts';
import { freezeKillSwitch, type KillSwitch, type SettlementExposure } from '../../treasury/src/controls.ts';
import { freezeFxInventory, type FxInventoryPosition } from '../../treasury/src/inventory.ts';
import {
  asConcentrationSnapshotId,
  asForecastId,
  asFxInventoryId,
  asKillSwitchId,
  asRebalanceProposalId,
  asReconciliationId,
  asReservationId,
  asSettlementExposureId,
  asTreasuryAccountId,
  asTreasuryPositionId,
} from '../../treasury/src/ids.ts';
import { freezePosition, type TreasuryPosition } from '../../treasury/src/position.ts';
import { freezeForecast, freezeProposal } from '../../treasury/src/proposals.ts';
import { freezeReservation, type TreasuryLiquidityReservation } from '../../treasury/src/reservation.ts';
import type { RouteExplanation } from '../../treasury/src/routing.ts';
import type { TreasurySnapshot } from '../../treasury/src/store.ts';
import { CONCENTRATION_THRESHOLD_NOTE } from '../../treasury/src/types.ts';
import { withClient } from '../postgres/pools.ts';

type Queryable = {
  query: (
    queryText: string,
    values?: readonly unknown[],
  ) => Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistTreasurySnapshot(pool: Pool, snapshot: TreasurySnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const account of snapshot.accounts) {
        await client.query(
          `INSERT INTO treasury.account
             (treasury_account_id, name, kind, ownership, legal_entity_id, currency, country,
              provider, rail, corridor_id, ledger_account_id, card_settlement_ref)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (treasury_account_id) DO UPDATE SET
             name = EXCLUDED.name,
             corridor_id = EXCLUDED.corridor_id`,
          [
            account.treasuryAccountId,
            account.name,
            account.kind,
            account.ownership,
            account.legalEntityId,
            account.currency,
            account.country,
            account.provider,
            account.rail,
            account.corridorId,
            account.ledgerAccountId,
            account.cardSettlementRef,
          ],
        );
      }
      for (const position of snapshot.positions) {
        await client.query(
          `INSERT INTO treasury.position
             (treasury_account_id, currency, settled_minor, available_minor, reserved_minor,
              pending_inbound_minor, pending_outbound_minor, operational_buffer_minor, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (treasury_account_id) DO UPDATE SET
             settled_minor = EXCLUDED.settled_minor,
             available_minor = EXCLUDED.available_minor,
             reserved_minor = EXCLUDED.reserved_minor,
             pending_inbound_minor = EXCLUDED.pending_inbound_minor,
             pending_outbound_minor = EXCLUDED.pending_outbound_minor,
             operational_buffer_minor = EXCLUDED.operational_buffer_minor,
             updated_at = EXCLUDED.updated_at`,
          [
            position.treasuryAccountId,
            position.currency,
            position.settled.minorUnits.toString(),
            position.available.minorUnits.toString(),
            position.reserved.minorUnits.toString(),
            position.pendingInbound.minorUnits.toString(),
            position.pendingOutbound.minorUnits.toString(),
            position.operationalBuffer.minorUnits.toString(),
            position.updatedAt,
          ],
        );
      }
      for (const row of snapshot.reservations) {
        await client.query(
          `INSERT INTO treasury.reservation
             (reservation_id, treasury_account_id, payment_id, amount_minor, currency, state,
              idempotency_key, authority_id, created_at, updated_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (reservation_id) DO UPDATE SET
             state = EXCLUDED.state,
             updated_at = EXCLUDED.updated_at`,
          [
            row.reservationId,
            row.treasuryAccountId,
            row.paymentId,
            row.amount.minorUnits.toString(),
            row.currency,
            row.state,
            row.idempotencyKey,
            row.authorityId,
            row.createdAt,
            row.updatedAt,
            row.expiresAt,
          ],
        );
      }
      for (const row of snapshot.killSwitches) {
        await client.query(
          `INSERT INTO treasury.kill_switch
             (kill_switch_id, scope, target, enabled, reason, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (kill_switch_id) DO UPDATE SET
             enabled = EXCLUDED.enabled,
             reason = EXCLUDED.reason,
             updated_at = EXCLUDED.updated_at`,
          [row.killSwitchId, row.scope, row.target, row.enabled, row.reason, row.createdAt, row.updatedAt],
        );
      }
      for (const [paymentId, explanation] of Object.entries(snapshot.routeDecisions)) {
        await client.query(
          `INSERT INTO treasury.route_decision
             (payment_id, routing_version, selected_route_id, explanation_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (payment_id) DO UPDATE SET
             routing_version = EXCLUDED.routing_version,
             selected_route_id = EXCLUDED.selected_route_id,
             explanation_canonical = EXCLUDED.explanation_canonical`,
          [paymentId, explanation.routingVersion, explanation.selectedRouteId, canonicalJson(explanation), new Date().toISOString()],
        );
      }
      for (const row of snapshot.concentrations) {
        await client.query(
          `INSERT INTO treasury.concentration_snapshot
             (snapshot_id, dimension, key, exposure_minor, currency, threshold_minor, ratio_bps, threshold_note, captured_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (snapshot_id) DO UPDATE SET
             exposure_minor = EXCLUDED.exposure_minor,
             ratio_bps = EXCLUDED.ratio_bps`,
          [
            row.snapshotId,
            row.dimension,
            row.key,
            row.exposureMinorUnits.toString(),
            row.currency,
            row.thresholdMinorUnits.toString(),
            row.ratioBps.toString(),
            row.thresholdNote,
            row.capturedAt,
          ],
        );
      }
      for (const row of snapshot.exposures) {
        await client.query(
          `INSERT INTO treasury.settlement_exposure
             (exposure_id, kind, key, amount_minor, currency, state, payment_id, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (exposure_id) DO UPDATE SET
             amount_minor = EXCLUDED.amount_minor,
             state = EXCLUDED.state,
             updated_at = EXCLUDED.updated_at`,
          [
            row.exposureId,
            row.kind,
            row.key,
            row.amount.minorUnits.toString(),
            row.amount.currency,
            row.state,
            row.paymentId,
            row.updatedAt,
          ],
        );
      }
      for (const row of snapshot.inventory) {
        await client.query(
          `INSERT INTO treasury.fx_inventory
             (currency, owned_minor, reserved_minor, unsettled_minor, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (currency) DO UPDATE SET
             owned_minor = EXCLUDED.owned_minor,
             reserved_minor = EXCLUDED.reserved_minor,
             unsettled_minor = EXCLUDED.unsettled_minor,
             updated_at = EXCLUDED.updated_at`,
          [
            row.currency,
            row.owned.minorUnits.toString(),
            row.reserved.minorUnits.toString(),
            row.unsettledExposure.minorUnits.toString(),
            row.updatedAt,
          ],
        );
      }
      for (const row of snapshot.proposals) {
        await client.query(
          `INSERT INTO treasury.rebalance_proposal
             (proposal_id, source_treasury_account_id, destination_treasury_account_id, amount_minor,
              currency, narrative, state, executable, authority_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (proposal_id) DO UPDATE SET
             state = EXCLUDED.state,
             executable = EXCLUDED.executable,
             updated_at = EXCLUDED.updated_at`,
          [
            row.proposalId,
            row.sourceTreasuryAccountId,
            row.destinationTreasuryAccountId,
            row.amount.minorUnits.toString(),
            row.amount.currency,
            row.narrative,
            row.state,
            row.executable,
            row.authorityId,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }
      for (const row of snapshot.forecasts) {
        await client.query(
          `INSERT INTO treasury.forecast
             (forecast_id, horizon_ms, currency, body_canonical, generated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (forecast_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical`,
          [row.forecastId, row.horizonMs.toString(), row.currency, canonicalJson(row), row.generatedAt],
        );
      }
      for (const row of snapshot.reconciliations) {
        await client.query(
          `INSERT INTO treasury.reconciliation
             (reconciliation_id, subject_id, status, mismatches, ledger_journal_ids, payment_id, reservation_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (reconciliation_id) DO UPDATE SET
             status = EXCLUDED.status,
             mismatches = EXCLUDED.mismatches`,
          [
            row.reconciliationId,
            row.subjectId,
            row.status,
            [...row.mismatches],
            [...row.ledgerJournalIds],
            row.paymentId,
            row.reservationId,
            row.createdAt,
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

export async function loadTreasurySnapshot(pool: Pool): Promise<TreasurySnapshot> {
  return withClient(pool, async (client) => {
    const accounts = await client.query('SELECT * FROM treasury.account');
    const positions = await client.query('SELECT * FROM treasury.position');
    const reservations = await client.query('SELECT * FROM treasury.reservation');
    const switches = await client.query('SELECT * FROM treasury.kill_switch');
    const decisions = await client.query('SELECT * FROM treasury.route_decision');
    const concentrations = await client.query('SELECT * FROM treasury.concentration_snapshot');
    const exposures = await client.query('SELECT * FROM treasury.settlement_exposure');
    const inventory = await client.query('SELECT * FROM treasury.fx_inventory');
    const proposals = await client.query('SELECT * FROM treasury.rebalance_proposal');
    const forecasts = await client.query('SELECT * FROM treasury.forecast');
    const reconciliations = await client.query('SELECT * FROM treasury.reconciliation');
    const routeDecisions: Record<string, RouteExplanation> = {};
    for (const row of decisions.rows as Record<string, unknown>[]) {
      routeDecisions[String(row.payment_id)] = JSON.parse(String(row.explanation_canonical)) as RouteExplanation;
    }
    return {
      accounts: accounts.rows.map(mapAccount),
      positions: positions.rows.map(mapPosition),
      reservations: reservations.rows.map(mapReservation),
      killSwitches: (switches.rows as Record<string, unknown>[]).map(mapKillSwitch),
      concentrations: (concentrations.rows as Record<string, unknown>[]).map(mapConcentration),
      exposures: (exposures.rows as Record<string, unknown>[]).map(mapExposure),
      inventory: (inventory.rows as Record<string, unknown>[]).map(mapInventory),
      proposals: (proposals.rows as Record<string, unknown>[]).map(mapProposal),
      forecasts: (forecasts.rows as Record<string, unknown>[]).map(mapForecast),
      reconciliations: (reconciliations.rows as Record<string, unknown>[]).map(mapReconciliation),
      routeDecisions,
    };
  });
}

export async function reserveTreasuryLiquidityPg(
  client: Queryable,
  input: {
    readonly treasuryAccountId: string;
    readonly reservationId: string;
    readonly paymentId: string;
    readonly amountMinor: bigint;
    readonly currency: string;
    readonly idempotencyKey: string;
    readonly now: string;
  },
): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }> {
  const existing = await client.query('SELECT reservation_id FROM treasury.reservation WHERE idempotency_key = $1', [
    input.idempotencyKey,
  ]);
  if (existing.rowCount && existing.rowCount > 0) {
    return { ok: true };
  }
  const locked = await client.query(
    'SELECT available_minor, currency FROM treasury.position WHERE treasury_account_id = $1 FOR UPDATE',
    [input.treasuryAccountId],
  );
  const row = locked.rows[0] as { available_minor: string; currency: string } | undefined;
  if (!row) {
    return { ok: false, code: 'NO_POSITION' };
  }
  if (row.currency !== input.currency) {
    return { ok: false, code: 'CURRENCY_MISMATCH' };
  }
  const available = BigInt(row.available_minor);
  if (available < input.amountMinor) {
    return { ok: false, code: 'INSUFFICIENT_TREASURY_LIQUIDITY' };
  }
  await client.query(
    `UPDATE treasury.position
        SET available_minor = available_minor - $2,
            reserved_minor = reserved_minor + $2,
            updated_at = $3
      WHERE treasury_account_id = $1`,
    [input.treasuryAccountId, input.amountMinor.toString(), input.now],
  );
  await client.query(
    `INSERT INTO treasury.reservation
       (reservation_id, treasury_account_id, payment_id, amount_minor, currency, state,
        idempotency_key, authority_id, created_at, updated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,NULL,$7,$7,NULL)`,
    [
      input.reservationId,
      input.treasuryAccountId,
      input.paymentId,
      input.amountMinor.toString(),
      input.currency,
      input.idempotencyKey,
      input.now,
    ],
  );
  return { ok: true };
}

function mapAccount(row: Record<string, unknown>): TreasuryAccount {
  return freezeTreasuryAccount({
    treasuryAccountId: asTreasuryAccountId(String(row.treasury_account_id)),
    name: String(row.name),
    kind: row.kind as TreasuryAccount['kind'],
    ownership: row.ownership as TreasuryAccount['ownership'],
    legalEntityId: row.legal_entity_id as TreasuryAccount['legalEntityId'],
    currency: row.currency as TreasuryAccount['currency'],
    country: String(row.country),
    provider: String(row.provider),
    rail: String(row.rail),
    corridorId: row.corridor_id === null ? null : String(row.corridor_id),
    ledgerAccountId: row.ledger_account_id === null ? null : String(row.ledger_account_id),
    cardSettlementRef: row.card_settlement_ref === null ? null : String(row.card_settlement_ref),
  });
}

function mapPosition(row: Record<string, unknown>): TreasuryPosition {
  const currency = String(row.currency);
  return freezePosition({
    positionId: asTreasuryPositionId(`tp_${String(row.treasury_account_id)}`),
    treasuryAccountId: asTreasuryAccountId(String(row.treasury_account_id)),
    currency,
    settled: Money.fromMinorUnits(BigInt(String(row.settled_minor)), currency),
    available: Money.fromMinorUnits(BigInt(String(row.available_minor)), currency),
    reserved: Money.fromMinorUnits(BigInt(String(row.reserved_minor)), currency),
    pendingInbound: Money.fromMinorUnits(BigInt(String(row.pending_inbound_minor)), currency),
    pendingOutbound: Money.fromMinorUnits(BigInt(String(row.pending_outbound_minor)), currency),
    operationalBuffer: Money.fromMinorUnits(BigInt(String(row.operational_buffer_minor)), currency),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
  });
}

function mapReservation(row: Record<string, unknown>): TreasuryLiquidityReservation {
  const currency = String(row.currency);
  return freezeReservation({
    reservationId: asReservationId(String(row.reservation_id)),
    treasuryAccountId: asTreasuryAccountId(String(row.treasury_account_id)),
    paymentId: row.payment_id === null ? null : String(row.payment_id),
    amount: Money.fromMinorUnits(BigInt(String(row.amount_minor)), currency),
    currency,
    state: row.state as TreasuryLiquidityReservation['state'],
    idempotencyKey: String(row.idempotency_key),
    authorityId: row.authority_id === null ? null : String(row.authority_id),
    createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
    expiresAt: row.expires_at === null ? null : asUtcInstant(new Date(String(row.expires_at)).toISOString()),
  });
}

function mapKillSwitch(row: Record<string, unknown>): KillSwitch {
  return freezeKillSwitch({
    killSwitchId: asKillSwitchId(String(row.kill_switch_id)),
    scope: row.scope as KillSwitch['scope'],
    target: String(row.target),
    enabled: Boolean(row.enabled),
    reason: String(row.reason),
    createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
  });
}

function mapConcentration(row: Record<string, unknown>) {
  return Object.freeze({
    snapshotId: asConcentrationSnapshotId(String(row.snapshot_id)),
    dimension: row.dimension as 'provider' | 'bank' | 'rail' | 'corridor' | 'currency' | 'legal_entity',
    key: String(row.key),
    exposureMinorUnits: BigInt(String(row.exposure_minor)),
    currency: String(row.currency),
    thresholdMinorUnits: BigInt(String(row.threshold_minor)),
    ratioBps: BigInt(String(row.ratio_bps)),
    thresholdNote: CONCENTRATION_THRESHOLD_NOTE,
    capturedAt: asUtcInstant(new Date(String(row.captured_at)).toISOString()),
  });
}

function mapExposure(row: Record<string, unknown>): SettlementExposure {
  const currency = String(row.currency);
  return Object.freeze({
    exposureId: asSettlementExposureId(String(row.exposure_id)),
    kind: row.kind as SettlementExposure['kind'],
    key: String(row.key),
    amount: Money.fromMinorUnits(BigInt(String(row.amount_minor)), currency),
    state: row.state as SettlementExposure['state'],
    paymentId: row.payment_id === null ? null : String(row.payment_id),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
  });
}

function mapInventory(row: Record<string, unknown>): FxInventoryPosition {
  const currency = String(row.currency);
  return freezeFxInventory({
    inventoryId: asFxInventoryId(`fxinv_${currency}`),
    currency,
    owned: Money.fromMinorUnits(BigInt(String(row.owned_minor)), currency),
    reserved: Money.fromMinorUnits(BigInt(String(row.reserved_minor)), currency),
    unsettledExposure: Money.fromMinorUnits(BigInt(String(row.unsettled_minor)), currency),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
  });
}

function mapProposal(row: Record<string, unknown>) {
  const currency = String(row.currency);
  return freezeProposal({
    proposalId: asRebalanceProposalId(String(row.proposal_id)),
    sourceTreasuryAccountId: asTreasuryAccountId(String(row.source_treasury_account_id)),
    destinationTreasuryAccountId: asTreasuryAccountId(String(row.destination_treasury_account_id)),
    amount: Money.fromMinorUnits(BigInt(String(row.amount_minor)), currency),
    narrative: String(row.narrative),
    state: row.state as 'PROPOSED' | 'REFUSED' | 'EXECUTED' | 'CANCELLED',
    executable: Boolean(row.executable),
    authorityId: row.authority_id === null ? null : String(row.authority_id),
    createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
    updatedAt: asUtcInstant(new Date(String(row.updated_at)).toISOString()),
  });
}

function mapForecast(row: Record<string, unknown>) {
  const body = JSON.parse(String(row.body_canonical)) as {
    readonly openingAvailable?: { readonly minorUnits: string };
    readonly projectedAvailable?: { readonly minorUnits: string };
    readonly pendingInbound?: { readonly minorUnits: string };
    readonly pendingOutbound?: { readonly minorUnits: string };
    readonly reserved?: { readonly minorUnits: string };
    readonly sourceFacts?: readonly string[];
    readonly assumptions?: readonly { readonly key: string; readonly value: string }[];
    readonly version?: string;
  };
  const currency = String(row.currency);
  return freezeForecast({
    forecastId: asForecastId(String(row.forecast_id)),
    horizonMs: BigInt(String(row.horizon_ms)),
    currency,
    openingAvailable: Money.fromMinorUnits(BigInt(body.openingAvailable?.minorUnits ?? '0'), currency),
    projectedAvailable: Money.fromMinorUnits(BigInt(body.projectedAvailable?.minorUnits ?? '0'), currency),
    pendingInbound: Money.fromMinorUnits(BigInt(body.pendingInbound?.minorUnits ?? '0'), currency),
    pendingOutbound: Money.fromMinorUnits(BigInt(body.pendingOutbound?.minorUnits ?? '0'), currency),
    reserved: Money.fromMinorUnits(BigInt(body.reserved?.minorUnits ?? '0'), currency),
    sourceFacts: body.sourceFacts ?? [],
    assumptions: body.assumptions ?? [],
    version: body.version ?? 'treasury-forecast-v1',
    generatedAt: asUtcInstant(new Date(String(row.generated_at)).toISOString()),
  });
}

function mapReconciliation(row: Record<string, unknown>) {
  return Object.freeze({
    reconciliationId: asReconciliationId(String(row.reconciliation_id)),
    subjectId: String(row.subject_id),
    status: row.status as 'MATCHED' | 'PENDING' | 'MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_EXTERNAL' | 'INVESTIGATION_REQUIRED',
    mismatches: Object.freeze([...(row.mismatches as string[])]),
    ledgerJournalIds: Object.freeze([...(row.ledger_journal_ids as string[])]),
    paymentId: row.payment_id === null ? null : String(row.payment_id),
    reservationId: row.reservation_id === null ? null : String(row.reservation_id),
    createdAt: asUtcInstant(new Date(String(row.created_at)).toISOString()),
  });
}

export type { KillSwitch, SettlementExposure, FxInventoryPosition };
