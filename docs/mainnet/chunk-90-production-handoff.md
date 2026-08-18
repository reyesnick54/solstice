# Chunk 90 — SunRey production handoff and day-2 operations

This is the final planned core engineering chunk in the current SunRey
mainnet build sequence. It prepares the software, operations, and
evidence system for long-lived production ownership.

Owner: `packages/sunrey-chain/src/production-handoff`.
Capability: `sunrey-production-handoff`.

It does **not** fabricate a real production launch. Automated testing
remains isolated and rehearsal-only. `observedProduction` is false
unless actual observed production evidence and configured human
authorization exist. Internal tests cannot create that status.

## What exists

- `ProductionHandoffPackage` bound to Mainnet RC, Candidate V2, the
  simulation production environment, genesis authorization (if present),
  launch execution (only if real execution exists), post-genesis phase,
  capabilities, provider matrix, security-review state, governance
  state, runbooks, inventory, operator ownership, and the evidence archive
- `ProductionSystemInventory` for validators, sentries, signers, RPC,
  Explorer, databases, storage, backups, oracle collectors, Exchange,
  custody, monitoring, release services, interop, and providers
- `ProductionResponsibilityMatrix` reusing Chunk 40/79/54/85 authority
  roles. AI may assist. AI cannot satisfy required human roles
- `OperatorAcceptanceRecord` with fixture isolation
- Engineering `ProductionSLOPolicy` and separate economic-integrity SLIs
- `ProductionOperationalBaseline` and hashed `ProductionConfigurationBaseline`
- `ProductionChangeRecord` with protocol changes gated through Chunk 40/79
- Maintenance windows, Chunk 54 validator procedures, key-rotation
  schedules, Chunk 82 provider-renewal reminders
- Chunk 83 finding continuity across releases
- `ProductionIncidentRecord` with Chunk 79 bounded emergency authority
- Backup verification, isolated restore drills, and Chunk 55 DR ownership
- `ProductionEvidenceSeal` (integrity of included records only)
- `sunrey-ops production` commands and a secret-free operator dashboard
- Isolated 86–90 lifecycle rehearsal

## Evidence classes

`REHEARSAL` · `ENGINEERING` · `EXTERNAL` · `HUMAN` · `PRODUCTION_OBSERVED`

Rehearsal evidence cannot become production-observed evidence.

## Handoff states

These describe the **package**, not network launch status:

- `HANDOFF_INCOMPLETE`
- `ENGINEERING_HANDOFF_READY`
- `AWAITING_EXTERNAL_ACCEPTANCE`
- `AWAITING_OPERATOR_ACCEPTANCE`
- `PRODUCTION_HANDOFF_PACKAGE_COMPLETE`

## Current external and human gaps

The assembled package reports genuine gaps:

- No independent external security review
- No legal/regulatory approval
- No production-eligible providers
- No real operator or human production acceptance

Fixture acceptance is rehearsal-only. AI cannot generate it.

## CLI

```
sunrey-ops production inventory
sunrey-ops production baseline
sunrey-ops production access
sunrey-ops production operators
sunrey-ops production slo
sunrey-ops production incidents
sunrey-ops production backups
sunrey-ops production restore-drill
sunrey-ops production providers
sunrey-ops production changes
sunrey-ops production evidence-seal
sunrey-ops production handoff
sunrey-ops production readiness
```
