# Solstice agent rules

AI or a service may propose an action. The Compliance Kernel decides, using six proofs (Identity, Authority, Jurisdiction, Compliance, Risk, Purpose). Proofs may only get stricter, never looser. Only a signed, short-lived, scoped Execution Authority may change consequential state. Every outcome — yes and no — is sealed in the hash-chained Evidence Vault.

Money is integer minor units. Never floating-point. All timestamps are UTC.

Do not open an account except by calling `openAccount` with a verified Execution Authority. There is no admin path, test hook, or flag that skips this.

Do not write a ledger journal except through `Ledger.postJournal`, which requires an Execution Authority. Do not edit or delete a posting. Corrections are new compensating entries.

Do not store a balance on an Account. Balances are read from the ledger. A customer position is one object that always includes the class breakdown next to the total. Do not add a percentage-return, yield, or growth-rate field.

Do not record a principal deposit, withdrawal, or transfer as growth. Growth is genuine economic improvement only.

Do not change ENVIRONMENT away from simulation. Do not turn on any LIVE_* flag. Do not connect to an external bank or payment provider.

Do not catch a Kernel refusal and proceed anyway. Return the Kernel decision unchanged.

Do not put country-specific regulatory logic in application services. Ask the Kernel.

Human review is required for anything under services/accounts.

## Hard rules (from Phase 2–3 / CI-enforced agent notes)

- Do not make real network calls. Do not contact real banks, FX sources, or payment providers.
- Do not change any `LIVE_*` flag or `ENVIRONMENT`. They stay `false` / `simulation`.
- Do not mark any policy rule `CONFIRMED_BY_COUNSEL`. Unknown corridors are `RESEARCH_REQUIRED` and disabled.
- Do not select a non-permitted payment route under any scoring weight. Regulatory compatibility is a filter, not a score.
- Do not give agents a capability to add or modify a beneficiary.
- Do not weaken CI, Kernel gating, or ledger balance invariants.
- An Account cannot be built unless an Execution Authority is passed in as an argument.
- Ledger journals may be written only with a valid Execution Authority, through the ledger's posting API.
- Growth and balance-read code must not name a blended return, yield rate, APY, APR, or similar.
- Library packages must not import services. Domain code must not talk to disks, networks, or databases.

## How to change financial state

Submit an `ActionIntent` to the Compliance Kernel (`submit` / `evaluate`). HOLD, BLOCK, DEFER, and REQUIRE_MANUAL_REVIEW post nothing and still seal evidence. On ALLOW the Kernel issues a signed Execution Authority. Callers verify that authority before `openAccount` or `Ledger.postJournal`.

Registered mutators are gated. `scripts/check-kernel-gating.mjs` fails CI if a new mutator is added without Kernel authorization (reports file and line).

## Personal Economy Agent isolation (when that package exists)

The Personal Economy Agent cannot execute. Structural mechanism, not a convention:

1. `packages/agent` has no dependency on `packages/platform`.
2. `AgentRuntimePorts` contains only `context`, `claims`, and `mandates`. There is no ledger field, no kernel field, and no `AuthorityIssuer`.
3. `ExecutionAuthority` and `AuthorityIssuer` must not be importable from agent source.
4. An `AgentProposal` is not an `ActionIntent`. Conversion happens only at a ProposalGate that verifies a signed capability token before the Kernel sees the intent.
5. Agent-originated Kernel decisions never issue Execution Authority and never post journals. ALLOW means "fit for a human to consider." REFUSE is a first-class correct outcome.

Limits are not inferred from a prompt. A mandate may only narrow token authority.

## Compounder waterfall (fixed, when that package exists)

1. Emergency reserve target
2. Near-term obligations
3. High-cost debt
4. Required liquidity
5. Investment mandate
6. User goals
7. Permitted allocation

Protected deposits do not move into investments without an explicit account agreement. If the agreement is absent, the Kernel refuses. That refusal is the correct outcome.

## Growth attribution

Cost-avoided is never income. Unrealized is never withdrawable. There is no percentage-return, blended-yield, or growth-rate path.

## Canonical architecture

The machine-enforceable constitution is `docs/architecture/constitution.md`
and `docs/architecture/manifest.json`. Each protected component has exactly
one owner. Older PRs are not automatically canonical.

If a task requires a **protected** capability that is not `IMPLEMENTED` on
`main` (see `docs/architecture/chunk-dependencies.md`), stop. Do not
reimplement Money, ActionIntent, the Compliance Kernel, Execution Authority,
the Evidence Vault, the ledger, or the account-class taxonomy.

## Layout (this consolidated tree)

