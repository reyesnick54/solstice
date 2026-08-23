/**
 * PostgreSQL adapter for the Phase G Exchange core snapshot.
 * Writes metadata only. Not a second ledger, matching engine, or mint.
 * Uses existing sunrey_exchange tables (V025) plus operational rows (V027).
 */

import type { Pool } from 'pg';

import type { ExchangeCoreSnapshot } from '../../../sunrey-exchange/src/production-core/snapshot.ts';
import { canonicalJson } from '../canonical.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistExchangeCoreSnapshot(pool: Pool, snapshot: ExchangeCoreSnapshot): Promise<void> {
  if (snapshot.productionActive !== false || snapshot.liveTradingEnabled !== false) {
    throw new Error('refusing to persist a live-trading Exchange snapshot');
  }
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const account of snapshot.accounts) {
        await client.query(
          `INSERT INTO sunrey_exchange.account
             (account_id, customer_id, identity_id, legal_entity_id, jurisdiction,
              custody_account_id, cash_account_id, status, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (account_id) DO NOTHING`,
          [
            account.accountId,
            account.customerId,
            account.identityId,
            account.legalEntityId,
            account.jurisdiction,
            account.custodyAccountId,
            account.cashAccountId,
            account.status,
            account.createdAt,
            canonicalJson(account),
          ],
        );
      }
      for (const listing of snapshot.listings) {
        await client.query(
          `INSERT INTO sunrey_exchange.listing
             (listing_id, listing_version, family, underlying_ref, settlement_model, status,
              legal_review_state, risk_classification, token_classification_claim, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'SIMULATION_ONLY','NONE',$8)
           ON CONFLICT (listing_id) DO NOTHING`,
          [
            listing.listingId,
            listing.listingVersion,
            listing.family,
            listing.underlyingRef,
            listing.settlementModel,
            listing.status,
            listing.legalReviewState,
            canonicalJson(listing),
          ],
        );
      }
      for (const market of snapshot.markets) {
        await client.query(
          `INSERT INTO sunrey_exchange.market
             (market_id, family, book_id, base_listing_id, quote_listing_id, state,
              self_trade_policy, fee_schedule_id, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (market_id) DO NOTHING`,
          [
            market.marketId,
            market.family,
            market.bookId,
            market.baseListingId,
            market.quoteListingId,
            market.state,
            market.selfTradePolicy,
            market.feeScheduleId,
            canonicalJson(market),
          ],
        );
      }
      for (const order of snapshot.orders) {
        await client.query(
          `INSERT INTO sunrey_exchange.exchange_order
             (order_id, version, account_id, market_id, side, order_type, quantity_scaled,
              remaining_scaled, status, client_idempotency_key, hold_id, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (order_id) DO NOTHING`,
          [
            order.orderId,
            order.version,
            order.exchangeAccountId,
            order.marketId,
            order.side,
            order.orderType,
            order.quantity.scaledUnits.toString(),
            order.remaining.scaledUnits.toString(),
            order.status,
            order.clientIdempotencyKey,
            order.holdId,
            order.createdAt,
            canonicalJson(order),
          ],
        );
        await client.query(
          `INSERT INTO sunrey_exchange.operational_order
             (order_id, client_idempotency_key, state, hold_id, base_asset, quote_asset, revision, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,1,NOW())
           ON CONFLICT (order_id) DO UPDATE SET
             state = EXCLUDED.state,
             hold_id = EXCLUDED.hold_id,
             revision = sunrey_exchange.operational_order.revision + 1,
             updated_at = NOW()`,
          [
            order.orderId,
            order.clientIdempotencyKey,
            order.status === 'FILLED' ? 'FILLED' : order.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
            order.holdId,
            'SUNREY_COIN',
            'MOONREY_COIN',
          ],
        );
      }
      for (const trade of snapshot.trades) {
        await client.query(
          `INSERT INTO sunrey_exchange.trade
             (trade_id, market_id, maker_order_id, taker_order_id, quantity_scaled, price_units,
              quote_minor, price_label, matched_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'SIMULATION_MARKET_PRICE',$8,$9)
           ON CONFLICT (trade_id) DO NOTHING`,
          [
            trade.tradeId,
            trade.marketId,
            trade.makerOrderId,
            trade.takerOrderId,
            trade.quantity.scaledUnits.toString(),
            trade.price.priceUnits.toString(),
            trade.quoteAmount.minorUnits.toString(),
            trade.matchedAt,
            canonicalJson(trade),
          ],
        );
      }
      for (const settlement of snapshot.settlements) {
        await client.query(
          `INSERT INTO sunrey_exchange.settlement
             (settlement_id, trade_id, coin_journal_id, cash_journal_id, fee_journal_id,
              settled_at, atomic, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
           ON CONFLICT (settlement_id) DO NOTHING`,
          [
            settlement.settlementId,
            settlement.tradeId,
            settlement.coinJournalId,
            settlement.cashJournalId,
            settlement.feeJournalId,
            settlement.settledAt,
            canonicalJson(settlement),
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
