# Oracle provider incident

Use this runbook when a collector, credential, or provider is
compromised, stale, conflicting, or concentrated.

## Supported controls

1. Provider suspension — records evidence and blocks future eligible
   observations from that provider
2. Credential rotation — rotate the SecretReference; feed definitions
   never store credential values
3. Feed restriction — stop collecting a feed version
4. Quorum review — fail closed if independent controllers are short
5. Replay / reconciliation — re-validate signed history; do not
   fabricate replacement values
6. Resumption approval — human only

AI, agents, and automation cannot independently restore a suspended
production provider.

```
sunrey-oracle provider suspend <providerId>
sunrey-oracle source health
sunrey-oracle readiness
```

Alerts: `ORACLE_SOURCE_AUTH_FAILURE`, `ORACLE_SCHEMA_CHANGED`,
`ORACLE_SOURCE_STALE`, `ORACLE_QUORUM_DEGRADED`,
`ORACLE_PROVIDER_CONCENTRATION`, `ORACLE_SIGNATURE_FAILURE`,
`ORACLE_SOURCE_CONFLICT`.
