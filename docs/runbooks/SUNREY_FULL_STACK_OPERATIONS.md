# SunRey Full-Stack Operations Runbook

**Wave 8 — Internal operational plane**  
**Owner:** Platform API operations module + Chunk 156 control room

---

## Scope

Day-2 operations for the integrated SunRey simulation product:

- Service health (`PROCESS_UP` vs `READY_TO_SERVE`)
- Provider and Economic Awareness health
- Chain status and reconciliation
- Claim and challenge queues
- Identity review (simulation)
- Policy and feature gates
- Agent operations (ProposalGate only)
- Governance proposal review (no single-admin mint)

All surfaces require internal operator authentication. Consumer and Lovable clients are denied.

---

## Authentication

Internal routes require:

| Header | Value |
|--------|-------|
| `x-sunrey-internal-token` | Configured `SUNREY_INTERNAL_OPERATOR_TOKEN` |
| `x-sunrey-operator-role` | `GOVERNANCE_OPERATOR`, `GOVERNANCE_ADMIN`, or `HUMAN_GOVERNANCE` |

Consumer client headers (`x-sunrey-client: lovable|consumer|bff`) are rejected on production-gate and governance surfaces.

---

## Operational endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /internal/v1/ops/health` | Aggregate product health |
| `GET /internal/v1/ops/dashboard` | Read-only operational metrics |
| `GET /internal/v1/ops/chain` | Block height, finality, validators, mempool |
| `GET /internal/v1/ops/economic-awareness` | Provider plane and dependencies |
| `GET /internal/v1/ops/claims/queues` | Human and productive claim queues |
| `GET /internal/v1/ops/challenges/queues` | Productive claim challenges |
| `GET /internal/v1/ops/identity/review` | Identity review queue (simulation) |
| `GET /internal/v1/ops/policy/status` | Policy and issuance posture |
| `GET /internal/v1/ops/circuit-breakers` | Domain circuit breakers |
| `GET /internal/v1/ops/reconciliation` | Supply and custody reconciliation |
| `GET /internal/v1/ops/agents` | Agent proposal statistics |
| `GET /internal/v1/ops/feature-gates` | Sandbox feature gates |
| `GET /internal/v1/ops/alerts` | Active in-process alerts |
| `GET /internal/v1/ops/control-room` | Control room report |
| `GET /internal/v1/ops/sandbox/seed` | Deterministic seed catalog |
| `GET /internal/v1/providers/health` | Provider aggregate health |
| `GET /internal/v1/production-gates` | Production gate snapshot |

---

## Governance operations

| Endpoint | Purpose |
|----------|---------|
| `GET /internal/v1/governance/proposals/:id` | View monetary/policy proposal |
| `GET /internal/v1/governance/proposals/:id/evidence` | Evidence commitments |
| `GET /internal/v1/governance/proposals/:id/result` | Finalized approval view |
| `POST /internal/v1/governance/proposals/:id/approve` | Human approval (role-gated) |
| `POST /internal/v1/governance/proposals/:id/reject` | Human rejection (role-gated) |

Approvals never issue Execution Authority or mint supply. `mintAuthorized` is always `false` on API responses.

CLI alternative: `npm run demo:sunrey-governance` and `sunrey-moonrey-policy`.

---

## Health model

| Phase | Meaning |
|-------|---------|
| `PROCESS_UP` | Process is running but not all dependencies are ready |
| `READY_TO_SERVE` | Required checks passed; safe to accept orchestrated traffic |

Platform API `/ready` remains the canonical public readiness probe. Internal aggregate health adds cross-service dependency visibility.

---

## Observability

- Metrics catalog: `packages/sunrey-chain/src/ops/control-room/catalog.ts`
- Prometheus rules: `packages/sunrey-chain/ops/prometheus/alerts.json`
- Grafana dashboards: `packages/sunrey-chain/ops/grafana/dashboards/`
- OTel collector reference: `packages/sunrey-chain/ops/otel-collector.yaml`

Control room demo:

```bash
npm run demo:sunrey-control-room
```

---

## Daily cadence

1. Check aggregate health and open alerts
2. Review provider degradation and claim queue depth
3. Confirm supply reconciliation and `productionActive: false`
4. Review governance proposals pending human approval
5. Verify backup job success (database and configuration)

See also `docs/runbooks/day-2-operations.md`.

---

## What operators cannot do via this plane

- Post ledger journals
- Mint SunRey or MoonRey
- Issue Execution Authority
- Enable `LIVE_*` flags
- Activate production economics
- Bypass Kernel refusal

These are structural prohibitions, not missing features.
