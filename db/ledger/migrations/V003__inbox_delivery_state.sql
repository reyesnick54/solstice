-- Inbox is consumer delivery state, not a projection of domain_event.
-- Consumers may record replayed or not-yet-catalogued event ids (schema
-- and ordering guards run after tryBegin). Outbox and dead_letter still
-- reference domain_event because they are producer-side delivery of a
-- committed envelope.

ALTER TABLE ledger.inbox
  DROP CONSTRAINT IF EXISTS inbox_event_id_fkey;
