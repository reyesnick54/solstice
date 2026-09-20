-- V066 HELIOS M06 — allow 4h capital market bar timeframe for crypto spot historical ingestion.
-- Reference data only; not Execution Authority.

ALTER TABLE growth.helios_market_bar
  DROP CONSTRAINT helios_market_bar_timeframe;

ALTER TABLE growth.helios_market_bar
  ADD CONSTRAINT helios_market_bar_timeframe
  CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d'));
