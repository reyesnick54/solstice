# SunRey operations handoff

Operations package for preproduction and future controlled launch.
Control-room state is operational status. It cannot post journals,
mint, issue Execution Authority, or flip `LIVE_*`.

`OPERATIONS_BACKEND_PRODUCTIZED=true`
`PRODUCTION_READY=false`

## Role matrix

See `docs/operations/production-responsibility-matrix.md`.

Human required: PROTOCOL_AUTHORITY, SECURITY_AUTHORITY,
VALIDATOR_OPERATIONS, INFRASTRUCTURE, DATABASE, RELEASE_AUTHORITY,
TREASURY, ORACLE, EXCHANGE, CUSTODY, COMPLIANCE_OPERATIONS,
INCIDENT_COMMAND, OPERATIONS_AUTHORITY.

AI may assist. AI never satisfies accountability.

## Runbooks and incident response

- `docs/operations/production-incident-command.md`
- `docs/operations/alerts.md`
- `docs/operations/observability.md`
- `docs/operations/chunk-156-sunrey-control-room.md`
- `docs/operations/chunk-167-launch-abort-recovery.md`

Control-room API: `packages/sunrey-chain/src/ops/control-room`.
Commands: `npm run sunrey-ops -- production incidents` and related
production verbs in `scripts/ci.sh`.

## DR and backup

- `docs/operations/disaster-recovery.md`
- `docs/operations/backups.md`
- `docs/operations/production-backup-recovery.md`
- `docs/operations/database-recovery.md`
- `docs/operations/chain-state-recovery.md`

Achieved **engineering** measurements from the in-process rehearsal
(`runDrill`), not contractual SLAs:

| Scenario | Measured RPO | Measured RTO |
| --- | --- | --- |
| DATABASE_LOSS | 0 ms | 90_000 ms |
| END_TO_END_RESILIENCE | 0 ms | 120_000 ms |
| FAILURE_DOMAIN_LOSS | 0 ms | 45_000 ms |
| CHAIN_STATE_LOSS | 0 ms | 60_000 ms |
| EXPLORER_LOSS | 0 ms | 20_000 ms |
| SIGNER_FAILURE | 0 ms | 15_000 ms |
| NO_QUORUM_PARTITION | 0 ms | 30_000 ms |

Label: `ENGINEERING_TEST_TARGETS`. Do not state a target as an
achieved production result.

## Provider, reconciliation, treasury, Exchange, custody, Agent, security

| Domain | Owner | Ops notes |
| --- | --- | --- |
| Provider operations | Provider Runtime + credential plane | Sandbox/certification only |
| Reconciliation | `packages/treasury` financial control | Breaks persist; Ledger is not auto-adjusted |
| Treasury | `packages/treasury` | Cannot mint native assets |
| Exchange surveillance | `packages/market-surveillance` | Detectors exist; a desk does not |
| Custody | `packages/custody` | Production signing disabled |
| Agent | `packages/sunrey-agent` productization ops | Pause/revoke; no self-approval |
| Security | `packages/security` + range | HSM simulator ≠ launch key |

## Launch checklist

1. RC identifier `sunrey-backend-v1.0.0-rc.2` matches the intended commit.
2. Production flags remain false until a separate authorized launch.
3. External gates in `docs/productization/sunrey-backend-release-candidate.json` are still listed as missing unless independently verified.
4. `sunrey-ops production readiness` and launch rehearsal stay fail-closed.
5. Staffing for on-call and incident command is an external gate.

Staffing itself is **not** satisfied by this repository.
