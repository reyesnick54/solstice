# Chunk 15 stop record (historical)

This file preserves the **historical process-gate stop** from the
first Chunk 15 attempt. It is not the current completion report.

**Current status:** Chunk 13R treasury is implemented at
`packages/treasury` and `services/treasury`. Capability `treasury` is
`IMPLEMENTED`. The Personal Economy Agent was subsequently implemented
at `packages/agent` as a proposal-only interpreter. This file remains
historical.

---

This file recorded a **process-gate and missing-capability stop**, not
a Personal Economy Agent implementation, at the time it was written.

Task: Personal Economy Agent Runtime, Financial Context, Scoped Tool
Broker, Capability Tokens, Proposal System, and AI Safety Boundary.

Instruction on the task: start from the latest clean `main` after
Chunk 13R is merged. Required capabilities include Treasury. If
Treasury is still `PLANNED` / stop-only or `main` CI is red, **stop**.
Do not begin Growth Orchestrator or Investment execution.

---

## A. Baseline

Inspected HEAD: `ac7a270` —
`Merge pull request #34 from reyesnick54/cursor/personal-economic-graph-7eac`.

Latest `origin/main` is the same commit.

Workspace inventory on this tip:

- Canonical constitution and manifest are present.
- Security, Identity / ActorContext, Compliance Kernel, policy engine,
  AML/fraud fabric, banking, payments, Cards, Personal Economic Graph,
  PostgreSQL, durable events, and Evidence Vault are `IMPLEMENTED`.
- Reserved TREASURY owners `packages/treasury` and `services/treasury`
  are **absent**. Bounded context `TREASURY` is `PLANNED`.
- Chunk 13 merged as stop-only PR `#32`
  (`docs(architecture): stop Chunk 13 until Chunk 12 is implemented`).
- No Chunk 13R branch, PR, or treasury implementation exists.
- Reserved PERSONAL ECONOMY AGENT owner `packages/agent` is **absent**.
  Bounded context `PERSONAL_ECONOMY_AGENT` is `PLANNED`.
- Historical Phase 4/5 agent code on
  `cursor/phase-4-5-agent-and-growth-os-c606` was not resurrected.

### Gate 1 — Treasury is IMPLEMENTED (not PLANNED / stop-only)

**Failed.**

`docs/architecture/manifest.json` still records:

```json
{ "id": "TREASURY", "status": "PLANNED",
  "reservedPaths": ["packages/treasury", "services/treasury"] }
```

There is no `packages/treasury`, no `services/treasury`, and no
`treasury` capability that is `IMPLEMENTED`. Payment/card simulation
books in `packages/payments/src/treasury.ts` and
`packages/cards/src/treasury.ts` are system settlement books, not the
reserved TREASURY bounded context.

Chunk 13R was never opened or merged. The task required starting from
clean `main` after that resume.

### Gate 2 — current main CI is green

**Failed.**

GitHub Actions run `31872750300` on `main` at `ac7a270`
(`Merge pull request #34`, 2026-08-15T07:45:09Z):

| Job | Conclusion |
| --- | --- |
| architectural-invariants → … → tests → e2e-demo → typecheck → secrets | **FAILURE** |
| postgres → migrate → persistence-integration | **FAILURE** |

Root causes are merge artifacts from parallel PRs `#33` (Chunk 12
resume) and `#34` (Personal Economic Graph):

1. Two customer migrations both numbered `V008`
   (`V008__wallet_and_acceptance.sql` and
   `V008__economic_graph.sql`). `listMigrationFiles` requires
   contiguous versions, so customer migrations fail with
   `expected V009 got V008`.
2. `packages/events/src/events.ts` `DomainEvent` union terminates
   after `EconomicGraphOpportunityCreatedV1;` and then continues with
   wallet / SoftPOS members. Node's TypeScript stripper raises
   `ERR_INVALID_TYPESCRIPT_SYNTAX` (`Expression expected`). That
   breaks `npm run db:migrate` and every test that imports events.
3. `tools/architectural-linter/src/constitution.test.ts` stacked three
   `it(` titles for the Chunk 12 capability gate (merge leftover).
4. `docs/architecture/chunks/chunk-12-mobile-wallet-and-tap-to-pay.json`
   stacked three `"notes"` keys without commas, so
   `evaluateDeclaredChunks` could not parse the directory.

