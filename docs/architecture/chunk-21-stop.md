# Chunk 21 stop record

This file records a **constitutional missing-capability stop**, not an
Agentic Capital Mesh implementation.

Task: Agentic Capital Mesh — Multi-Agent Investment Intelligence,
Capital Proposal Synthesis, Adversarial Review, Risk/Compliance
Vetoes, and Controlled Capital Planning.

Instruction on the task: start from the latest clean `main` after
Chunk 20 has merged. Required capabilities include the Investment
Risk Engine and the Model Registry. If either is not `IMPLEMENTED`,
**stop**. Do not begin Strategy Lab.

---

## A. Baseline

Inspected HEAD: `4a733f7` —
`Merge pull request #41 from reyesnick54/cursor/investment-portfolio-core-22b7`.

Latest `origin/main` is the same commit.

Workspace inventory on this tip:

- Canonical constitution and manifest are present (they were
  unparseable on `main` because PRs `#39`, `#40`, and `#41` stacked
  JSON / TypeScript merge leftovers; this stop branch repairs those
  artifacts so later Chunk 20 / Chunk 21 work can start from a
  parseable tree).
- PEG, Personal Economy Agent, mandate compiler / Growth Orchestrator,
  PEVE, Regulatory Digital Twin, Investments, Banking, Treasury,
  Kernel, policy, compliance/fraud, Security, Identity, Events,
  Evidence, and PostgreSQL are `IMPLEMENTED`.
- Reserved RISK owner `packages/risk` is **absent**. Bounded context
  `RISK` is `PLANNED`. Capability `risk` is now recorded as
  `PLANNED` / owner `packages/risk`.
- Reserved MODEL_REGISTRY owner `packages/model-registry` is
  **absent**. Bounded context `MODEL_REGISTRY` is `PLANNED`.
  Capability `model-registry` is now recorded as `PLANNED` / owner
  `packages/model-registry`.
- Reserved AGENTIC_CAPITAL_MESH owner `packages/agentic-capital-mesh`
  is **absent**. Bounded context `AGENTIC_CAPITAL_MESH` is `PLANNED`.
- No Chunk 20 branch, PR, or Risk Engine / Model Registry
  implementation exists on `main`.
- Open historical PR `#16` (`feat(phase-6): Solstice Alpha — portfolio,
  risk engine, model registry, paper trading`) is not canonical and
  was not copied.

`packages/investments/src/risk-port.ts` is an explicit placeholder:
paper-only simulation until Chunk 20. That port is not the reserved
Risk Engine.

### Gate 1 — Risk Engine is IMPLEMENTED

**Failed.**

`docs/architecture/manifest.json` records:

```json
{ "id": "RISK", "status": "PLANNED",
  "reservedPaths": ["packages/risk"] }
```

There is no `packages/risk`, no investment Risk Engine, and no
`risk` capability that is `IMPLEMENTED`. The Kernel `RISK` proof is
not this bounded context.

### Gate 2 — Model Registry is IMPLEMENTED

**Failed.**

```json
{ "id": "MODEL_REGISTRY", "status": "PLANNED",
  "reservedPaths": ["packages/model-registry"] }
```

There is no `packages/model-registry`. Material model registration,
versioning, and simulation-approval do not exist.

### Gate 3 — latest main is clean after Chunk 20

**Failed.**

Chunk 20 has not merged. Latest `main` is Chunk 19 (investments,
PR `#41`). GitHub Actions run `31884489135` on `main` at `4a733f7`
is **FAILURE** because of the PEVE / RDT / Investments merge
artifacts (invalid manifest JSON, stacked `package.json` `test`
keys, unterminated `DomainEvent` union, duplicate customer `V012`
migrations, stacked constitution tests).

### Required-capability evaluation for Chunk 21

This stop PR declares CHUNK-21 with the task's required capabilities,
including protected `risk` and `model-registry` recorded as
`PLANNED`.

`evaluateChunkRequirements` therefore returns `mustStop: true` and
`missing: ['risk', 'model-registry']`.

The stop is both:

1. the explicit task gate (Risk Engine or Model Registry not
   `IMPLEMENTED`), and
2. the constitution rule: a protected requirement that is not
   `IMPLEMENTED` is a stop, not a license to reimplement those
   subsystems or to start the Mesh anyway.

Capability clearance for Investments, PEVE, RDT, Growth, the agent,
and the rest is not permission to ignore the Chunk 20 gate.

---

## B. Mesh architecture

