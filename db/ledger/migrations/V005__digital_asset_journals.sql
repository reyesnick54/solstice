-- V005: allow non-ISO asset identifiers on ledger books, journals, and postings.
-- Domain customer accounts and products remain ISO CHAR(3). This is not a
-- second ledger. Fiat Money and AssetQuantity still must not share a journal.

ALTER TABLE ledger.ledger_account
  ALTER COLUMN currency TYPE TEXT;

ALTER TABLE ledger.journal
  ALTER COLUMN asset TYPE TEXT;

ALTER TABLE ledger.posting
  ALTER COLUMN currency TYPE TEXT;
