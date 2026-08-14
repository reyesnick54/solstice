-- V001 customer: legal entities and customers.
-- Customers are mutable (status / KYC version). History is evidence, not an UPDATE of a posting.
-- This database is not the ledger. No journal or posting objects may be created here.

CREATE SCHEMA IF NOT EXISTS customer;

CREATE TABLE customer.legal_entity (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE customer.customer (
  id TEXT PRIMARY KEY,
  legal_entity_id TEXT NOT NULL,
  jurisdiction CHAR(2) NOT NULL,
  residency CHAR(2) NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('PROSPECT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED')
  ),
  kyc_state TEXT NOT NULL CHECK (
    kyc_state IN ('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'EXPIRED')
  ),
  kyc_record_version INTEGER NOT NULL CHECK (kyc_record_version >= 0),
  refresh_by TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0)
);

-- Opaque legal-entity id only. No FK to another regulated database.
-- legal_entity_id is not a join to the ledger.

REVOKE ALL ON SCHEMA customer FROM PUBLIC;
GRANT USAGE ON SCHEMA customer TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.customer TO customer_app;
GRANT SELECT, INSERT, UPDATE ON TABLE customer.legal_entity TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.customer FROM customer_app;
REVOKE DELETE, TRUNCATE ON TABLE customer.legal_entity FROM customer_app;
