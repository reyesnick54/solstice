# Chunk 12 stop record

This file is the Chunk 12 completion report. It records a
**constitutional stop**, not an implementation.

Task: Mobile Wallet Provisioning, Network Token Lifecycle, Apple Pay /
Google Wallet Adapter Architecture, and Tap-to-Pay / SoftPOS Acceptance
Foundation.

Instruction on the task: start from latest clean `main` after Chunk 11
is merged. If a protected dependency is absent, **stop**. Do not build
a second cards domain. Do not implement wallet cryptography manually.

The machine-enforceable rule is in
[`chunk-dependencies.md`](./chunk-dependencies.md): if a required
**protected** capability is not `IMPLEMENTED` on `main`, the agent
must stop rather than reimplement that subsystem.

---

## A. Baseline

Inspected HEAD: `c313bec` —
`feat(payments): add FX and cross-border payment orchestration (#28)`.

Latest `origin/main` is the same commit. There is no later cards merge.

Workspace inventory on this tip:

- Packages: `money`, `domain`, `permissions`, `security`, `identity`,
  `kernel`, `ledger`, `evidence`, `events`, `config`, `persistence`,
  `payments`.
- Services: `accounts`, `identity`, `compliance`.
- No `packages/cards`. No `services/cards`. No `*card*` source files.
- No `DevicePaymentToken`, network-token metadata, processor adapter,
  wallet provider port, or SoftPOS/acceptance model.

Constitution and manifest both list CARDS as **PLANNED**, reserved at
`packages/cards` and `services/cards`. Capability `cards` is
`PLANNED`, owner `packages/cards`.

Required-capability evaluation for the Chunk 12 declaration
(`docs/architecture/chunks/chunk-12-mobile-wallet-and-tap-to-pay.json`):

| Capability | Status on `main` |
| --- | --- |
| architecture-linting, money, domain, permissions, kernel, ledger, evidence, events, event-fabric, config, persistence, security, identity, policy-engine, accounts-service, banking-core, compliance-screening, payments, fx | IMPLEMENTED |
| **cards** | **PLANNED — missing** |

`evaluateChunkRequirements` returns `mustStop: true` because `cards`
is protected and not `IMPLEMENTED`.

A concurrent cloud agent named "Canonical card platform"
(`bc-7a66f155-4cd2-4961-9f62-831ebbc5addb`) was running at inspection
time. It had no branch and no merged PR. Concurrent work is not
canonical until it lands on `main` as `IMPLEMENTED`.

### Required pre-coding inspections

1. **Constitution** — `docs/architecture/constitution.md`. CARDS is
   reserved PLANNED. Agent stop rule applies.
2. **Manifest** — `docs/architecture/manifest.json`. Capability
   `cards` is PLANNED. Bounded context CARDS reserved paths are
   `packages/cards`, `services/cards`.
3. **Cards implementation** — **absent**. No package, no service, no
   card object model, no card program, no card lifecycle.
4. **Processor adapter** — **absent**. Payments has FX / corridor /
   settlement simulation ports only. Those are not card-network
   processor adapters.
5. **Security KeyProvider / SecretProvider** — present in
   `packages/security`. `KeyProvider` signs, verifies, encrypts, and
   rotates by purpose. `SecretReference` / `SecretProvider` hold
   `secret://` references, not plaintext production credentials.
   Business code must not import the simulation key provider.
6. **Identity device trust** — present in `packages/identity`.
   `DEVICE_TRUST_STATES`: `KNOWN`, `TRUSTED`, `REVIEW_REQUIRED`,
   `BLOCKED`. `IdentityService.setDeviceTrust` can block a device and
   revoke its sessions. Identity does not mutate foreign aggregates.
7. **Authentication assurance** — present.
   `LOW` / `STANDARD` / `STRONG` / `HIGH_ASSURANCE`. Passkey + step-up
   yields `HIGH_ASSURANCE`. Fraud evaluation already consumes
   session assurance and can return `STEP_UP`.
8. **Card fraud rules** — **absent**. Canonical fraud
   (`packages/kernel/src/compliance/fraud.ts`) is
   payment/identity/device/velocity based. It has no card-authorization,
   token-provisioning, or merchant-acceptance rules.
9. **Provider callback security** — **absent for cards/wallets**.
   Identity has WebAuthn assertion replay protection. Payments has
   intent-id idempotency. There is no signed, timestamped, replay-
   protected card-network or wallet-provider callback fabric.
10. **Network-token metadata** — **absent**. Zero matches for
    network-token / `DevicePaymentToken` / token requestor.
