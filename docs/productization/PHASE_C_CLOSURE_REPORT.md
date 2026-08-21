# Phase C closure report

PHASE C does not mean SunRey is production ready.

PHASE C means the repository now has a production-quality Money &
Banking backend in simulation: Ledger-backed accounts, internal
transfers, payment orchestration, beneficiaries, FX quotes and
USD→SAR conversion, simulated cards, treasury account kinds, settlement
records, reconciliation with persistent breaks, suspense, daily close,
and a consumer BFF/SDK surface Lovable can call without internal-service
knowledge.

No production activation occurred. Phase D (real providers) has not
started.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

`MONEY_BACKEND_PRODUCTIZED=true`
`REAL_BANKING_CONNECTED=false`
`REAL_CARD_PROCESSOR_CONNECTED=false`
`REAL_FX_PROVIDER_CONNECTED=false`

`READY_FOR_PHASE_D=true`

## Executive summary

Phase C extends the canonical Ledger, accounts, payments, cards, and
treasury owners. Reconciliation never silently adjusts the Ledger.
Daily close is labeled `NOT_A_REGULATORY_REPORT`. Simulation providers
cannot activate under a production configuration.

The consumer platform at `services/consumer-platform` now exposes
sandbox HOME, ACCOUNTS, ACTIVITY, SEND, RECIPIENTS, FX, and CARDS.
`@solstice/sunrey-sdk/consumer` is the Lovable-safe client.

## Ledger status

**PRODUCTIZED_INTERNAL.** Journals still require verified Execution
Authority through `Ledger.postJournal`. Balances are projections.
Persistence remains the existing ledger adapter. Production remains
disabled.

## Accounts status

**SANDBOX_FUNCTIONAL.** Customer accounts are Ledger-backed. Supported
sandbox currencies in the money scenario are USD and SAR. A customer
position still includes class breakdown beside the total. No yield or
growth-rate field.

## Payments status

**SANDBOX_FUNCTIONAL** for internal transfer and sandbox orchestration.
**PROVIDER_ADAPTER_REQUIRED** for live rails. External payment is a
provider-neutral contract with deterministic simulation adapters.
Crash/retry paths do not capture the Ledger before provider submission
and do not double-post on settlement replay.

## Beneficiaries status

**SANDBOX_FUNCTIONAL.** Recipients require `MANAGE_BENEFICIARY`. Agents
still cannot add or modify a beneficiary.

## FX status

**SANDBOX_FUNCTIONAL.** Quotes are server-owned simulation references
(`SIMULATION_REF_NOT_LIVE_MARKET`). Clients cannot choose rates.
USD→SAR uses the `US-SA-USD-SAR` corridor (customer rate 3745/1000 in
the existing simulation table). **PROVIDER_ADAPTER_REQUIRED** for a
live FX source. **REGULATORY_APPROVAL_REQUIRED** for live corridors.

## Cards status

**SANDBOX_FUNCTIONAL** for request/activate/freeze/unfreeze and
simulated authorize/capture/refund. **PROVIDER_ADAPTER_REQUIRED** and
**EXTERNAL_CERTIFICATION_REQUIRED** (processor, network, PCI boundary)
before any live issuing.

## Treasury status

**PRODUCTIZED_INTERNAL.** Flexible internal kinds cover operating,
customer-funds, settlement, clearing, provider prefunding, FX
liquidity, card settlement, fee, and suspense accounts. Configuration
does not imply legal ownership. Customer ownership of treasury books
remains forbidden.

## Settlement status

**SANDBOX_FUNCTIONAL.** Settlement records capture domain, provider,
currency, gross/fees/net, expected/actual dates, status, and
provider/Ledger references for payments, cards, FX, custody, and
Exchange. Not a second Exchange settlement engine.

## Reconciliation status

**SANDBOX_FUNCTIONAL.** Expected SunRey state is compared to provider
reported state. Conclusions: matched, unmatched, amount mismatch,
currency mismatch, missing internal, missing external, duplicate
external, timing difference, unknown. Breaks persist with OPEN /
INVESTIGATING / RESOLVED / ACCEPTED_TIMING_DIFFERENCE / ESCALATED.
Replay on identical inputs is deterministic. The Ledger is never
adjusted to force a pass.

## API/BFF status

**SANDBOX_FUNCTIONAL.** Consumer platform routes added for transfers,
recipients, payment quotes/submit/status, FX quote/accept/execute, and
cards list/issue/freeze/unfreeze. `services/api` remains orchestration
and must not become a second money plane.

## SDK/Lovable status

**SANDBOX_FUNCTIONAL.** Public consumer SDK methods cover the Phase C
money flows. Sandbox persona `fin-ready` seeds USD/SAR, deposit, and a
virtual card.

## Persistence status

