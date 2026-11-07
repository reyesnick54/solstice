# Broker Conformance Report (EXEC02 / EXEC14)

## Normalized broker protocol (EXEC02)

`HeliosProviderOrderPort` defines submit, cancel, poll, and webhook ingestion with provider-neutral fill events. Order lifecycle maps provider outcomes to canonical `HeliosOrderStatus` values without a second ledger.

## Conformance and certification (EXEC14)

Venue and broker adapter conformance lives at `packages/platform/src/helios/execution-routing/venue-conformance/`. Certification states progress `REGISTERED` → `SANDBOX_CONFORMANCE` → `ENGINEERING_QUALIFIED` in simulation only.

## Evidence collected

- Idempotent operation identity (`operationIdFor`)
- Illegal transition rejection in lifecycle coordinator
- Sandbox-only environments enforced at submit (`LIVE_*` compile-time false)
- Drop-copy dedupe via provider fill identifiers

## Not in scope

Live FIX sessions, production drop-copy feeds, or executed broker agreements.
