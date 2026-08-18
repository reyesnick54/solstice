# Production system inventory

Authoritative operational inventory for long-lived SunRey ownership.
This is a control-plane catalog, not a claim that production hosts exist.

| Kind | Owner role | Notes |
| --- | --- | --- |
| VALIDATOR | VALIDATOR_OPERATIONS | Chunk 54 join/exit/rotation/fencing |
| SENTRY | VALIDATOR_OPERATIONS | No signing |
| SIGNER | VALIDATOR_OPERATIONS | Remote signer; lease fencing |
| RPC | INFRASTRUCTURE | Public only if capability is active |
| EXPLORER | INFRASTRUCTURE | Rebuildable projection |
| DATABASE | DATABASE | Application data; not a second ledger |
| STORAGE | INFRASTRUCTURE | Chunk 67 durability |
| BACKUP | INFRASTRUCTURE | Recurring verification |
| ORACLE_COLLECTOR | ORACLE | Chunk 68 |
| EXCHANGE | EXCHANGE | Inactive until authorized |
| CUSTODY | CUSTODY | Provider-neutral simulation |
| MONITORING | INCIDENT_COMMAND | Secret-free telemetry |
| RELEASE_SERVICE | RELEASE_AUTHORITY | Chunk 59/84 |
| INTEROP | PROTOCOL_AUTHORITY | Light-client gateway |
| PROVIDER_DEPENDENCY | COMPLIANCE_OPERATIONS | Chunk 82 evidence |

The inventory never includes credential values. `sunrey-ops production inventory`
prints the current catalog.
