# Alternative Data Provider Risk

**Git SHA:** `68ec6eaa7522a6a463c0c450a3c7d3c19ba29d92`  
**Qualification timestamp (UTC):** `2026-11-07T12:17:54.232Z`  
**Stack marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED`  
**Qualified:** yes  
**Posture:** `LIVE_TRADING_ENABLED=false`; `production_authorized=false`  


## Posture

- Fixture and sandbox providers only; canonical ingest under `packages/external-data` and `packages/provider-sdk`.
- Licensing encoded per `SourceContribution.licensed`; unlicensed sources block AAF certification.
- Provider entitlement revocation blocks new feature generation (`provider_entitlement_revoked` scenario).
- Provider revision histories must not rewrite decision-time vintages.

## Canonical rights owner (ALT02)

`packages/provider-sdk/src/alternative-data-rights` and `packages/external-data/src/alternative-data-rights` — qualification marker `HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED`.
