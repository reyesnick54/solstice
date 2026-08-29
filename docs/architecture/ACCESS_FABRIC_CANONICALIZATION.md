# SunRey Access Fabric Canonicalization

Status: merged architecture repair candidate
Scope: ACCESS-01 through ACCESS-12 integration cleanup

## Canonical bounded context

`packages/access-economy` is the canonical Human Access Economy domain owner. It owns the stable domain vocabulary and lifecycle primitives for AccessIntent, AccessRight, AccessEntitlement, PersonalAccessEnvelope, CapacityOffer, CapacityWindow, CapacityReservation, AccessQuote, AllocationPolicy, AllocationDecision, ExperienceBundle, UsageEvent, UsageProof, and DeliveryClaim.

The following packages are implementation modules beneath that bounded context, not competing authorities:

- `packages/access-fabric` — entitlement evaluation, policy eligibility, reservation lifecycle, holds, waitlists, and settlement-intent handoff.
- `packages/sunrey-access` — deterministic scarcity evaluation, quote methodology, and allocation mechanism selection.
- `packages/sunrey-access-fabric` — productive-capacity discovery plus composite experience composition/orchestration.
- `packages/human-access-economy` — consumer-facing simulation/product projection adapter used by the Consumer BFF. It is not a second domain authority and must delegate canonical economic decisions to the modules above as integration matures.
- `packages/sunrey-chain/src/access` — canonical SunRey Blockchain commitments for non-ownership access rights, reservations, usage, delivery, and settlement evidence.
- `packages/sunrey-chain/src/access-fabric` — chain-side completion/evidence workflow adapter. It must remain subordinate to `packages/sunrey-chain` as chain authority.
- `packages/sunrey-exchange/src/access-fabric` — productive-capacity market discovery, offers, RFQ, auctions, queues, clearing, refunds, and policy gating. It remains subordinate to `packages/sunrey-exchange` as Exchange authority.

## Authority rules

The Access Fabric never becomes a second Ledger, Exchange, custody system, Compliance Kernel, Execution Authority, oracle network, monetary issuance authority, Productive Economy, Personal Economic Graph, or blockchain.

Canonical economic flow:

Human intent -> Personal Economic Graph / Personal Economy Agent -> AccessIntent -> Access Economy domain -> entitlement and policy evaluation -> productive-capacity discovery -> scarcity/allocation -> capacity reservation -> Compliance Kernel / Execution Authority where consequential -> SunRey Exchange / canonical settlement rails -> SunRey Chain access commitment -> usage/delivery evidence.

## Consumer BFF rule

`/api/v1/access/*` remains the only application-facing Access API. The BFF may project and orchestrate state, but it does not own capacity truth, pricing truth, reservation authority, settlement balances, or blockchain state.

The `packages/human-access-economy` surface is explicitly a frontend-safe adapter. Simulation fixtures are permitted only while `ENVIRONMENT=simulation`; missing canonical state must return unavailable/disabled rather than fabricated live values.

## Naming and migration rule

Do not create additional top-level Access packages. Existing implementation modules remain in place until imports can be migrated without breaking tests or architecture boundaries. New Access work should use `packages/access-economy` as the domain vocabulary and extend the existing specialized modules instead of creating another peer package.

## Permanent safety invariants

- no Access Coin
- no human-worth or social-credit score
- no automatic SunRey Coin issuance
- no automatic MoonRey Coin issuance
- no fixed SunRey/MoonRey peg
- no raw sensitive personal information on-chain
- no productive capacity created by a query
- no capacity overselling
- no AI self-approval
- no reservation confirmation without required authority
- no second balance ledger inside Exchange or Access
- no simulation path may activate production

## ACCESS-13 qualification note

The original ACCESS-13 work was built on an older ACCESS-04 branch and therefore cannot be merged onto current `main` without reconciling later ACCESS-05 through ACCESS-12 changes. Its scenario and invariant work should be ported onto current `main` as a fresh qualification commit rather than force-merging the stale branch and risking loss of newer Access code.