- `packages/domain` — Customer, Account, Brand, LegalEntity, Result, time
- `packages/money` — bigint minor units
- `packages/permissions` — ActionIntent, HMAC Execution Authority
- `packages/security` — KeyProvider, secret references, envelope encryption
- `packages/identity` — Solstice Identity, sessions, KYC metadata, ActorContext
- `packages/kernel` — six proofs, monotonic combine, Kernel submit
- `packages/ledger` — append-only journals, authority-required
- `packages/evidence` — hash-chained Evidence Vault
- `packages/events` — versioned domain events, durable envelope, outbox/inbox/replay abstractions
- `packages/config` — clock, ENVIRONMENT, LIVE_* flags
- `packages/persistence` — PostgreSQL adapter behind existing ports; not a second ledger
- `packages/personal-economic-graph` — Personal Economic Graph; non-authoritative intelligence layer
- `packages/regulatory-twin` — Regulatory Digital Twin; simulation/counterfactual only
- `packages/personal-data-vault` — Personal Data Vault; subject-bound encrypted store
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 78 economic RC freeze and qualification lives at `src/release-candidate/economic`. Chunk 84 Mainnet RC freeze and qualification lives at `src/release-candidate/mainnet`. Chunk 90 production handoff and day-2 operations live at `src/production-handoff`. Chunk 93 public RPC and Explorer data plane lives at `src/public-data-plane`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 78 economic RC freeze and qualification lives at `src/release-candidate/economic`. Chunk 84 Mainnet RC freeze and qualification lives at `src/release-candidate/mainnet`. Chunk 90 production handoff and day-2 operations live at `src/production-handoff`. Chunk 92 validator operator platform lives at `src/validator-operator`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 78 economic RC freeze and qualification lives at `src/release-candidate/economic`. Chunk 84 Mainnet RC freeze and qualification lives at `src/release-candidate/mainnet`. Chunk 90 production handoff and day-2 operations live at `src/production-handoff`. Chunk 91 executable provider runtime lives at `src/provider-runtime`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 78 economic RC freeze and qualification lives at `src/release-candidate/economic`. Chunk 84 Mainnet RC freeze and qualification lives at `src/release-candidate/mainnet`. Chunk 88 authorized genesis execution lives at `src/genesis-execution`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 78 economic RC freeze and qualification lives at `src/release-candidate/economic`. Chunk 84 Mainnet RC freeze and qualification lives at `src/release-candidate/mainnet`. Chunk 87 pre-genesis shadow qualification lives at `src/pregenesis`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger. Chunk 54 operator infrastructure lives at `src/ops`. Chunk 63 Testnet RC freeze and qualification lives at `src/release-candidate`. Chunk 70 launch rehearsal lives at `src/launch-rehearsal`. Chunk 71 monetary constitution lives at `src/economics`. Chunk 79 production governance operations live at `src/governance-ops`.
- `packages/sunrey-chain` — SunRey Chain simulation trust layer; not a second ledger
- `packages/sunrey-sdk` — official developer SDK and versioned public API adapter
- `packages/sunrey-range` — isolated adversarial cyber-economic test range; not a second ledger or live pentest service
- `packages/sunrey-economics` — Chunk 75 SunRey/MoonRey dual-economy simulation laboratory; not production monetary policy
- `packages/custody` — provider-neutral simulation custody and Travel Rule
- `packages/market-surveillance` — deterministic alerts and case proposals
- `db/` — versioned SQL migrations per bounded database
- `services/accounts` — Kernel-gated open, deposit, withdraw, transfer, balances
- `services/identity` — identity application facade; not a second identity model
- `services/economic-graph` — PEG application facade; not a second graph model
- `tools/architectural-linter` — Phase 1 invariant linter plus constitution checks
- `docs/architecture/` — constitution, manifest, ADR index, chunk declarations
- `docs/developers/` — public SDK and API documentation
- `api/` — OpenAPI and event specifications

## Commands

```
npm install
npm test
npm run demo
npm run ci
npm run db:up
npm run db:migrate
npm run test:persistence
npm run db:down
```

## What CI checks, in order

1. Architectural invariants (Python linter + extraction dry-run + `lint:architecture`)
2. Deployment posture (simulation flags)
3. Kernel gating
4. Tests, including the Phase 1 exit-criterion test
5. The end-to-end demo
6. Typecheck
7. Secret scan

A separate GitHub Actions job starts empty PostgreSQL, applies migrations, and
runs persistence integration tests. Do not fold that job into the unit-test
stage. Do not skip, reorder, or weaken the seven stages above.
