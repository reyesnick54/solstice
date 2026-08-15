-- V014 Canonical investment account and portfolio core.
-- Not a second ledger. Cash remains in canonical journals.
-- Security quantity is not Money. No broker credentials.

CREATE SCHEMA IF NOT EXISTS investment;

CREATE TABLE investment.profile (
  investment_account_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  brokerage_cash_account_id TEXT NOT NULL,
  securities_account_id TEXT NOT NULL,
  pending_settlement_account_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'RESTRICTED', 'FROZEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL,
  environment TEXT NOT NULL CHECK (environment = 'simulation'),
  live_state BOOLEAN NOT NULL CHECK (live_state = FALSE),
  CONSTRAINT investment_profile_no_balance CHECK (
    investment_account_id NOT LIKE '%balance%'
  )
);

CREATE TABLE investment.instrument (
  instrument_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  display_name TEXT NOT NULL,
  instrument_type TEXT NOT NULL CHECK (instrument_type IN ('EQUITY', 'ETF', 'BOND', 'FUND', 'CASH_EQUIVALENT')),
  currency CHAR(3) NOT NULL,
  market_id TEXT NOT NULL,
  status TEXT NOT NULL,
  fractional_supported BOOLEAN NOT NULL,
  min_qty_units BIGINT NOT NULL,
  simulation BOOLEAN NOT NULL CHECK (simulation = TRUE),
  listed_claim TEXT NOT NULL CHECK (listed_claim = 'DETERMINISTIC_FIXTURE')
);

CREATE TABLE investment.paper_order (
  order_id TEXT PRIMARY KEY,
  investment_account_id TEXT NOT NULL REFERENCES investment.profile (investment_account_id),
  instrument_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity_units BIGINT NOT NULL,
  filled_units BIGINT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('MARKET_SIMULATION', 'LIMIT_SIMULATION')),
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  intent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  simulation BOOLEAN NOT NULL CHECK (simulation = TRUE)
);

CREATE TABLE investment.fill (
  fill_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES investment.paper_order (order_id),
  instrument_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity_units BIGINT NOT NULL,
  price_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  fee_minor BIGINT NOT NULL,
  provider_fill_ref TEXT NOT NULL UNIQUE,
  filled_at TIMESTAMPTZ NOT NULL,
  simulation BOOLEAN NOT NULL CHECK (simulation = TRUE)
);

CREATE TABLE investment.lot (
  lot_id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  quantity_units BIGINT NOT NULL,
  remaining_units BIGINT NOT NULL,
  remaining_cost_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  source_fill_id TEXT NOT NULL,
  tax_treatment TEXT NOT NULL CHECK (tax_treatment = 'FIFO_SIMULATION_ACCOUNTING_METHOD'),
  tax_advice BOOLEAN NOT NULL CHECK (tax_advice = FALSE)
);

CREATE TABLE investment.position (
  investment_account_id TEXT NOT NULL REFERENCES investment.profile (investment_account_id),
  instrument_id TEXT NOT NULL,
  quantity_units BIGINT NOT NULL,
  available_units BIGINT NOT NULL,
  settled_units BIGINT NOT NULL,
  remaining_cost_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (investment_account_id, instrument_id),
  CONSTRAINT investment_position_qty_not_money CHECK (quantity_units IS NOT NULL)
);

CREATE TABLE investment.settlement (
  settlement_id TEXT PRIMARY KEY,
  fill_id TEXT NOT NULL,
  investment_account_id TEXT NOT NULL,
  side TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('TRADE_DATE', 'PENDING_SETTLEMENT', 'SETTLED')),
  cash_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  delay_days BIGINT NOT NULL,
  trade_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ
);

CREATE TABLE investment.valuation (
  valuation_id TEXT PRIMARY KEY,
  investment_account_id TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  currency CHAR(3) NOT NULL,
  market_value_minor BIGINT NOT NULL,
  cost_basis_minor BIGINT NOT NULL,
  unrealized_minor BIGINT NOT NULL,
  cash_minor BIGINT NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT investment_valuation_no_yield CHECK (
    body_canonical NOT LIKE '%apy%' AND body_canonical NOT LIKE '%APR%'
  )
);

CREATE TABLE investment.corporate_action (
  corporate_action_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('DIVIDEND', 'SPLIT')),
  instrument_id TEXT NOT NULL,
  record_ref TEXT NOT NULL,
  cash_minor BIGINT,
  currency CHAR(3) NOT NULL,
  processed_at TIMESTAMPTZ,
  simulation BOOLEAN NOT NULL CHECK (simulation = TRUE)
);

CREATE TABLE investment.reconciliation (
  reconciliation_id TEXT PRIMARY KEY,
  investment_account_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN (
    'MATCHED',
    'PENDING',
    'POSITION_MISMATCH',
    'CASH_MISMATCH',
    'MISSING_FILL',
    'MISSING_INTERNAL',
    'INVESTIGATION_REQUIRED'
  )),
  findings_canonical TEXT NOT NULL,
  auto_adjusted BOOLEAN NOT NULL CHECK (auto_adjusted = FALSE),
  created_at TIMESTAMPTZ NOT NULL
);

REVOKE ALL ON SCHEMA investment FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA investment FROM PUBLIC;

GRANT USAGE ON SCHEMA investment TO customer_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA investment TO customer_app;
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA investment FROM customer_app;