The immediately previous green `main` push was PR `#33`
(run `31872405706`). The red tip is the PEG merge onto that tip, not
an agent-implementation failure.

### Required-capability evaluation for Chunk 15

This stop PR declares CHUNK-15 with the task's required capabilities,
including a new protected `treasury` capability recorded as
`PLANNED` / owner `packages/treasury`.

`evaluateChunkRequirements` therefore returns `mustStop: true` and
`missing: ['treasury']`.

The stop is both:

1. the explicit task gate (Treasury still PLANNED / stop-only, or
   `main` CI red), and
2. the constitution rule: a protected requirement that is not
   `IMPLEMENTED` is a stop, not a license to reimplement Treasury or
   to start the agent anyway.

Capability clearance for PEG, Cards, Kernel, and the rest is not
permission to ignore the Treasury / CI gate.

---

## B. Agent bounded context

**Not built.**

`PERSONAL_ECONOMY_AGENT` remains `PLANNED` at reserved path
`packages/agent`. No `services/agent`. No parallel
`personal-agent`, `financial-agent`, `economy-ai`, or `growth-agent`
subsystem. Those competing names are now listed in
`forbiddenWorkspaceRoots`.

---

## C. Model provider

**Not built.** No provider-neutral model port and no simulation
provider. CI still does not require live AI credentials because no
agent runtime exists.

---

## D. FinancialContext

**Not built.** PEG remains the implemented intelligence layer. No
agent FinancialContext assembler.

---

## E. Tool broker

**Not built.** No `AgentToolBroker`. No read-only agent tools. No
mutation tools were added either.

---

## F. Capability tokens

**Not built.** No agent capability-token issuer. Existing
`packages/security` KeyProvider and Identity ActorContext were not
extended for agent tool access.

---

## G. Trust / untrusted-content model

**Not built.**

---

## H. Proposal schema

**Not built.** No `AgentProposal`. PEG opportunities remain
proposal-only graph objects and are not an agent proposal system.

---

## I. Deterministic validation

**Not built.**

---

## J. Numeric safety

**Not built.** No model-generated arithmetic path exists to validate.

---

## K. Privacy

**Not built.** No agent traces, prompts, or responses are persisted
because no agent runtime exists.

---

## L. Persistence

**Not built.** No agent session / run / proposal tables.

Customer migration `V008__economic_graph.sql` is renumbered to
`V009__economic_graph.sql` on this branch so customer versions are
contiguous. That is a merge-artifact repair, not agent persistence.

---

## M. Events / evidence

**Not built.** No `agent.*` events. The `DomainEvent` union
semicolon left by the PEG / wallet merge is repaired so the existing
event fabric parses again. That is not an agent event taxonomy.

---

## N. Architecture guards

This stop PR adds:

- CHUNK-15 declaration requiring protected `treasury`
- a constitution test that `mustStop` is true while Treasury is
  `PLANNED` and `packages/agent` is absent
- competing agent directory names in `forbiddenWorkspaceRoots`

It does not implement agent-import, wildcard-token, or
Execution-Authority guards inside an agent package, because that
package must not exist yet.

---

## O. Demonstration

**Not run.** The PEG demo customer (`cust_peg_maya`) remains the
Chunk 14 demonstration. No agent demo was added. No money moved as
part of this work.

---

## P. Tests

Added / repaired:

- CHUNK-15 `mustStop` while `treasury` is `PLANNED`
- reserved agent / treasury owners remain absent
- competing agent roots remain absent
- customer `V009` economic-graph migration is contiguous after wallet
  `V008`
- stacked Chunk 12 `it(` titles collapsed to one test
- `DomainEvent` union syntax restored

No agent runtime, tool-broker, token, proposal, or prompt-injection
tests were added, because those features were not built.

---

## Q. Exact results

Nothing under the reserved PERSONAL ECONOMY AGENT context:

- no `packages/agent`
- no `services/agent`
- no agent session / run state machine
- no model provider port
- no FinancialContext assembler
- no tool broker or capability tokens
- no AgentProposal / validator
- no agent events, evidence, persistence, or demo
- no Growth Orchestrator
- no investment execution
- no new ActionType
- no new `LIVE_*` flag
- no new ledger mutator
- no Execution Authority issuance from an agent

Historical Phase 4/5 agent code was inspected only as a pointer
(`packages/agent` is reserved; older PR `#11` is not canonical) and
was not copied.

---

## R. Exact CI

