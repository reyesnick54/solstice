import type { Pool } from 'pg';

import type { InvestmentSnapshot } from '../../../investments/src/store.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistInvestmentSnapshot(pool: Pool, snapshot: InvestmentSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const profile of snapshot.profiles) {
        await client.query(
          `INSERT INTO investment.profile
             (investment_account_id, customer_id, brokerage_cash_account_id, securities_account_id,
              pending_settlement_account_id, product_id, legal_entity_id, base_currency, status,
              created_at, environment, live_state)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE)
           ON CONFLICT (investment_account_id) DO UPDATE SET status = EXCLUDED.status`,
          [
            profile.investmentAccountId,
            profile.customerId,
            profile.brokerageCashAccountId,
            profile.securitiesAccountId,
            profile.pendingSettlementAccountId,
            profile.productId,
            profile.legalEntityId,
            profile.baseCurrency,
            profile.status,
            profile.createdAt,
            profile.environment,
          ],
        );
      }
      for (const instrument of snapshot.instruments) {
        await client.query(
          `INSERT INTO investment.instrument
             (instrument_id, symbol, display_name, instrument_type, currency, market_id, status,
              fractional_supported, min_qty_units, simulation, listed_claim)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,'DETERMINISTIC_FIXTURE')
           ON CONFLICT (instrument_id) DO UPDATE SET status = EXCLUDED.status`,
          [
            instrument.instrumentId,
            instrument.symbol,
            instrument.displayName,
            instrument.instrumentType,
            instrument.currency,
            instrument.marketId,
            instrument.status,
            instrument.fractionalSupported,
            instrument.minimumQuantityIncrement.units.toString(),
          ],
        );
      }
      for (const order of snapshot.orders) {
        await client.query(
          `INSERT INTO investment.paper_order
             (order_id, investment_account_id, instrument_id, side, quantity_units, filled_units,
              order_type, status, idempotency_key, intent_id, created_at, simulation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
           ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, filled_units = EXCLUDED.filled_units`,
          [
            order.orderId,
            order.investmentAccountId,
            order.instrumentId,
            order.side,
            order.quantity.units.toString(),
            order.filledQuantity.units.toString(),
            order.orderType,
            order.status,
            order.idempotencyKey,
            order.intentId,
            order.createdAt,
          ],
        );
      }
      for (const fill of snapshot.fills) {
        await client.query(
          `INSERT INTO investment.fill
             (fill_id, order_id, instrument_id, side, quantity_units, price_minor, currency,
              fee_minor, provider_fill_ref, filled_at, simulation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
           ON CONFLICT (fill_id) DO NOTHING`,
          [
            fill.fillId,
            fill.orderId,
            fill.instrumentId,
            fill.side,
            fill.quantity.units.toString(),
            fill.price.minorUnits.toString(),
            fill.price.currency,
            fill.explicitFee.minorUnits.toString(),
            fill.providerFillRef,
            fill.filledAt,
          ],
        );
      }
      for (const lot of snapshot.lots) {
        await client.query(
          `INSERT INTO investment.lot
             (lot_id, instrument_id, acquired_at, quantity_units, remaining_units, remaining_cost_minor,
              currency, source_fill_id, tax_treatment, tax_advice)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'FIFO_SIMULATION_ACCOUNTING_METHOD',FALSE)
           ON CONFLICT (lot_id) DO UPDATE SET remaining_units = EXCLUDED.remaining_units,
             remaining_cost_minor = EXCLUDED.remaining_cost_minor`,
          [
            lot.lotId,
            lot.instrumentId,
            lot.acquiredAt,
            lot.quantity.units.toString(),
            lot.remainingQuantity.units.toString(),
            lot.remainingCost.minorUnits.toString(),
            lot.currency,
            lot.sourceFillId,
          ],
        );
      }
      for (const position of snapshot.positions) {
        await client.query(
          `INSERT INTO investment.position
             (investment_account_id, instrument_id, quantity_units, available_units, settled_units,
              remaining_cost_minor, currency, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (investment_account_id, instrument_id) DO UPDATE SET
             quantity_units = EXCLUDED.quantity_units,
             available_units = EXCLUDED.available_units,
             settled_units = EXCLUDED.settled_units,
             remaining_cost_minor = EXCLUDED.remaining_cost_minor,
             updated_at = EXCLUDED.updated_at`,
          [
            position.investmentAccountId,
            position.instrumentId,
            position.quantity.units.toString(),
            position.availableQuantity.units.toString(),
            position.settledQuantity.units.toString(),
            position.remainingCost.minorUnits.toString(),
            position.currency,
            position.updatedAt,
          ],
        );
      }
      for (const settlement of snapshot.settlements) {
        await client.query(
          `INSERT INTO investment.settlement
             (settlement_id, fill_id, investment_account_id, side, state, cash_minor, currency,
              delay_days, trade_at, settled_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (settlement_id) DO UPDATE SET state = EXCLUDED.state, settled_at = EXCLUDED.settled_at`,
          [
            settlement.settlementId,
            settlement.fillId,
            settlement.investmentAccountId,
            settlement.side,
            settlement.state,
            settlement.cashAmount.minorUnits.toString(),
            settlement.cashAmount.currency,
            settlement.settlementDelayDays.toString(),
            settlement.tradeAt,
            settlement.settledAt,
          ],
        );
      }
      for (const valuation of snapshot.valuations) {
        await client.query(
          `INSERT INTO investment.valuation
             (valuation_id, investment_account_id, as_of, currency, market_value_minor, cost_basis_minor,
              unrealized_minor, cash_minor, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (valuation_id) DO NOTHING`,
          [
            valuation.valuationId,
            valuation.investmentAccountId,
            valuation.asOf,
            valuation.currency,
            valuation.marketValue.minorUnits.toString(),
            valuation.costBasis.minorUnits.toString(),
            valuation.unrealized.minorUnits.toString(),
            valuation.cash.minorUnits.toString(),
            canonicalJson(valuation),
          ],
        );
      }
      for (const action of snapshot.corporateActions) {
        await client.query(
          `INSERT INTO investment.corporate_action
             (corporate_action_id, kind, instrument_id, record_ref, cash_minor, currency, processed_at, simulation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
           ON CONFLICT (corporate_action_id) DO NOTHING`,
          [
            action.corporateActionId,
            action.kind,
            action.instrumentId,
            action.recordRef,
            action.cashAmount?.minorUnits.toString() ?? null,
            action.currency,
            action.processedAt,
          ],
        );
      }
      for (const row of snapshot.reconciliations) {
        await client.query(
          `INSERT INTO investment.reconciliation
             (reconciliation_id, investment_account_id, result, findings_canonical, auto_adjusted, created_at)
           VALUES ($1,$2,$3,$4,FALSE,$5)
           ON CONFLICT (reconciliation_id) DO NOTHING`,
          [row.reconciliationId, row.investmentAccountId, row.result, canonicalJson(row.findings), row.createdAt],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
