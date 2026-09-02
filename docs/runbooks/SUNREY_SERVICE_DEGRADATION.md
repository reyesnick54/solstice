# SunRey Service Degradation Runbook

**Wave 8 — Operational response**  
**Environment:** Simulation and sandbox staging

---

## Purpose

Respond to degraded or unavailable SunRey services without activating production paths or bypassing the Compliance Kernel.

---

## Severity guide

| Severity | Examples | First action |
|----------|----------|--------------|
| CRITICAL | Validator down, consensus stalled, supply reconciliation failure, database unavailable | Page on-call; freeze non-essential writes |
| HIGH | Provider degradation, event backlog, exchange settlement backlog, policy service unavailable | Degrade features via circuit breakers; notify operators |
| WARNING | Credential expiry horizon, disk low, explorer lag | Schedule remediation |

Alert definitions: `packages/sunrey-chain/ops/prometheus/alerts.json`

---

## Detection

1. **Public probes:** `GET /health`, `GET /ready` on Platform API and Consumer BFF
2. **Internal ops:** `GET /internal/v1/ops/health`, `GET /internal/v1/ops/alerts`
3. **Control room:** `GET /internal/v1/ops/control-room` for `operationalState`
4. **Prometheus/Grafana** when monitoring stack is deployed

---

## Common scenarios

### Validator down / consensus stalled

- Confirm `GET /internal/v1/ops/chain` shows `consensusState: STALLED`
- Do not present mempool acceptance as finality
- Follow `docs/runbooks/sre/chain-stall.md` and `docs/runbooks/consensus-partition-recovery.md`

### Chain / state mismatch

- Compare chain adapter height with reconciliation snapshot
- Prefer genesis replay or verified snapshot recovery over manual edits
- See `docs/architecture/WAVE2_STATE_SYNC_AND_RECOVERY.md`

### Supply reconciliation failure

- Check `GET /internal/v1/ops/reconciliation`
- Halt issuance rehearsal paths; do not mint to compensate
- See `docs/runbooks/sre/reconciliation-break.md`

### Provider degradation

- `GET /internal/v1/providers/health` for aggregate status
- `GET /internal/v1/providers/status?providerId=...` for operator detail
- Invalidate cache if needed: `POST /internal/v1/providers/cache/invalidate`
- Technical health is not legal approval

### High claim conflict

- Review `GET /internal/v1/ops/claims/queues` and `/internal/v1/ops/challenges/queues`
- Escalate to human review; agents cannot resolve conflicts autonomously

### Event backlog / dead-letter growth

- Inspect outbox and dead-letter metrics on dashboard
- Run `npm run events:outbox` and `npm run events:dead-letters` locally
- See control room outbox guidance in `docs/operations/chunk-156-sunrey-control-room.md`

### Policy or authorization service unavailable

- Confirm Kernel and identity facades are reachable
- Fail closed: deny mutations; do not catch Kernel refusal and proceed
- Review auth denial metrics on ops dashboard

### KMS / secret issue

- Check security snapshot on control room
- Rotate credentials per `docs/runbooks/key-rotation-ceremony.md`
- Never place secret values in metrics, logs, or backups

### Database unavailable

- Platform API `/ready` returns 503 when persistence is required
- Follow `docs/runbooks/sre/database-outage.md` and `docs/operations/database-recovery.md`

### Exchange settlement mismatch

- Sandbox only: verify simulation settlement backlog
- Follow `docs/runbooks/exchange-settlement-reconciliation.md`

### Unexpected production feature enablement

- Immediately verify all `LIVE_*` flags and `ENVIRONMENT` via `GET /internal/v1/ops/feature-gates`
- Treat as security incident if any live flag is true
- See `docs/runbooks/launch-security-incident.md`

---

## Degradation modes

| `operationalState` | Meaning |
|--------------------|---------|
| `NORMAL` | All engineering SLOs within budget |
| `DEGRADED` | Provider or event fabric degradation |
| `INCIDENT` | Open operational incident |
| `RECOVERY` | Recovery conditions partially satisfied |
| `BLOCKED` | Financial safety or supply invariant blocked |
| `MAINTENANCE` | Planned maintenance window |

---

## Recovery principles

1. Identify root cause using correlation IDs (never PII in metrics)
2. Satisfy all recovery conditions before declaring resolved
3. Provider health green alone does not resolve payment incidents
4. Application rollback is not chain-history rollback
5. Seal evidence for significant incidents

---

## Escalation matrix

| Domain | Runbook |
|--------|---------|
| API outage | `docs/runbooks/sre/api-outage.md` |
| Ledger invariant | `docs/runbooks/sre/ledger-invariant-failure.md` |
| Custody | `docs/runbooks/sre/custody-outage.md` |
| Exchange | `docs/runbooks/sre/exchange-incident.md` |
| Agent model | `docs/runbooks/sre/agent-model-outage.md` |

---

## Post-incident

- Transition incident to `RESOLVED` only when recovery conditions are met
- Record timeline via control room
- Update sandbox deployment validation if configuration changed
