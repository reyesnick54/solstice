# Chunk 12 resume (Chunk 12R)

Chunk 12 originally stopped because the protected `cards` capability
was absent. Cards has since been implemented at `packages/cards` and
`services/cards`. This document records the resumed implementation.

This is **simulation architecture only**. Solstice does not claim
Apple Wallet, Google Wallet, card-network tokenization, SoftPOS /
Tap-to-Pay, acquirer, PCI, or regulatory approval.

## Boundary

| Flow | Owner | Not |
| --- | --- | --- |
| Customer adds a Solstice card to a mobile wallet | `packages/cards` wallet module | A second card platform |
| Merchant accepts contactless payment on a phone | `packages/cards` acceptance module | EMV/NFC kernels, wallet provisioning |

Both modules extend the canonical Cards context. They do not create a
second card entity, processor abstraction, network-token registry,
hold system, ledger, or Money primitive.

## Consumer wallet

Provider-neutral `WalletProvisioningPort` with simulated adapters:

- `SimulatedAppleWalletAdapter` (`APPLE_WALLET`)
- `SimulatedGoogleWalletAdapter` (`GOOGLE_WALLET`)

`DevicePaymentToken` binds one Identity `DeviceId` and one card.
Statuses: `REQUESTED` → `PENDING_VERIFICATION` → `ACTIVE` →
`SUSPENDED` / `DEACTIVATED` / `DELETED`.

Local eligibility (`ELIGIBLE` / `STEP_UP_REQUIRED` / `REVIEW` /
`INELIGIBLE`) must succeed before a provider adapter is called.
Provisioning uses `PROVISION_CARD_TO_WALLET` on the existing
`ActionIntent` envelope. Wallet adapters cannot issue Execution
Authority.

Card freeze remains authoritative: an `ACTIVE` wallet token cannot
authorize when the underlying card is `FROZEN`.

Lost / blocked devices emit `IdentityDeviceTrustChanged`. Wallet
orchestration consumes that event and suspends tokens. Identity does
not write Cards tables.

## Merchant SoftPOS / Tap-to-Pay

Separate merchant, acceptance-device, and short-lived session model.
Provider-neutral `TapToPayAcceptanceProvider` with a deterministic
simulation adapter only.

Approved simulated acceptance creates a pending merchant settlement.
Settlement posts through `Ledger.postJournal` via the Cards journal
path, using explicit acquiring clearing / provider / fee books. No
unexplained plug account. Issuing and acquiring books are not mixed
without a disclosed class bridge.

Reconciliation outcomes: `MATCHED` / `PENDING` / `MISMATCH` /
`INVESTIGATION_REQUIRED`. The ledger is never auto-repaired.

## Sensitive data

Opaque processor / network-token / provider references only. No PAN,
CVV, PIN, track data, tokenized PAN, EMV/contactless card data, or
provider backend secrets.
