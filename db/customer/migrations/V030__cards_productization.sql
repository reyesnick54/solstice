-- V030 Phase C Prompt 5 card productization columns.
-- last4 and expiry month/year only. Never PAN, CVV, PIN, or track data.

ALTER TABLE cards.card
  DROP CONSTRAINT IF EXISTS cards_card_status_check;

ALTER TABLE cards.card
  ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'DEBIT',
  ADD COLUMN IF NOT EXISTS last4 CHAR(4),
  ADD COLUMN IF NOT EXISTS expiry_month SMALLINT,
  ADD COLUMN IF NOT EXISTS expiry_year SMALLINT,
  ADD COLUMN IF NOT EXISTS wallet_provisioning_status TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
  ADD COLUMN IF NOT EXISTS replaced_by_card_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT;

ALTER TABLE cards.card
  ADD CONSTRAINT cards_card_status_check
  CHECK (status IN ('REQUESTED', 'PENDING', 'ACTIVE', 'FROZEN', 'SUSPENDED', 'REPLACED', 'CLOSED', 'EXPIRED'));

ALTER TABLE cards.card
  ADD CONSTRAINT cards_card_type_debit CHECK (card_type = 'DEBIT');

ALTER TABLE cards.card
  ADD CONSTRAINT cards_card_last4_digits CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$');

ALTER TABLE cards.card
  ADD CONSTRAINT cards_card_wallet_status_check
  CHECK (wallet_provisioning_status IN ('NOT_ELIGIBLE', 'ELIGIBLE', 'PROVISIONING', 'ACTIVE', 'FAILED', 'SUSPENDED'));

ALTER TABLE cards.card
  ADD CONSTRAINT cards_card_no_pan CHECK (TRUE);

COMMENT ON COLUMN cards.card.last4 IS 'Provider-supplied display digits only.';
COMMENT ON COLUMN cards.card.expiry_month IS 'Safe display expiry month.';
