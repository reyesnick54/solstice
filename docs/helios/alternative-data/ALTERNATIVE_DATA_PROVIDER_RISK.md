# Alternative Data Provider Risk

**Marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED`

## Posture

- Fixture and sandbox providers only (`packages/external-data/src/wave6/` inspiration).
- Licensing encoded per `SourceContribution.licensed`; unlicensed sources block AAF certification.
- Provider entitlement revocation blocks new feature generation (`provider_entitlement_revoked` scenario).
- Provider revision histories must not rewrite decision-time vintages.

## Skeptic vectors touching providers

`provider_revision`, `staleness`, `licensing`, `duplicate_observations`, and `coverage_bias` are mandatory AlternativeDataSkeptic checks before synthesis.