**Not built.**

`AGENTIC_CAPITAL_MESH` remains `PLANNED` at reserved path
`packages/agentic-capital-mesh`. No `packages/trading-agents`,
`packages/investment-agents`, `packages/hedge-agent`, or
`packages/capital-ai`. Those competing names are now listed in
`forbiddenWorkspaceRoots`.

---

## C. Node registry

**Not built.** No specialist roles, no node model references, no
capability-scoped tools.

---

## D. CapitalContext

**Not built.** No subject-bound capital context assembler.

---

## E. Tool / capability isolation

**Not built.** No Mesh tool broker. Existing Personal Economy Agent
isolation is unchanged and was not extended into a second generic
AI runtime.

---

## F. Thesis model

**Not built.** No `CapitalThesis`. No guaranteed-return fields were
added anywhere.

---

## G. Allocation model

**Not built.** No `CapitalAllocationCandidate`. No second
share-quantity primitive. Investments still owns `Quantity`.

---

## H. Adversarial review

**Not built.**

---

## I. Deterministic arbiter

**Not built.** No `CapitalProposalArbiter`. No AI majority-vote
authorization path was added.

---

## J. Risk integration

**Not built.** The Mesh cannot integrate a Risk Engine that does not
exist. The investments paper-only risk port remains a Chunk 20
placeholder.

---

## K. Model Registry integration

**Not built.** No registered model versions can be recorded because
no registry owner exists.

---

## L. Growth integration

**Not built.** Growth Orchestrator remains the owner of “should
investment capital be considered?” The Mesh was not started and
does not replace Growth.

---

## M. PEVE / RDT integration

**Not built.** PEVE and RDT remain read-intelligence / simulation
layers. No Mesh proposal consumes them.

---

## N. Staleness

**Not built.**

---

## O. Materialization boundary

**Not built.** No `CapitalProposal` → StrategyCandidate / PaperOrderDraft
bridge. Strategy Lab remains Chunk 22 and was not started.

---

## P. Persistence

**Not built.** No Mesh run / thesis / proposal tables.

Customer migrations that arrived as three parallel `V012` files
(PEVE, RDT, investments) are renumbered to contiguous
`V012` / `V013` / `V014`. That is a merge-artifact repair, not Mesh
persistence.

---

## Q. Events / evidence

**Not built.** No `capital_mesh.*` events. The `DomainEvent` union
semicolon left by the Investments / RDT merge is repaired so the
existing event fabric parses again. That is not a Mesh event
taxonomy.

---

## R. Architecture guards

This stop PR adds:

- CHUNK-21 declaration requiring protected `risk` and
  `model-registry`
- a constitution test that `mustStop` is true while those
  capabilities are `PLANNED` and `packages/agentic-capital-mesh`
  is absent
- competing Mesh directory names in `forbiddenWorkspaceRoots`

It does not implement Mesh-import, majority-vote, Risk-override, or
Execution-Authority guards inside a Mesh package, because that
package must not exist yet.

---

## S. Demo

**Not run.** The investments demo customer remains the Chunk 19
demonstration. No Mesh demo was added. Nothing traded.

---

## T. Tests

Added / repaired:

- CHUNK-21 `mustStop` while `risk` and `model-registry` are
  `PLANNED`
- reserved Mesh / Risk / Model Registry owners remain absent
- competing Mesh roots remain absent
- customer `V012` PEVE, `V013` RDT, and `V014` investments
  migrations are contiguous
- stacked CHUNK-18 / CHUNK-17 `it(` titles collapsed
- `DomainEvent` union syntax restored
- root `package.json` `test` script no longer has three stacked keys

No Mesh runtime, thesis, allocation, arbiter, staleness, or
prompt-injection tests were added, because those features were not
built.

---

## U. Exact results

Nothing under the reserved AGENTIC CAPITAL MESH context:

- no `packages/agentic-capital-mesh`
- no `packages/trading-agents` / `investment-agents` / `hedge-agent`
  / `capital-ai`
- no `packages/risk`
- no `packages/model-registry`
- no Mesh run state machine
- no CapitalContext / CapitalThesis / CapitalProposal
- no allocation compiler
- no adversarial review
- no deterministic arbiter
- no materialization bridge
- no Strategy Lab
- no new ActionType
- no new `LIVE_*` flag
- no new ledger mutator
- no Execution Authority issuance from a Mesh
- no Sol Coin / Sol Exchange / digital-asset work
- no Pyramid Coin / Pyramid Exchange / PYR references

