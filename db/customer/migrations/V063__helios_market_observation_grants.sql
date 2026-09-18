-- V063 HELIOS H08 follow-on — customer_app grants for market observation persistence.
-- V050 created growth.helios_market_observation without role grants; persistence tests require INSERT/UPDATE.

GRANT SELECT, INSERT, UPDATE ON TABLE growth.helios_market_observation TO customer_app;
REVOKE DELETE, TRUNCATE ON TABLE growth.helios_market_observation FROM customer_app;