11. **Policy packs** — US/GB/EU/SA/AE simulation shells exist. No
    pack declares `MOBILE_WALLET_PROVISIONING` or
    `MOBILE_PAYMENT_ACCEPTANCE`. Legal-entity capabilities are
    deposit-banking / cross-border / digital-custody simulation
    seeds. No rule is `CONFIRMED_BY_COUNSEL`.
12. **Persistence / events / evidence** — PostgreSQL adapter and
    four bounded databases exist. Event fabric, Evidence Vault, and
    outbox/inbox are IMPLEMENTED. There are no wallet-token,
    acceptance-session, or merchant-settlement card tables.
13. **Full CI on clean `main`** — passed. See section V.

The only card-adjacent symbol on `main` is the hold-purpose tag
`CARD_AUTHORIZATION` in `packages/domain/src/hold.ts`, explicitly
documented as a later-chunk tag. It does not execute cards.

---

## B. Wallet architecture

Not implemented. A wallet/tokenization module must live inside the
canonical Cards context (or the manifest-assigned Cards boundary)
once that owner exists. Creating `packages/wallet`,
`packages/tokenization`, or a parallel card object would be a second
cards domain.

## C. Provider adapters

Not implemented. `SimulatedAppleWalletAdapter` /
`SimulatedGoogleWalletAdapter` require a provider-neutral issuer-side
wallet port owned by Cards. No Apple or Google certification is
claimed or obtained.

## D. DevicePaymentToken model

Not implemented. One card may have zero or more device-payment
tokens. That relation cannot be created without the card aggregate.

## E. Eligibility

Not implemented. Local eligibility must read card state, card
program, and card fraud posture from Cards. Those inputs do not
exist.

## F. Step-up

Not implemented for wallet provisioning. Canonical Identity
assurance and Kernel/fraud `STEP_UP` exist and should be reused
later. No generic bypass was added.

## G. Device binding

Not implemented. Identity `DeviceId` exists and is the correct
binding target. A token for Device A must not become active on
Device B. That rule cannot be enforced without a token aggregate.

## H. Token lifecycle

Not implemented. Canonical statuses
`REQUESTED` / `PENDING_VERIFICATION` / `ACTIVE` / `SUSPENDED` /
`DEACTIVATED` / `DELETED` were not added outside Cards.

## I. Security boundaries

Documented for the future implementation; not instantiated.

Intended trust zones (unchanged by this stop):

1. Solstice application / backend
2. Wallet / token / processor provider
3. Mobile device / platform

Provider signing secrets must never sit in mobile client
configuration. Backend provider API credentials must never be
exposed to an app. `SecretReference` is the existing configuration
shape.

## J. Wallet events / evidence

Not implemented. Future events must use the existing
`VersionedEvent` envelope and must not carry PAN, tokenized PAN, or
provider secrets. Evidence must continue to seal through
`EvidenceVault`.

## K. Tap-to-Pay architecture

Not implemented. Merchant contactless acceptance is a different flow
from consumer wallet provisioning. It still depends on Cards /
acquiring hooks that are not on `main`. Solstice must not implement
NFC, EMV kernels, or contactless cryptography.

## L. Merchant model

Not implemented. Identity already has `BusinessIdentity`. That is
not a merchant acquiring platform and was not extended here.

## M. Acceptance device / session

Not implemented.

## N. Provider port

Not implemented. No `TapToPayAcceptanceProvider` / `SoftPosProvider`.

## O. Merchant settlement accounting

Not implemented. Canonical ledger, pending-settlement, fees, and
payment reconciliation exist and must be reused later. Issuing
ledgers and merchant settlement books must not be commingled without
an explicit class bridge.

## P. Reconciliation

Not implemented for acceptance. Payments reconciliation
(`reconcilePayment`) is the pattern: mismatch → investigation; no
auto-correction.

## Q. Persistence

No new tables, databases, or adapters. Canonical PostgreSQL remains
the durable adapter. A future Cards owner may add card-bounded
migrations; this chunk did not.

## R. Architecture guards

Added a machine-readable Chunk 12 declaration and a linter test that
`CHUNK-12` `mustStop`s while `cards` is `PLANNED`. No wallet/SoftPOS
violation guards were added because those modules do not exist.

Representative violations that a later implementation must still
reject:

- raw PAN in a wallet domain
- private provider key in application config
- mobile client given a provider backend secret
- token callback without verification
- wallet token created without a card relationship
- token transferred between devices
- custom contactless / EMV cryptography
- acceptance provider posting directly to the ledger
- merchant credit without the canonical settlement path

## S. Demonstrations

Not implemented. The existing Phase 1 / Chunk 8 / Chunk 9 demos
remain the only runners.

## T. Tests

Added one constitution test:

