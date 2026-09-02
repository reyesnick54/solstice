# SunRey Future Mainnet Activation Ceremony

**DESIGN ONLY — DO NOT EXECUTE**

This runbook describes the future mainnet activation ceremony. No step in this document may be executed in simulation. `ENVIRONMENT` remains `simulation`. All `LIVE_*` flags remain `false`.

## Purpose

Activate mainnet only after every prerequisite is satisfied through multi-party human governance, offline ceremony signing, and immutable freeze binding. No single environment variable may turn on all production monetary systems.

## Prerequisites

All eleven prerequisites must reach `SATISFIED` status (`mainnet-ceremony-design.ts`):

| # | Prerequisite | Evidence |
|---|-------------|----------|
| 1 | Approved genesis | Chunk 164 launch freeze hash; Chunk 165 ceremony transcript |
| 2 | Validator set | Production validator dossiers; epoch-boundary freeze |
| 3 | Governance configuration | Signed threshold config; separation of duties |
| 4 | Production keys | HSM/KMS connected; non-exportable handles |
| 5 | Backups | Provider backup references; no plaintext keys |
| 6 | Monitoring | Control room, alerting, evidence vault monitoring |
| 7 | Security audit | External audit complete; no unresolved critical findings |
| 8 | Regulatory feature gates | Chunk 161 operating scope satisfied |
| 9 | Economics approval | Chunk 163 authorization package signed |
| 10 | SunRey activation decision | Authorized human governance approval |
| 11 | MoonRey activation decision | Authorized human governance approval |

Evaluate readiness with `evaluateMainnetCeremonyReadiness()`. Activation is blocked while any prerequisite is `MISSING` or `FIXTURE_ONLY`.

## Forbidden activation paths

The following must **never** activate mainnet alone:

- `ENVIRONMENT=production`
- `MAINNET_ENABLED=true`
- Any single `LIVE_*` flag
- `PRODUCTION_HSM_KMS_CONFIGURED=true` without full ceremony
- Break-glass access
- Admin API credential
- Service account identity
- Agent or AI proposal

`refuseSingleEnvMainnetActivation()` enforces this at the security boundary.

## Ceremony phases (future)

### Phase 0 — Readiness evaluation

1. Run production economic activation firewall (`evaluateProductionEconomicActivation`).
2. Verify Chunk 164 launch freeze hash unchanged.
3. Verify Chunk 163 authorization package status is `AUTHORIZED_CANDIDATE` (not `PRODUCTION_ACTIVE`).
4. Confirm `mainnetRemainsDisabled: true`.

### Phase 1 — Offline signing rehearsal

1. Assemble governance offline package (Chunk 165).
2. Collect multi-party approvals per `DEFAULT_GOVERNANCE_THRESHOLDS` for `mainnet.activate` (minimum 5 distinct approvers).
3. Bind proposal hash and policy version.
4. Verify transcript integrity.
5. **Do not broadcast.**

### Phase 2 — Validator dossier acceptance

1. Evaluate validator acceptance dossiers (`evaluateValidatorAcceptance`).
2. Freeze validator set at epoch boundary.
3. Confirm validator keys in HSM only (`SIGNER_PRIVATE` zone).

### Phase 3 — Staged capability activation

1. Follow Chunk 166 staged activation sequencing.
2. Independent product domains activate in declared order.
3. Each domain requires its own readiness gate.
4. Incident pause does not auto-resume (Chunk 167).

### Phase 4 — Economics activation (separate decisions)

SunRey and MoonRey issuance require **separate** multi-party governance approvals:

- `issuance.sunrey.activate` — 3 approvals minimum
- `issuance.moonrey.activate` — 3 approvals minimum

Neither decision is implied by mainnet ceremony completion.

### Phase 5 — Production handoff

1. Record production handoff package (Chunk 90).
2. Enable monitoring and control room (Chunk 156).
3. Verify supply invariants unchanged.
4. Seal final ceremony transcript to Evidence Vault.

## Abort and rollback

If any phase fails:

1. Follow Chunk 167 launch abort procedures.
2. Domain-scoped emergency restrictions apply.
3. Application rollback is not chain-history rollback.
4. Incident end does not auto-resume capabilities.
5. Re-qualify all prerequisites before retry.

## Roles

| Role | Responsibility |
|------|---------------|
| Protocol Governance | Protocol parameter approval |
| Security Governance | Security audit and key ceremony |
| Economic Governance | Monetary parameter and issuance decisions |
| Release Governance | Release artifact and freeze binding |
| Validator Governance | Validator set and key rotation |
| Operations Governance | Infrastructure and monitoring readiness |
| Genesis Authority | Genesis document signing (offline) |

AI, agents, and service accounts cannot hold governance approval roles.

## Audit requirements

Every ceremony step seals a `privileged.mainnet.prerequisite_check` or `privileged.governance.approval` audit event. Events contain no secrets. Transcript hashes are immutable once recorded.

## Current posture

| Check | Status |
|-------|--------|
| Ceremony executable | **NO** |
| Mainnet enabled | **NO** |
| `PRODUCTION_HSM_KMS_CONFIGURED` | `false` |
| Single-env activation | **FORBIDDEN** |
| Interface ready | `INTERFACE_READY_NOT_PRODUCTION_CONNECTED` |

## Code references

- `packages/security/src/productization/mainnet-ceremony-design.ts`
- `packages/sunrey-chain/src/release-candidate/mainnet/launch-freeze/`
- `packages/sunrey-chain/src/production-ceremony/launch-candidate/`
- `packages/sunrey-chain/src/post-genesis/staged-activation/`
- `packages/sunrey-chain/src/economics/production-activation/firewall.ts`
- `docs/architecture/WAVE7_PRIVILEGED_SECURITY_AND_KEY_MANAGEMENT.md`
