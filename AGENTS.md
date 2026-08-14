# Solstice agent notes

Solstice is a simulated digital bank. Phase 2: nothing that changes
financial or regulated customer state executes outside the Compliance
Kernel, including internal tools, seed scripts, tests, and admin paths.
Phase 3: a cross-border transfer completes with a scored route and
sealed evidence. All rails are simulated.

## Hard rules

- Do not make real network calls. Do not contact real banks, FX sources,
  or payment providers.
- Do not change any `LIVE_*` flag or `ENVIRONMENT`. They stay
  `false` / `simulation`.
- Do not mark any policy rule `CONFIRMED_BY_COUNSEL`. Unknown corridors
  are `RESEARCH_REQUIRED` and disabled.
- Do not select a non-permitted payment route under any scoring weight.
  Regulatory compatibility is a filter, not a score.
- Do not edit a posted journal. Reverse with compensating entries.
- Do not use floating-point for rates, fees, or amounts. Use `bigint`
  minor units and `Rational`.
- Do not give agents a capability to add or modify a beneficiary.
- Do not give agents a capability to grant, modify, or revoke consent.
- Do not return raw vault records outside the Vault / clean-room boundary.
- Do not allow a single request to span data categories.
- Do not default, infer, or auto-populate any field of an access request.
- Do not write raw personal data into logs, events, or evidence records.
- Do not change `LIVE_DATA_MARKET_ENABLED`. It stays `false`.
- Do not weaken CI, Kernel gating, or ledger balance invariants.

## How to change financial state

Submit an `ActionIntent` to `ComplianceKernel.evaluate`. HOLD and BLOCK
post nothing and still seal evidence. Payments take a second gate,
`grantExecutionAuthority`, after FX quote and route selection.

Registered mutators live in `packages/kernel/src/state-changing-paths.ts`.
`scripts/check-kernel-gating.mjs` fails CI if a new mutator is added
without Kernel authorization (reports file and line).

## Layout

- `packages/domain` — Money, Customer, Account, Beneficiary
- `packages/kernel` — proofs, posture, packs, sanctions/AML stubs, evidence
- `packages/ledger` — append-only journals, Kernel-gated stores
- `packages/payments` — FX router, rails, routing engine, execution
- `packages/data-fabric` — Segmented Personal Data Vault, Purpose Firewall, Consent Ledger, Clean Room
- `apps/demo` — domestic, USD→EUR, sanctions block, failed settlement, Phase 7 clean-room aggregate

## Commands

```
npm install
npm run ci
```
# AGENTS.md — Solstice Personal Economy Agent

This file is the contract for any agent (human or model) working in this
repository. Enforcement of money movement, capability limits, and mandates
is **infrastructure**. Prompt text is not a control.

## What exists

- `packages/domain` — Customer aggregate (Phase 1 domain).
- `packages/contracts` — Money, catalogs, proposal types, financial context DTO.
- `packages/agent` — Personal Economy Agent, mandate compiler, Compounder, Growth OS (propose-only).
- `packages/platform` — Capability tokens, ProposalGate, Compliance Kernel, Growth Attribution Ledger, Execution Authority, simulated ledger.

## Non-negotiable isolation

The Personal Economy Agent **cannot execute**.

Structural mechanism (not a convention):

1. `packages/agent` has no dependency on `packages/platform`.
2. `AgentRuntimePorts` contains only `context`, `claims`, and `mandates`.
   There is no ledger field, no kernel field, and no `AuthorityIssuer`.
3. `ExecutionAuthority` and `AuthorityIssuer` live only under
   `packages/platform/src/authority`. Agent source cannot import them;
   `tests/agent-isolation.test.ts` greps every agent import line.
4. An `AgentProposal` is not an `ActionIntent`. The only conversion site is
   `ProposalGate.submitProposal`, which verifies the signed capability token
   **before** the Kernel sees the intent.
5. Agent-originated Kernel decisions never call `AuthorityIssuer.issue` and
   never call `SimulatedLedger.postJournal`. ALLOW means "fit for a human to
   consider." REFUSE is a first-class correct outcome.

## Capability tokens