Baseline on clean `main` at `ac7a270` (GitHub Actions run
`31872750300`):

```
architectural invariants: reached (job failed later)
extraction dry-run: reached
architectural-linter: reached
deployment posture: reached
kernel gating: reached
tests: FAILURE
  customer migrations: expected V009 got V008
  events.ts: ERR_INVALID_TYPESCRIPT_SYNTAX (DomainEvent union)
  constitution.test.ts: stacked it( titles / file failed
  many downstream suites failed because they import events
demo: not reached
typecheck: not reached
secret scan: not reached
postgres migrate: FAILURE (same events.ts syntax error)
CI pipeline: FAILURE
```

Post-change CI on this branch (`npm run ci`):

```
architectural invariants: ok
extraction dry-run: ok (14 package(s))
architectural-linter: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (45 registered paths, all Kernel-authorized)
tests: 302 pass, 0 fail
  including: CHUNK-15 must stop while the protected treasury capability is PLANNED
  including: CHUNK-15 does not create the reserved agent owner or competing agent packages
  including: customer V009 stores Personal Economic Graph projection
demo: ok
cards demo: ok
peg demo: ok
wallet demo: ok
acceptance demo: ok
typecheck: ok
secret scan: ok
CI pipeline: ok
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`. Persistence integration (`npm run test:persistence`) is a
separate GitHub Actions job and was not folded into this unit-test
pipeline.

---

## S. Limitations

- Treasury public context (`getTreasuryPublicContext`) cannot be a
  real agent tool until the reserved TREASURY context exists.
- Main was not a clean starting tip. This branch repairs the
  PEG / wallet merge artifacts so later Chunk 13R / Chunk 15 work
  can start from a parseable tree. Those repairs are not Treasury
  and not the agent.
- `docs/BUILD_STATUS.md` still carries older stop/resume paragraphs
  from previous chunks. This file is the Chunk 15 record.

---

## T. Intentionally unimplemented

Everything the Chunk 15 exit criterion asked for:

1. canonical Personal Economy Agent runtime
2. agent FinancialContext over PEG
3. model provider port
4. scoped tools and signed capability tokens
5. AgentProposal + deterministic numeric validation
6. prompt-injection / untrusted-content model
7. agent PostgreSQL / events / evidence
8. agent demo (read-only, no money movement)

Also intentionally unimplemented, as instructed:

- Growth Orchestrator / mandate compiler / Compounder
- securities trading / investment execution
- any path that posts a journal or issues Execution Authority
  from an agent

---

## U. Exit criterion status

**Not met.** The Chunk 15 exit criterion requires one canonical
agent runtime, PEG-backed FinancialContext, a provider-neutral model
port that CI can run without live credentials, scoped tools, signed
subject-bound tokens, structured proposals with deterministic
numeric validation, cross-customer isolation, prompt-injection
resistance, and proof that the agent cannot issue Execution
Authority or mutate ledger / payments / cards / Treasury.

Those features were not built because both pre-coding gates failed.

The **stop rule** passed: this agent did not reimplement Money,
ActionIntent, the Kernel, Execution Authority, the Evidence Vault,
the ledger, the account-class taxonomy, Cards, PEG, or Treasury, and
did not create `packages/agent`.

---

## V. Recommendation for Chunk 16 / next work

Do not start the Personal Economy Agent, mandate compiler, or Growth
Orchestrator until all of the following are true on clean `main`:

1. Implement Chunk 13R at the reserved owners `packages/treasury`
   and `services/treasury`. Keep rebalancing proposal-first and
   Kernel-gated. Do not treat payment/card simulation books as
   Treasury.
2. Confirm the latest `main` CI run is green (unit-test pipeline and
   persistence job). After this stop PR, the PEG / wallet merge
   artifacts that made `ac7a270` red should be gone; re-check.
3. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag `false`.
4. Only then implement Chunk 15 at reserved owner `packages/agent`.
   Prefer that single reserved path. Do not create
   `personal-agent` / `financial-agent` / `economy-ai` /
   `growth-agent`.
5. The agent must remain structurally unable to execute: no ledger
   field on runtime ports, no `AuthorityIssuer` import, no mutation
   tools, proposals only. Conversion to `ActionIntent` stays a later
   ProposalGate with a signed capability token.
6. Do not begin Chunk 16 (Growth Orchestrator / investment
   execution) from a Chunk 15 stop.
)
