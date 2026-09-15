# HELIOS Phase 1 Closure Report (H03)

Date: 2026-09-15  
Base branch: `main` @ `3c13beb3df000c25b8e81b953058387d9b04774d`

## Status

**HELIOS_PHASE_1_BASELINE_TRUSTED**

Phase 1 closes with truthful proposal and execution-state semantics, regression coverage, and explicit simulation boundaries. Full provider-backed async execution (H22–H24) remains deferred by design.

## Repository baseline

- SunRey remains in `simulation` posture; no `LIVE_*` flags activated.
- Canonical financial mutation path: proposal → deterministic controls → Execution Authority → ledger/service owners.
- Grow, Agent, and AI runtime packages remain structurally isolated from direct ledger posting and EA issuance.

## Phase 1 work disposition

| Work package | Status | Notes |
|---|---|---|
| H01 numerical semantics | Repaired / covered | Integer minor-unit invariants enforced via existing money, grow, and Phase 1 exit tests |
| H02 quantitative defects | Repaired / covered | Guaranteed-return guards, scenario attribution (`projectedNotRealized`), grow suitability checks |
| H03 proposal + execution correctness | Completed in this change set | Canonical lifecycle projection, BFF truthfulness, tool/evidence binding, architecture guard |

## Proposal lifecycle (before → after)

**Before**

- Grow proposal and execution vocabulary existed but client projections could overstate completion (`submittedIsNotCompleted: state !== 'COMPLETED'`).
- Product, grow lifecycle, and agent/action-card planes used parallel status words without a single canonical mapping at the BFF boundary.
- AI growth proposals could cite evidence strings without binding to completed tool runs.

**After**

- Canonical proposal lifecycle states: `PROPOSED`, `AWAITING_APPROVAL`, `AUTHORIZED`, terminal/degraded states preserved.
- BFF grow proposal projection exposes `canonicalLifecycleState`, `proposalIsNotExecution`, `approvalIsNotExecution`, `authorizationIsNotExecution`, `executesMoney: false`.
- Approved proposals map to `AUTHORIZED` (permission, not execution).

## Execution-state lifecycle (before → after)

**Before**

- Grow execution states existed (`QUEUED`, `SUBMITTED`, `PROCESSING`, `PARTIALLY_COMPLETED`, `COMPLETED`, …) but BFF collapsed completion semantics.
- `submittedIsNotCompleted` was inconsistent between adapter, canonical helper, and BFF.

**After**

- Canonical execution lifecycle includes `SUBMITTED`, `ACKNOWLEDGED`, `PARTIALLY_FILLED`, `FILLED`, plus preserved `FAILED`, `CANCELLED`, `UNKNOWN`, `ACTION_REQUIRED`.
- BFF execution projection uses `projectGrowExecutionForClient()` with:
  - `canonicalLifecycleState`
  - `executionMode` (`SIMULATION_FIXTURE`, `SIMULATION_SANDBOX`, `PAPER`, `PROVIDER_SANDBOX`, `LIVE`)
  - `submittedIsNotCompleted`, `providerConfirmed`
  - explicit non-implication flags (`submissionIsNotAcknowledgement`, `acknowledgementIsNotFill`, `fillIsNotSettlement`, `settlementIsNotReconciliation`)
- Transition guard remains: `SUBMITTED → COMPLETED` without fill evidence is refused.

## Authority-boundary findings

- Agent cannot self-approve (`AGENT_CANNOT_SELF_APPROVE`) — tested and enforced in grow service and BFF.
- Agent cannot execute privileged grow tools (`AGENT_CANNOT_EXECUTE`).
- ProposalGate converts to `ActionIntent` only; does not mint Execution Authority.
- AI runtime responses require `grantsExecutionAuthority: false`.
- New architecture linter rule `model-output-is-not-authorization` blocks agent/AI/grow sources from setting authorization/execution booleans to `true`.

## Tool/evidence binding

- Added `validateGrowthProposalEvidenceBinding()` and `bindGrowthProposalEvidence()` in `packages/ai-runtime`.
- Growth proposals citing `tool:*` evidence or `providerDataReferences` must reference completed tool-run IDs.
- Model narrative alone cannot satisfy tool-backed evidence claims.

## Persistence / restart

- Grow lifecycle durable schema (`V036__grow_execution.sql`) and PG adapter remain canonical owners.
- BFF sandbox defaults to in-memory grow store; restart drops in-flight sandbox state by design.
- Limitation recorded: full durable agent mandate store remains a later productization item (backlog P1-3).

## Idempotency / unknown-state

- Command creation remains idempotent via stable `idempotencyKey` / `commandId`.
- Duplicate execute requests return the same execution record.
- Unknown provider outcomes transition to `REQUIRES_REVIEW` (`canonicalLifecycleState: UNKNOWN`); no blind resubmit.

## Customer isolation

- Cross-customer proposal read/approve/execute attempts fail (`RESOURCE_NOT_OWNED` / `NOT_FOUND`).
- Covered in H03 regression tests and existing BFF negative tests.

## Tests run

- `tests/helios-h03-proposal-execution-correctness.test.ts` (new)
- Existing grow/agent/BFF suites referenced by CI (`npm test`, `npm run ci`)

## Migration / API compatibility

- No database migration required.
- BFF grow execution/proposal responses are additive: new canonical fields and corrected `submittedIsNotCompleted` semantics.
- Existing state strings preserved; clients should prefer `canonicalLifecycleState` and `executionMode`.

## Deferred to later phases

- Full async provider execution adapter wiring through Grow BFF (H22–H24).
- Unified action-card ↔ grow execution status feed.
- Durable agent mandate/proposal store.
- Live provider execution paths.

## Blockers

None for Phase 1 closure.
