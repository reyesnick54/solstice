-- V064 HELIOS Multi-Asset M02 — extend market observation types for time-series fabric.
-- Extends V050 H08 table; does not create a parallel market-data store.

ALTER TABLE growth.helios_market_observation
  DROP CONSTRAINT helios_market_observation_type;

ALTER TABLE growth.helios_market_observation
  ADD CONSTRAINT helios_market_observation_type CHECK (observation_type IN (
    'tick', 'quote', 'daily_price', 'corporate_filing', 'economic_release', 'reference_metadata', 'other',
    'trade', 'ohlcv_bar', 'reference_price', 'market_status', 'best_bid_offer', 'order_book_snapshot'
  ));

CREATE INDEX helios_market_observation_provider_idx
  ON growth.helios_market_observation (provider_id, canonical_instrument_id, knowable_at DESC);
