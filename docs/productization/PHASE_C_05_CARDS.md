# Phase C Prompt 5 — Cards, spending controls, and digital wallet provisioning

Productizes SunRey's provider-independent card platform. This is not a
card network, not live issuing, and not Apple Pay / Google Pay
certification.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.
`PRODUCTION_READY=false`. `PRODUCTION_ACTIVE=false`.

Phase C Prompts 1–4 are not recorded as documents in this tree. This
prompt extends the canonical cards owner that already existed after
Phase B.

## 1. Card domain

Canonical owner: `packages/cards` (`CardsService`).
Application facade: `services/cards` (`ConsumerCardsFacade`, hold gateway).
Consumer BFF: `services/api` `/api/v1/cards*`.

Card resource (PCI-minimized):

| Field | Notes |
| --- | --- |
| `cardId` | Application identifier |
| `owner` / `customerId` | Subject |
| `fundingAccount` | Ledger-backed demand deposit |
| `type` | `DEBIT` only |
| `form` | `VIRTUAL` \| `PHYSICAL` |
| `status` | See lifecycle |
| `providerReference` | Synthetic `sim_tok_*` |
| `last4` | Provider-supplied display digits only (`0000` in simulation) |
| `expiry` | Month/year only (`12/2099` in simulation) |
| `walletProvisioningStatus` | Provider-neutral wallet state |
| `controls` | Server-owned spending controls |
| `createdAt` | UTC |

A Card never owns a balance. Available funds are read from the
canonical banking position (ledger − holds).

## 2. PCI minimization

- No PAN, CVV/CVC, PIN, track, EMV, or magstripe fields.
- `assertNoSensitiveCardData` rejects those keys on persist/transport.
- `retrieveSensitiveDetails` always returns `PCI_BOUNDARY`.
- Evidence and events store ids, amounts, and reason codes — not secrets.
- Simulation tokens are invalid outside tests (`sim_tok_`, `sim_ntok_`).

## 3. Provider abstraction

`CardProcessor` (`packages/cards/src/processor.ts`):

`createCardholder`, `issueVirtualCard`, `issuePhysicalCard`,
`activateCard`, `freezeCard`, `unfreezeCard`, `replaceCard`,
`closeCard`, `setControls`, `retrieveSensitiveDetails`,
`provisionWallet`, `getTransactionStatus`, plus the existing callback
normalization methods.

Adapters must not post journals, create holds, or issue Execution
Authority. No vendor SDK is implemented here.

## 4. Lifecycle

`REQUESTED → PENDING → ACTIVE ⇄ FROZEN/SUSPENDED → REPLACED|CLOSED|EXPIRED`

User actions request a change. Kernel ALLOW + verified Execution
Authority + provider confirmation determine the authoritative result.

Simulated issue outcomes (encoded in `cardId` for determinism):

- default → success (`PENDING`, then activate)
- `_pending_` → `REQUESTED`
- `_fail_` → `ISSUE_FAILED`

## 5. Authorization flow

```text
Signed provider webhook / callback
  → Phase B ProviderWebhookGuard or processor HMAC
  → CardAuthorizationRequest
  → AUTHORIZE_CARD_PURCHASE → Compliance Kernel / fraud
  → card status, available funds, spending controls, program
  → CREATE_HOLD via BankingOperationsService
  → processor-compatible decision
```

Declines include insufficient funds, frozen/restricted card, MCC,
country, international, ecommerce, ATM, contactless, amount, and
velocity. Cross-currency is refused (`CURRENCY_NOT_SUPPORTED`).

## 6. Ledger integration

Approved authorization → canonical hold.
Capture (`CLEARING` / `CAPTURE`) → hold capture + settlement journal,
or partial capture (release remainder + direct settlement).
Reversal → hold release.
Refund → compensating journal.
Duplicate capture is idempotent. Capture above authorized amount
beyond program tolerance is rejected. No overdraft: available funds
must cover the authorization.

## 7. Controls

Server-enforced: frozen, online/ecommerce, international, cash/ATM,
contactless, MCC allow/block, country allow/block, per-transaction
limit, daily limit. UI cannot override.

## 8. Apple / Google wallet readiness

Provider-neutral statuses: `NOT_ELIGIBLE`, `ELIGIBLE`, `PROVISIONING`,
`ACTIVE`, `FAILED`, `SUSPENDED`.

Existing Chunk 12 wallet module (`WalletService`, simulated Apple/Google
adapters) remains the provisioning owner. This prompt adds the consumer
status vocabulary and BFF eligibility/status read.

`certification: NOT_CERTIFIED`. `productionReady: false`.

### External certification (Phase D+)

Apple Wallet / Apple Pay:

- Apple developer / payment-network tokenization agreement
- In-app and/or push provisioning entitlement
- PCI DSS assessment of the issuer/processor PAN boundary
- Device-binding and yellow-path ID&V with the issuer

Google Wallet / Google Pay:

- Google Pay issuer console and token requestor onboarding
- Network tokenization (MDES / VTS or equivalent) via the processor
- Push provisioning and Android device attestation

SunRey will not implement EMV kernels, NFC cryptography, or store
wallet provider backend secrets in the mobile client.

## 9. API / BFF / SDK

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/cards` | List |
| POST | `/api/v1/cards` | Simulated issue (virtual auto-activates) |
| GET | `/api/v1/cards/:id` | Detail + available + activity + wallet |
| POST | `/api/v1/cards/:id/freeze` | Step-up |
| POST | `/api/v1/cards/:id/unfreeze` | Step-up |
| PATCH | `/api/v1/cards/:id/controls` | Step-up |
| GET | `/api/v1/cards/:id/wallet` | Eligibility/status |
| POST | `/api/v1/webhooks/cards` | Phase B webhook verification |

Home/bootstrap include cards capability (`AVAILABLE_SIMULATION`) and
Home.cards summary. Lovable must not require PAN/CVV for the dashboard.

TypeScript SDK (`@solstice/sunrey-sdk/consumer`) adds `listCards`,
`getCard`, `issueCard`, `freezeCard`, `unfreezeCard`,
`patchCardControls`, `getCardWallet`.

Sandbox persona `basic_verified` is issued a simulated virtual card
`card_sandbox_basic_virtual` last4 `0000`.

## 10. Phase D card-provider requirements

- BIN sponsorship / issuing-bank agreement
- Processor sandbox then certification then limited-live
- Webhook mTLS + signed envelopes on the Phase B guard
- PAN vault remains outside SunRey application code
- Scheme rules for incremental/overcapture
- Travel Rule / sanctions already via Kernel — do not duplicate
- Do not flip `LIVE_*` or `ENVIRONMENT` in this tree

## 11. What this prompt does not claim

- Live card issuing
- Card-network membership
- PCI DSS certification
- Apple Pay / Google Pay certification
- Production activation

`SAFE_TO_PROCEED_TO_PHASE_C_PROMPT_6` is recorded in the PR summary
after validation.
