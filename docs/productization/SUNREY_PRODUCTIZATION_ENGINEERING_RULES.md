# SunRey Productization Engineering Rules

Binding instructions for future Cursor Agents and human PRs that
productize SunRey. Companion to:

- `docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md`
- `docs/productization/sunrey-authority-map.json`
- `docs/architecture/constitution.md`
- `docs/architecture/manifest.json`
- `docs/architecture/SUNREY_ENGINEERING_CLOSURE.md`

This is not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Before adding a component

1. Search for the existing implementation in `packages/`, `services/`,
   `apps/`, and `docs/architecture/constitution.md`.
2. Read the canonical inventory if present
   (`docs/productization/SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md`).
   If it is absent, use the constitution, manifest, engineering
   closure, and the authority map.
3. Read `docs/productization/sunrey-authority-map.json` and the freeze
   document. Identify the single owner for the domain.
4. Extend the canonical component. Add files under that owner.
5. Avoid a parallel architecture. Do not create `*-v2` cores, a second
   ledger, a second Kernel, a second Agent runtime, a second Exchange,
   a second chain, or a second compliance plane.
6. Preserve authority boundaries in the freeze:
   - Ledger is the fiat / application journal.
   - SunRey Chain is protocol-native state.
   - AI proposes; it does not authorize.
   - Frontends display and submit; they do not keep books.
   - Providers adapt; they are not the system of record.
7. Write tests for the behavior and for the authority boundary you
   touched.
8. Update API / contracts if the public surface changed
   (`api/`, `packages/sunrey-sdk`, relevant OpenAPI).
9. Update documentation: constitution / chunk notes only when
   ownership or a reserved path changes; productization docs when a
   domain or deprecation state changes.
10. Keep production gates closed unless the task explicitly concerns
    authorized production activation. Do not set
    `PRODUCTION_READY=true`, `PRODUCTION_ACTIVE=true`, or
    `LIVE_CONNECTIVITY_ENABLED=true`. Do not change `ENVIRONMENT` or
    any `LIVE_*` flag.

## Required interaction patterns

Regulated mutation:

`CLIENT → API/BFF → authentication → validation → domain service →
Kernel → compliance/risk → approval where required → Execution
Authority → execution → Ledger/Chain → Evidence → Events`

Agent action:

`USER → SUNREY AGENT → AI MODEL GATEWAY → AGENT TOOL → structured
proposal → policy/risk → user approval when required → Execution
Authority → domain service → Ledger/Chain → Evidence`

A model response is never authorization.

Exchange:

`CLIENT → Exchange API → identity/eligibility → compliance → order
validation → matching → fills → clearing/settlement → custody →
Ledger/Chain → reconciliation → evidence`

## Provider adapters

Implement SunRey interfaces. Do not rewrite domain logic around a
vendor API. Lifecycle vocabulary is:

`SIMULATED`, `SANDBOX`, `CERTIFICATION`, `PREPRODUCTION`,
`LIMITED_LIVE`, `PRODUCTION`

Do not implement a new universal provider runtime unless that is the
explicit task. Do not promote an adapter to `PRODUCTION` here.

## Deprecation

Do not add a new dependency on a DEPRECATED path without an explicit
exception recorded per the freeze (section 18). Prefer
ACTIVE_CANONICAL, then ACTIVE_SPECIALIZED.

## When to stop

If the task requires a protected capability that is not `IMPLEMENTED`
on `main` (`docs/architecture/chunk-dependencies.md`), stop. Do not
reimplement Money, ActionIntent, the Compliance Kernel, Execution
Authority, the Evidence Vault, the ledger, or the account-class
taxonomy.
