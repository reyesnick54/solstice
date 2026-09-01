# ADR-0029 — SunRey Blockchain interoperability model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0026, ADR-0031, ADR-0033
- Implementation status: IMPLEMENTED (development light-client gateway; production interoperability not implemented)

## Context

Bridges are a leading theft mechanism in public chains. SunRey also
cannot silently wrap fiat or duplicate the canonical ledger on a
foreign chain.

## Decision

1. Production interoperability is **not** enabled. No live bridge or
   wrapped-fiat token exists. Chunk 50 implements a *development*
   light-client / IBC-class gateway inside `packages/sunrey-chain`.
2. Engineering direction remains: explicit light-client or IBC-class
   clients with fail-closed timeouts, never an implicit trusted
   multisig "lock and mint" as the root trust model.
3. Fiat, payments, and securities never become wrapped chain assets
   without a later authority-matrix change and counsel review.
4. Foreign chain events are oracle-class facts (ADR-0027) until a
   dedicated interoperability module exists.
5. Network IDs (ADR-0033) make cross-network replay invalid.
6. No interoperability claim (decentralized, trustless, or
   regulator-approved) is made.

## Alternatives considered

- **Lock-and-mint multisig bridge now.**
- **Copy Ethereum assets via wrapped ERC-20.**
- **Treat SunRey Exchange deposits as a bridge.**

## Why rejected

- Multisig bridges are high-theft, high-trust, and would look like
  a second custodian without the custody control plane.
- Wrapped ERC-20 imports EVM tokens and tickers.
- Exchange deposits are Kernel-gated ledger journals plus custody
  operations, not a chain bridge.

## Security implications

A future bridge is a TCB expansion. Until then, any "foreign
finality" is untrusted.

## Compliance implications

Cross-chain transfers can be money transmission, Travel Rule events,
or sanctions-evasion paths. `RESEARCH_REQUIRED`.

## Operability implications

None today. Later relayers would be isolated processes without
validator keys.

## Migration implications

None.

## Unresolved questions

- Whether IBC-class clients are appropriate for a sovereign
  economic object model.
- How Travel Rule applies to native-asset movement (Chunk 30R is
  exchange/custody simulation only).

## Status

`ACCEPTED_FOR_ENGINEERING` for "no wrapped fiat; no trusted-multisig
bridge." Development interoperability: **implemented** (Chunk 50).
Production interoperability: **not implemented**. Legal confidence:
`RESEARCH_REQUIRED`.

## Production activation control (Wave 2 Prompt 6)

Runtime gates in `packages/config/src/flags.ts` and
`packages/config/src/activation-gates.ts`:

| Control | Default | Notes |
| --- | --- | --- |
| `LIVE_INTEROP_ENABLED` | `false` | No production bridge |
| `LIVE_INTEROP_RELAYERS_ENABLED` | `false` | Relayers isolated; cannot govern or vote |
| `LIVE_INTEROP_WATCHERS_ENABLED` | `false` | No production watchers |
| `LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED` | `false` | Foreign chain events are oracle-class only |
| Interop signing keys | unavailable for production | `PRODUCTION_HSM_KMS_CONFIGURED=false` |
| `ENVIRONMENT` | `simulation` | Test/development cannot flip production interop |

`packages/sunrey-chain/src/interop/activation-guard.ts` calls
`assertInteropDevelopmentOnly()` before chain registration or activation.
`InteropSecurityProfile.productionReady` is typed `false`.
Wrapped fiat and production native assets are refused at runtime.