Issued and verified by `CapabilityTokenIssuer` (HMAC). Claims include allowed
proposal types, forbidden actions, per-transaction and daily limits, allowed
account classes, forbidden data categories, expiry, and revocation.

Limits are **not** inferred from a prompt. A proposal that exceeds a limit is
`BLOCKED` at the gate and does not reach the Kernel.

## Mandates

Customer-facing sentences compile to typed constraint objects in
`packages/agent/src/mandates/compile.ts`. If a sentence does not match a
known template, it is rejected with an explanation. Evaluation never asks a
model to interpret leftover prose.

A mandate may only **narrow** token authority. Changing a mandate is a
`SET_MANDATE` ActionIntent through the Kernel.

## Compounder waterfall (fixed)

1. Emergency reserve target
2. Near-term obligations
3. High-cost debt
4. Required liquidity
5. Investment mandate
6. User goals
7. Permitted allocation

Protected deposits do not move into investments without an explicit account
agreement. If the agreement is absent, the Kernel **refuses**. That refusal
is the correct outcome.

## Growth attribution

13 sources × 4 realization classes (`SETTLED_CASH`, `UNREALIZED`,
`COST_AVOIDED`, `PENDING`). Cost-avoided is never income. Unrealized is
never withdrawable. There is **no** percentage-return, blended-yield, or
growth-rate path. `tests/no-percentage-return.test.ts` greps production TS.

## LIVE_* flags

All false. Do not change them. Enforcement does not call an external LLM.

## Tests

`npm test` then `npm run demo`. Do not decrease the passing count.

## Personal Data Fabric (Phase 7)

Possession of data never implies permission to use it. Every access
declares requester, purpose, jurisdiction, and duration. Consent is
granular, time-limited, revocable, and auditable. Computation goes to
the data. The Purpose Firewall enforces purpose on the backend access
path — not by prompt. Health data authorized for wellness is unreachable
for advertising, credit, investment eligibility, or employment.

Granting, modifying, and revoking consent are ActionIntents through the
Kernel. Consent is append-only and versioned. Expiry is evaluated at
access time. ADR-0008 is still PROPOSED: the Vault sits behind a storage
interface. Key handling sits behind an interface with a simulated local
provider; real HSM/KMS integration is out of scope and flagged for
security review. Differential privacy is an interface with a documented
simple mechanism and no formal guarantee.
# Solstice agent rules

These rules are enforced by computers in CI, not by memory. If a change
breaks a rule, the build fails. A person must review the paths listed in
CODEOWNERS before those files merge.

## How money and accounts work

1. A person or an AI may *propose* an action. Only the Compliance Kernel
   may *authorize* it. The only thing that may change money or open an
   account is a short-lived signed Execution Authority from that Kernel.
2. An Account cannot be built unless that Execution Authority is passed
   in as an argument. There is no back door, admin switch, or test hook
   that creates an account without one.
3. Ledger journals (the official record of money moving) may be written
   only with a valid Execution Authority, through the ledger's posting
   API. Other files must not push or insert journal lines themselves.
4. An account does not store a balance. A balance is always added up
   from ledger postings at the moment someone asks. Putting a balance
   field on an account is a defect.
5. Growth and balance-read code must not name a blended return, yield
   rate, APY, APR, or similar. Insured deposits, investments, and other
   classes stay separate. A single percentage "return" is forbidden.
6. Money is whole minor units (integer / bigint). Floating-point numbers
   (including `parseFloat` and decimals like `1.50`) are forbidden on
   money paths.

## Simulation

This repository is a banking simulation. Real money and live trading
stay off. Simulation stays on. Flipping those flags fails CI. Changing
them also requires a person to review `config/`.

## Packages and services

Library packages must not import services. Each package must be
extractable on its own. Domain code must not talk to disks, networks, or
databases.

## Evidence

Every yes and every no from the Kernel is sealed in the Evidence Vault.
Refusing an action still produces a record. Approving one does too.

## What CI checks, in order

1. Architectural invariants (the rules above) and an extraction dry-run
2. Deployment posture (simulation flags)
3. Tests, including the Phase 1 exit-criterion test
4. The end-to-end demo
5. A secret scan

Do not skip, reorder, or weaken these stages.