`CHUNK-12 must stop until the protected cards capability is IMPLEMENTED`

It loads the Chunk 12 declaration and asserts `mustStop === true`
and `missing` includes `cards`. Existing card, banking, payment,
compliance, identity, persistence, and event tests were not changed.

## U. Exact results

Stopped. No `packages/cards`, no wallet module, no SoftPOS module,
no new ActionType, no new LIVE flag, no new ledger mutator.

## V. Exact CI

Baseline on clean `main` at `c313bec` (`npm run ci`):

```
architectural invariants: ok
extraction dry-run: ok (12 package(s))
architectural-linter: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (22 registered paths, all Kernel-authorized)
tests: 236 pass, 0 fail
demo: ok
typecheck: ok
secret scan: ok
CI pipeline: ok
```

Post-change CI on this branch (`npm run ci`):

```
architectural invariants: ok
extraction dry-run: ok (12 package(s))
architectural-linter: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (22 registered paths, all Kernel-authorized)
tests: 237 pass, 0 fail
  including: CHUNK-12 must stop until the protected cards capability is IMPLEMENTED
demo: ok
typecheck: ok
secret scan: ok
CI pipeline: ok
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

## W. Limitations

- Cannot provision a card into a wallet because there is no card.
- Cannot bind a device-payment token because there is no token
  model and no card-to-token relation.
- Cannot accept contactless payments because there is no merchant
  acceptance / SoftPOS owner and no certified provider boundary.
- Cannot reuse a card processor callback security layer; it does
  not exist yet.
- Network-token metadata is not a separate capability in the
  manifest; it is part of the reserved Cards context.

## X. External approvals / integrations still required

None obtained. None claimed. Still required before any live path:

- Card-network issuing / processing approval
- Network tokenization approval
- Apple Wallet / Apple Pay certification
- Google Wallet certification
- Acquirer / SoftPOS / Tap-to-Pay certification
- PCI certification
- Counsel-confirmed jurisdiction policy
- Live regulatory permission

Simulation adapters, when later written, emulate contracts only.

## Y. Intentionally unimplemented

Everything in Sections A–B of the Chunk 12 task:

- Wallet provider types and ports
- DevicePaymentToken and lifecycle
- Wallet eligibility and `PROVISION_CARD_TO_WALLET`
- Step-up wallet flow
- Network token service port
- Token assurance, device binding, revocation, lost-device, freeze
- Token callbacks, events, evidence, persistence, demo
- SoftPOS / Tap-to-Pay model, merchant, device, session, payment
- Acceptance fraud, callbacks, settlement, reconciliation, demo
- Mobile API contracts, policy flags, architecture guards for
  wallet/SoftPOS code
- Treasury / routing optimization
- Personal Economy Agent work

Also not implemented: a competing Cards owner. Creating
`packages/cards` while the manifest still says `PLANNED` would be
legal only if this chunk also became the first Cards owner. The
task forbids that: "Do not build a second cards domain" and
"Start from latest clean main after Chunk 11 is merged."

## Z. Whether the exit criterion passed

**No.** The Chunk 12 exit criterion requires a wallet architecture,
DevicePaymentToken lifecycle, SoftPOS abstraction, merchant
settlement, and full CI of those features. Those features were not
built because the protected Cards dependency is not `IMPLEMENTED`.

The **stop rule** passed: the agent did not reimplement Cards,
Money, ActionIntent, the Kernel, Execution Authority, the Evidence
Vault, the ledger, or the account-class taxonomy.

## AA. Recommendation for Chunk 13

Do not start Chunk 12 implementation, treasury/routing
optimization, or Personal Economy Agent work.

Recommended sequence:

1. Finish and merge Chunk 10/11 (canonical Cards: card object,
   program, lifecycle, processor adapter, network-token metadata,
   card fraud, provider callback security) onto `main`.
2. Flip capability `cards` and bounded context CARDS to
   `IMPLEMENTED` or `PARTIAL` with a real owner at
   `packages/cards` / `services/cards`.
3. Re-run `evaluateChunkRequirements` for CHUNK-12. `mustStop`
   must become `false`.
4. Only then implement Chunk 12 **inside** that Cards boundary:
   wallet/tokenization as a Cards module; Tap-to-Pay / SoftPOS as
   a separate acceptance module that reuses Identity, Kernel,
   ledger, payments settlement, events, and evidence.
5. Keep consumer wallet provisioning and merchant acceptance
   architecturally separate.
6. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag `false`.
7. Do not claim Apple, Google, network, acquirer, PCI, or
   regulatory approval.

Chunk 13 should not be scoped until Chunk 12 can start from an
`IMPLEMENTED` Cards owner.
