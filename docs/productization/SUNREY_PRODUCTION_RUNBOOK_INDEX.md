# SunRey production runbook index

Phase I Prompt 3 index. Points at productized SRE runbooks and the existing operations corpus.

Control room and automation never auto-execute a destructive runbook.

## Required Phase I runbooks

| ID | Path |
| --- | --- |
| API outage | `docs/runbooks/sre/api-outage.md` |
| Database outage | `docs/runbooks/sre/database-outage.md` |
| Provider outage | `docs/runbooks/sre/provider-outage.md` |
| Payment unknown status | `docs/runbooks/sre/payment-unknown-status.md` |
| Ledger invariant failure | `docs/runbooks/sre/ledger-invariant-failure.md` |
| Reconciliation break | `docs/runbooks/sre/reconciliation-break.md` |
| Exchange incident | `docs/runbooks/sre/exchange-incident.md` |
| Chain stall | `docs/runbooks/sre/chain-stall.md` |
| Validator failure | `docs/runbooks/sre/validator-failure.md` |
| Custody outage | `docs/runbooks/sre/custody-outage.md` |
| Agent/model outage | `docs/runbooks/sre/agent-model-outage.md` |
| KYC/compliance provider outage | `docs/runbooks/sre/kyc-compliance-provider-outage.md` |
| Security incident | `docs/runbooks/sre/security-incident.md` |
| Data/privacy incident | `docs/runbooks/sre/data-privacy-incident.md` |

## Existing operations corpus (selected)

- `docs/operations/alerts.md`
- `docs/operations/database-recovery.md`
- `docs/operations/disaster-recovery.md`
- `docs/operations/backups.md`
- `docs/operations/production-incident-command.md`
- `docs/operations/chunk-156-sunrey-control-room.md`
- `docs/runbooks/database-pitr.md`
- `docs/runbooks/regulated-provider-outage.md`
- `docs/runbooks/exchange-market-incident.md`
- `docs/runbooks/consensus-partition-recovery.md`
- `docs/runbooks/validator-operator-incident.md`
- `docs/runbooks/custody-security-event.md`
- `docs/runbooks/agent-security-incident.md`
- `docs/runbooks/emergency-security-coordination.md`
- `docs/runbooks/human-information-privacy-incident.md`

Machine catalog: `packages/sunrey-chain/src/ops/sre/runbooks.ts`.
