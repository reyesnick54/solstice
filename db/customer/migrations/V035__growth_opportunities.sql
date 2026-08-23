-- V035 Growth opportunity discovery (Phase E Prompt 2).
-- Planning / recommendation state only. Does not post journals,
-- store balances, or encode a guaranteed return.

CREATE TABLE growth.opportunity (
  opportunity_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  detector TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  body_canonical TEXT NOT NULL,
  CONSTRAINT growth_opportunity_id_prefix CHECK (opportunity_id LIKE 'gop_%'),
  CONSTRAINT growth_opportunity_no_guaranteed_return CHECK (
    body_canonical NOT LIKE '%guaranteedReturn%'
    AND body_canonical NOT LIKE '%guaranteed_return%'
    AND body_canonical NOT LIKE '%"apy"%'
    AND body_canonical NOT LIKE '%"apr"%'
  )
);

CREATE TABLE growth.opportunity_preference (
  subject_id TEXT PRIMARY KEY,
  body_canonical TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE growth.opportunity_recompute (
  subject_id TEXT PRIMARY KEY,
  recomputed_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL
);

CREATE INDEX growth_opportunity_subject ON growth.opportunity (subject_id, status);

GRANT SELECT, INSERT, UPDATE ON growth.opportunity TO customer_app;
GRANT SELECT, INSERT, UPDATE ON growth.opportunity_preference TO customer_app;
GRANT SELECT, INSERT, UPDATE ON growth.opportunity_recompute TO customer_app;
REVOKE DELETE, TRUNCATE ON growth.opportunity FROM customer_app;
REVOKE DELETE, TRUNCATE ON growth.opportunity_preference FROM customer_app;
REVOKE DELETE, TRUNCATE ON growth.opportunity_recompute FROM customer_app;
