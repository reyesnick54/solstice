# Alternative Data Provider Risk

**Git SHA:** `faf85de7fe517971e0ce34fadbb7af33fc9986c6`  
**Qualification timestamp (UTC):** `2026-11-07T11:42:36.763Z`  
**Stack marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED`  
**Qualified:** no  
**Posture:** `LIVE_TRADING_ENABLED=false`; `production_authorized=false`  


## Posture

- Fixture and sandbox providers only; canonical ingest under `packages/external-data` and `packages/provider-sdk`.
- Licensing encoded per `SourceContribution.licensed`; unlicensed sources block AAF certification.
- Provider entitlement revocation blocks new feature generation (`provider_entitlement_revoked` scenario).
- Provider revision histories must not rewrite decision-time vintages.

## Canonical rights owner (ALT02)

`packages/provider-sdk/src/alternative-data-rights` and `packages/external-data/src/alternative-data-rights` — qualification marker `HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED`.
