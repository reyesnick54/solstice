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