**PRODUCTIZED_INTERNAL** for the in-memory control store plus
PostgreSQL snapshot `V030__treasury_financial_control.sql`. Parallel
Phase B collision `V029__platform_api.sql` is sequenced as
`V031__platform_api.sql` so customer migrations stay strictly
increasing. Durable fixture snapshots fail closed on corruption. Not a
second ledger.

## Security/authority status

Frontend cannot post Ledger entries or issue Execution Authority.
Frontend cannot choose exchange rates. Restricted transfers require
capabilities. Agent mutation still requires Execution Authority at the
ProposalGate/Kernel boundary. Simulation providers stay inert when
production flags are off. Provider callbacks cannot mint money without
verification. Balances originate from Ledger read models. Cross-user
quotes are refused.

## Test status

Executed in this environment:

- `npm test`: 3212 tests, 3211 pass, 0 fail, 1 skipped
- Phase C money E2E, crash/retry, SDK-only E2E, security, performance, and
  treasury financial-control tests: pass
- `npm run typecheck`: pass
- architecture lint, authority-map, kernel gating, OpenAPI, generated
  drift, secret scan, lockfiles, deployment posture, production safety,
  static-security-lint, container pins: pass
- `sunrey-release.mjs audit`: ok (first-party license_issue reports only;
  no known advisories)
- Rust `cargo fmt --check`, `clippy -D warnings`, and workspace tests:
  pass
- PostgreSQL `db:migrate` / `test:persistence`: not executed here (no
  Docker / `pg_isready`). Migration ordering check passed. Snapshot
  `V030__treasury_financial_control.sql` and sequenced
  `V031__platform_api.sql` are present.

## Performance baseline

See `docs/productization/PHASE_C_PERFORMANCE_BASELINE.md` and
`PHASE_C_PERFORMANCE_BASELINE.json`. Latest in-process sandbox samples
(not an SLA): balance-read median 0.003 ms (n=20); FX quote median
0.234 ms (n=20); reconciliation batch median 0.074 ms (n=10); transfer
median 0.314 ms (n=5).

## P0 blockers

None for sandbox Phase C completeness. Production remains disabled.

## P1 blockers

1. Live bank, card processor, and FX adapters are absent (Phase D).
2. Daily close is not a regulatory report.
3. Treasury kinds are configuration, not counsel-approved legal
   ownership.
4. Consumer webhooks still do not deliver off-box.
5. TOTP MFA and completed recovery remain unimplemented.
6. This environment did not apply PostgreSQL migrations; CI persistence
   job remains the empty-database apply path.

## Phase D provider requirements

- Licensed banking / payment-rail adapter behind the existing ports
- Card processor with PCI-sensitive PAN boundary outside this tree
- FX reference source with counsel-confirmed corridors
- Provider statement/balance/transaction fetch implementations of
  `ReconciliationProviderAdapter`
- Travel Rule / custody production-candidate binding remains fixture
  until certified

## External regulatory requirements

Country licensing, counsel confirmation (`CONFIRMED_BY_COUNSEL`),
corridor enablement, card-network sponsorship, and PCI assessment are
outside this repository. Unknown corridors stay `RESEARCH_REQUIRED`
and disabled. Kernel proofs remain the authority.

## Current production flags

`ENVIRONMENT=simulation`
`LIVE_* = false`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Capability classification

| Capability | Classification |
| --- | --- |
| Ledger | PRODUCTIZED_INTERNAL |
| Accounts / balances | SANDBOX_FUNCTIONAL |
| Internal transfer | SANDBOX_FUNCTIONAL |
| Beneficiaries | SANDBOX_FUNCTIONAL |
| External payment orchestration | SANDBOX_FUNCTIONAL |
| Live payment rail | PROVIDER_ADAPTER_REQUIRED |
| FX quote / USD→SAR | SANDBOX_FUNCTIONAL |
| Live FX | PROVIDER_ADAPTER_REQUIRED + REGULATORY_APPROVAL_REQUIRED |
| Cards lifecycle / sim auth-capture-refund | SANDBOX_FUNCTIONAL |
| Live card issuing | PROVIDER_ADAPTER_REQUIRED + EXTERNAL_CERTIFICATION_REQUIRED + REGULATORY_APPROVAL_REQUIRED |
| Treasury model | PRODUCTIZED_INTERNAL |
| Settlement records | SANDBOX_FUNCTIONAL |
| Reconciliation / breaks / replay | SANDBOX_FUNCTIONAL |
| Daily close | SANDBOX_FUNCTIONAL (not a regulatory report) |
| Consumer BFF / SDK | SANDBOX_FUNCTIONAL |
| Live banking connection | PROVIDER_ADAPTER_REQUIRED + REGULATORY_APPROVAL_REQUIRED |

Do not describe any of the above as production live.

## Recommendation for Phase D

`READY_FOR_PHASE_D=true`

Phase D may bind real provider adapters behind the existing contracts.
Phase D must not flip `PRODUCTION_READY`, `PRODUCTION_ACTIVE`, or
`LIVE_CONNECTIVITY_ENABLED` until independent go-live authorization
exists.
