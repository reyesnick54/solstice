-- V028 Chunk 168: grant schema USAGE so customer_app can read Chunk 154
-- operational tables in payments. Table grants in V027 are not enough.
-- Not a second ledger and not a native-asset supply authority.

GRANT USAGE ON SCHEMA payments TO customer_app;