Historical Phase 6 risk/registry code on PR `#16` was inspected
only as a pointer and was not copied.

---

## V. Exact CI

Baseline on clean `main` at `4a733f7` (GitHub Actions run
`31884489135`):

```
architectural invariants: FAILURE (invalid manifest JSON)
extraction dry-run: not reached or failed
architectural-linter: not reached or failed
deployment posture: not reached
kernel gating: not reached
tests: FAILURE
  manifest.json: Expecting ',' delimiter
  events.ts: DomainEvent union terminated before Regulatory Twin members
  constitution.test.ts: stacked it( titles / file failed
  customer migrations: three files numbered V012
demo: not reached
typecheck: not reached
secret scan: not reached
CI pipeline: FAILURE
```

Post-change CI on this branch is recorded after `npm run ci`.
`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`. Persistence integration (`npm run test:persistence`) is a
separate GitHub Actions job and was not folded into the unit-test
pipeline.

---

## W. Limitations

- Main was not a clean starting tip. This branch repairs the
  PEVE / RDT / Investments merge artifacts so later Chunk 20 /
  Chunk 21 work can start from a parseable tree. Those repairs are
  not the Risk Engine, not the Model Registry, and not the Mesh.
- `packages/investments` still exposes a paper-only risk placeholder.
  That is not permission to treat Risk as `IMPLEMENTED`.
- Kernel `RISK` proof evaluation is unchanged and is not the
  investment Risk Engine.

---

## X. Intentionally unimplemented

Everything the Chunk 21 exit criterion asked for:

1. canonical `packages/agentic-capital-mesh`
2. reuse of existing agent infrastructure for specialist nodes
3. scoped node access
4. Model Registry control of material models
5. subject-bound CapitalContext
6. structured CapitalThesis
7. deterministic allocation compiler
8. adversarial review
9. deterministic arbiter
10. Risk / mandate hard vetoes
11. regulatory-readiness preservation
12. proof that agent consensus cannot authorize execution
13. proposal staleness and no auto-trade
14. Mesh persistence / events / evidence
15. Mesh demo

Also intentionally unimplemented, as instructed:

- Strategy Lab (Chunk 22)
- any path that posts a journal, submits a broker order, or issues
  Execution Authority from the Mesh
- digital assets (Sol Coin / Sol Exchange)

---

## Y. Exit criterion status

**Not met.** The Chunk 21 exit criterion requires one canonical Mesh
package, scoped specialist nodes, Model Registry control, a
subject-bound CapitalContext, structured theses, a deterministic
allocation compiler, adversarial review, a deterministic arbiter,
Risk and mandate hard vetoes, preserved regulatory-readiness,
no consensus authorization, no auto-trade, working staleness, and
full CI.

Those features were not built because the pre-coding gates failed.

The **stop rule** passed: this agent did not reimplement Money,
ActionIntent, the Kernel, Execution Authority, the Evidence Vault,
the ledger, the account-class taxonomy, Investments, the Risk
Engine, or the Model Registry, and did not create
`packages/agentic-capital-mesh`.

---

## Z. Recommendation for Chunk 22 / next work

Do not start the Agentic Capital Mesh or Strategy Lab until all of
the following are true on clean `main`:

1. Implement Chunk 20 at the reserved owners `packages/risk` and
   `packages/model-registry`. Keep the Risk Engine as a hard gate
   (BLOCK cannot be overridden). Keep model approval out of any
   agent or Mesh. Simulation approval only. Do not treat the
   investments paper-only risk port as the Risk Engine.
2. Mark capabilities `risk` and `model-registry` `IMPLEMENTED` in
   the same change that adds those owners.
3. Confirm the latest `main` CI run is green (unit-test pipeline and
   persistence job). After this stop PR, the PEVE / RDT /
   Investments merge artifacts that made `4a733f7` red should be
   gone; re-check.
4. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag `false`.
5. Only then implement Chunk 21 at reserved owner
   `packages/agentic-capital-mesh`. Prefer that single reserved
   path. Do not create `trading-agents` / `investment-agents` /
   `hedge-agent` / `capital-ai`.
6. The Mesh must remain a proposal-and-analysis network: no
   Execution Authority, no broker submit, no ledger journal, no
   Risk override, no mandate override, no model self-approval, no
   guaranteed returns, no AI majority-vote authorization.
7. Do not begin Chunk 22 (Strategy Lab) from a Chunk 21 stop.
