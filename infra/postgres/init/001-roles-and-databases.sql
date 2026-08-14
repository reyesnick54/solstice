-- Local/simulated roles and bounded-domain databases.
-- Passwords are development-only and are not production secrets.

CREATE ROLE solstice_migrator LOGIN PASSWORD 'solstice_dev_only_migrator';
CREATE ROLE customer_app LOGIN PASSWORD 'solstice_dev_only_customer';
CREATE ROLE ledger_writer LOGIN PASSWORD 'solstice_dev_only_ledger';
CREATE ROLE ledger_reader LOGIN PASSWORD 'solstice_dev_only_ledger';
CREATE ROLE evidence_app LOGIN PASSWORD 'solstice_dev_only_evidence';

CREATE DATABASE solstice_customer OWNER solstice_migrator;
CREATE DATABASE solstice_ledger OWNER solstice_migrator;
CREATE DATABASE solstice_evidence OWNER solstice_migrator;

REVOKE ALL ON DATABASE solstice_customer FROM PUBLIC;
REVOKE ALL ON DATABASE solstice_ledger FROM PUBLIC;
REVOKE ALL ON DATABASE solstice_evidence FROM PUBLIC;

GRANT CONNECT ON DATABASE solstice_customer TO solstice_migrator;
GRANT CONNECT ON DATABASE solstice_customer TO customer_app;
GRANT CONNECT ON DATABASE solstice_ledger TO solstice_migrator;
GRANT CONNECT ON DATABASE solstice_ledger TO ledger_writer;
GRANT CONNECT ON DATABASE solstice_ledger TO ledger_reader;
GRANT CONNECT ON DATABASE solstice_evidence TO solstice_migrator;
GRANT CONNECT ON DATABASE solstice_evidence TO evidence_app;
