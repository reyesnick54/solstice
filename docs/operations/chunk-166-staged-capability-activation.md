# Chunk 166 — Staged Capability Activation Plan

Owner: `packages/sunrey-chain/src/post-genesis/staged-activation`.

This chunk extends capability `sunrey-post-genesis-stabilization`.
It does not create a second activation owner.

SunRey launch is not designed as "turn everything on." Every
product/domain is independently gated and may remain disabled
indefinitely.

## Sequence

```
Authorized Genesis Candidate
        ↓
Consensus Stabilization
        ↓
Read-Only Public Surfaces
        ↓
Native Asset Base Functionality
        ↓
Independent Economic Capabilities
        ↓
Independent Regulated Capabilities
```

Conceptual rehearsal stages:

1. `STAGE_0_GENESIS_AND_CONSENSUS`
2. `STAGE_1_READ_ONLY_PUBLIC_SURFACES`
3. `STAGE_2_NATIVE_ASSET_BASE`
4. `STAGE_3_ECONOMIC_EVIDENCE_READ_ONLY`
5. `STAGE_4_CUSTODY_CANDIDATE`
6. `STAGE_5_EXCHANGE_CANDIDATE`
7. `STAGE_6_GOVERNED_NATIVE_ISSUANCE`
8. `STAGE_7_REGULATED_FINANCIAL_SERVICES`
9. `STAGE_8_HIN_AND_PRODUCTIVE_MARKETS`

This is a conceptual rehearsal plan. It does not assert that every
domain must eventually activate.

## Independent domains

Mainnet `ActivationDomain` values are reused. Chunk 143 economic
activation domains are consumed where issuance or productive evidence
must be gated separately:

- `SUNREY_CHAIN`
- `SUNREY_COIN_NATIVE_ASSET` / `MOONREY_COIN_NATIVE_ASSET`
- `SUNREY_COIN_ISSUANCE` / `MOONREY_COIN_ISSUANCE`
- `SUNREY_EXCHANGE` / `INSTITUTIONAL_CUSTODY`
- `FIAT_BANKING` / `PAYMENT_RAILS` / `CARDS` / `INVESTMENTS`
- `HUMAN_INFORMATION_MARKET` / `PRODUCTIVE_CAPACITY_MARKET`
- `INTEROPERABILITY`

Domains are not collapsed into one boolean.

## Chain first, read-only first

No dependent product is activation-eligible before validator quorum,
finality, state-root agreement, RPC, persistence/recovery, security
monitoring, and operator acceptance pass.

Read-only public RPC/explorer/SDK rehearsal does not activate
issuance, Exchange, custody, or payments.

Native-asset existence in protocol is not post-genesis issuance.
SunRey issuance and MoonRey issuance have separate readiness
decisions.

## Canary

`CapabilityCanaryPlan` is rehearsal-only. Fixture population,
operations, duration, and checkpoints are `REHEARSAL_ONLY`. There is
no real-customer canary and no real-money limit. Production
transaction, issuance, user-count, quantity, and volume limits stay
`UNCONFIGURED` and are not invented.

## Pause

`pauseCandidate(domain)` narrows a capability. It cannot mint, reverse
history, change parameters, or create human approval.

## What this chunk does not do

- It does not flip `LIVE_*` flags or `ENVIRONMENT`.
- It does not enable mainnet.
- It does not activate production.
- It does not let the control room or AI advance a stage.
- It does not repair `AssetSupplyBook` by overwrite.
- It does not treat Exchange activation as fiat banking activation.
- It does not let raw oracle feeds mint MoonRey.
- It does not treat an HIN chain anchor as legal authority.

## Demo

```
npm run demo:sunrey-staged-activation
```

Expected markers:

```
ALL_AT_ONCE_ACTIVATION=false
READ_ONLY_EQUALS_FINANCIAL_ACTIVATION=false
SUNREY_ISSUANCE_INDEPENDENT=true
MOONREY_ISSUANCE_INDEPENDENT=true
DOMAIN_FAILURE_MINIMALLY_SCOPED=true
CANARY_REAL_CUSTOMERS=false
AI_CAN_ADVANCE_STAGE=false
LIVE_FLAGS_ENABLED=false
PRODUCTION_ACTIVE=false
```
