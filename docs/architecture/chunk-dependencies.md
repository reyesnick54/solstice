# Chunk and capability dependencies

Build chunks declare the capabilities they need. The architecture
tooling answers whether each required capability is:

- `IMPLEMENTED` — present on `main` with a canonical owner
- `PARTIAL` — reserved owner exists; the capability is incomplete
- `PLANNED` — reserved in the manifest; not implemented
- `ABSENT` — not in the manifest at all

## Rule

If a task requires a **protected** dependency that is not
`IMPLEMENTED` on `main`, the agent must **stop** rather than
independently reimplementing the missing subsystem.

That rule exists so a later-phase agent cannot decide:

> Phase 8 is absent, so I will create my own Phase 8.

Absence is not permission to fork. The agent updates nothing, invents
no second Kernel / ledger / Money / Evidence Vault / ActionIntent /
account-class taxonomy, and reports the missing capability.

## How to declare a chunk

Add a JSON file under `docs/architecture/chunks/`:

```json
{
  "chunk": "CHUNK-9",
  "title": "Example later chunk",
  "requires": ["persistence", "identity", "policy-engine"]
}
```

`requires` entries are capability ids from
[`manifest.json`](./manifest.json) `capabilities`.

The architectural linter loads every `docs/architecture/chunks/*.json`
file and records each requirement's status. Declaring a future chunk
that requires a `PLANNED` capability does **not** fail CI. Implementing
a competing owner for an already-protected capability does.

## Evaluator

`evaluateChunkRequirements(manifest, requires)` in
`tools/architectural-linter` returns per-capability status and
`mustStop: true` when any **protected** requirement is not
`IMPLEMENTED`.

Agents and later CI jobs use that result. They do not guess.

## Current capabilities

| Capability | Status | Owner |
| --- | --- | --- |
| money | IMPLEMENTED | packages/money |
| domain | IMPLEMENTED | packages/domain |
| permissions | IMPLEMENTED | packages/permissions |
| kernel | IMPLEMENTED | packages/kernel |
| ledger | IMPLEMENTED | packages/ledger |
| evidence | IMPLEMENTED | packages/evidence |
| events | IMPLEMENTED | packages/events |
| event-fabric | IMPLEMENTED | packages/events |
| config | IMPLEMENTED | packages/config |
| accounts-service | IMPLEMENTED | services/accounts |
| architecture-linting | IMPLEMENTED | tools/architectural-linter |
| persistence | IMPLEMENTED | packages/persistence |
| security | IMPLEMENTED | packages/security |
| identity | IMPLEMENTED | packages/identity |
| policy-engine | IMPLEMENTED | packages/kernel |
| banking-core | IMPLEMENTED | services/accounts |
| compliance-screening | IMPLEMENTED | packages/kernel |
| payments | IMPLEMENTED | packages/payments |
| fx | IMPLEMENTED | packages/payments |
| rail-adapters | IMPLEMENTED | packages/payments |
| cards | IMPLEMENTED | packages/cards |
| personal-economic-graph | IMPLEMENTED | packages/personal-economic-graph |
| treasury | IMPLEMENTED | packages/treasury |

Chunk 6 implements the policy engine inside `packages/kernel`. It does
not reimplement identity. Customer KYC status and residency remain the
identity facts the engine consumes.

Chunk 7 owns screening, AML, fraud, velocity, and cases inside
`packages/kernel/src/compliance`. It does not create `packages/compliance`
or a second Kernel. Simulation adapters only.

Chunk 12 (mobile wallet provisioning and merchant Tap-to-Pay / SoftPOS)
initially stopped because the protected `cards` capability was
`PLANNED`. Cards is now `IMPLEMENTED`. Chunk 12 was subsequently
resumed inside `packages/cards` / `services/cards`. The evaluator
returns `mustStop: false`. Historical stop:
[`chunk-12-stop.md`](./chunk-12-stop.md). Resume:
[`chunk-12-resume.md`](./chunk-12-resume.md). Do not invent a second
cards domain.

Chunk 13 (treasury / liquidity / routing intelligence) initially
stopped on a process gate while Chunk 12 was not yet genuinely
implemented and `main` CI was red. That stop is historical:
[`chunk-13-stop.md`](./chunk-13-stop.md). Chunk 13 is now resumed at
the reserved owners `packages/treasury` and `services/treasury`.
Capability `treasury` is `IMPLEMENTED`. Bounded context TREASURY is
`PARTIAL` simulation. Resume:
[`chunk-13-resume.md`](./chunk-13-resume.md). Do not create
`packages/liquidity`, `packages/routing-intelligence`,
`packages/treasury-core`, or `packages/settlement-risk`.

Chunk 14 implements the Personal Economic Graph as the first SFF 2.0
intelligence layer. It does not start the Personal Economy Agent.
The evaluator returns `mustStop: false`.

Chunk 15 (Personal Economy Agent) originally stopped while `treasury`
was `PLANNED` and `main` CI was red. That stop is historical:
[`chunk-15-stop.md`](./chunk-15-stop.md). Treasury is now
`IMPLEMENTED`, so the capability evaluator returns `mustStop: false`.
The reserved owner `packages/agent` remains absent. This tree does
not start the Personal Economy Agent.
