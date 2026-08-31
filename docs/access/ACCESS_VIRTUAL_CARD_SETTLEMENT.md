# ACCESS Virtual Card Settlement

ACCESS Wave 3 / Prompt 36 — Restricted virtual-card payment rail for settling
with conventional merchants that do not integrate directly with SunRey and do
not accept SunRey Coin (SR) or MoonRey Coin (MR).

## Why virtual cards exist

Many Access providers (lodging, mobility, experiences) operate on conventional
card networks. A restricted virtual card lets SunRey settle in fiat on the
merchant's existing checkout rail while preserving Access funding controls,
merchant restrictions, and reconciliation back to the Access transaction.

```
Access transaction approved
        ↓
Provider amount determined
        ↓
Funding assembled (Access Pool + user fiat)
        ↓
Restricted virtual card created
        ↓
Merchant charges conventional card rail
        ↓
Merchant receives fiat
        ↓
SunRey reconciles transaction
```

## Provider abstraction

The Access domain does **not** hard-code a single card issuer. Settlement uses:

| Component | Location | Role |
|-----------|----------|------|
| `AccessPaymentRail` | `packages/access-economy/src/settlement/types.ts` | Canonical rail port |
| `RestrictedVirtualCardAccessRail` | `packages/access-economy/src/settlement/restricted-virtual-card-rail.ts` | Rail implementation |
| `RestrictedCardIssuerPort` | `packages/access-economy/src/settlement/issuer-port.ts` | Issuer adapter contract |
| `MockRestrictedCardIssuer` | `settlement/adapters/mock-restricted-card-issuer.ts` | In-memory simulation |
| `SandboxRestrictedCardIssuer` | `settlement/adapters/sandbox-restricted-card-issuer.ts` | `SimulatedProductionCardIssuer` wrapper |
| `ProductionRestrictedCardIssuerShell` | `settlement/adapters/production-restricted-card-issuer.ts` | `BLOCKED_PENDING_PROVIDER` shell |

Card issuing infrastructure reuses the canonical `packages/cards` owner. Access
does not create a shadow card platform.

## Card controls

`AccessCardControls` maps Access settlement policy to issuer-supported controls:

- **maximum amount** — exact service amount by default (`DEFAULT_ACCESS_CARD_BUFFER_POLICY`)
- **single transaction / single use** — one card per Access transaction where practical
- **expiration** — bounded to transaction lifecycle
- **merchant ID / allowed merchant** — merchant-locked cards preferred
- **MCC** — category-aligned allow lists (`ACCESS_CATEGORY_MCC_MAPPINGS`)
- **country / currency** — geographic and currency restrictions

Only controls declared in `IssuerControlSupport` are claimed. Unsupported
controls are not advertised.

## Spending limits

For a $400 provider transaction the card limit is **$400** (40,000 minor units)
unless an explicit, versioned buffer policy applies (`ACCESS_CARD_BUFFER_POLICY_VERSION`).

Buffer policy is opt-in. The default is zero buffer.

## Deposits and incidentals

**Launch model:**

- Access virtual card: **service amount only**
- User's own approved payment instrument: security deposit / incidentals

If a provider requires a deposit on the same card and architecture cannot
separate it, the transaction is flagged
`UNSUPPORTED_ACCESS_PAYMENT_CONFIGURATION`. Security-deposit authorization
attempts on an Access card are declined with `SECURITY_DEPOSIT_NOT_FUNDED`.

Access treasury is not exposed to uncontrolled incidentals.

## PCI boundary

- No raw PAN, CVV, PIN, or track data in Access records, logs, or fixtures
- Internal records use `cardId`, `providerCardId`, `last4`, and `status`
- `assertNoSensitiveCardData` guards webhook and card payloads
- Consumer app does not receive Access virtual-card PAN/CVV (server-controlled settlement)

## Authorization lifecycle

Normalized lifecycle events:

| Event | Meaning |
|-------|---------|
| `CARD_CREATED` | Restricted card issued and active |
| `AUTHORIZATION_PENDING` | Auth request received |
| `AUTHORIZATION_APPROVED` | Auth within controls |
| `AUTHORIZATION_DECLINED` | Violates controls or policy |
| `CAPTURED` | Settlement capture completed |
| `REVERSED` | Authorization voided |
| `REFUNDED` | Capture refunded |
| `CARD_DISABLED` | Card closed (single-use, compromise, etc.) |

On authorization, the rail verifies: `settlementId`, merchant, amount, currency,
card status, and controls. Over-authorization above the configured maximum is
declined. Incremental authorizations track aggregate authorized amount.

## Issuer webhooks

`AccessVirtualCardWebhookIngestor` uses the existing `ProviderWebhookGuard`
signature-verification infrastructure from `packages/security`. Unsigned or
invalid events are rejected. Duplicate deliveries are detected via idempotency
keys.

## Reconciliation

`AccessSettlementReconciliationStore` maintains the trace chain:

```
AccessTransaction ↔ AccessSettlement ↔ VirtualCard ↔ Authorization ↔ Capture
```

`AccessSettlementOrchestrator` coordinates funding verification, card
issuance, authorization, capture, and reconciliation. It does not post ledger
journals or issue Execution Authority.

## Funding

Virtual-card spending requires a confirmed `AccessFundingReservation` covering
Access Pool contribution plus user fiat contribution **before** the card becomes
usable. Unfunded cards are not issued.

Virtual cards are funded in **fiat only**. `tokenConversionContributionMinorUnits`
must be zero. SR/MR card loading is forbidden (`TOKEN_FUNDING_FORBIDDEN`).

## Production requirements

Production status is **honestly blocked** until all of the following are satisfied:

- Signed card-issuing provider agreement
- PCI DSS assessment for the issuing boundary
- Commercial terms and production credentials
- Webhook endpoint verification and fraud monitoring
- Operational runbook

Until then, `ProductionRestrictedCardIssuerShell` returns
`BLOCKED_PENDING_PROVIDER` / `PROVIDER_BLOCKED`. Sandbox uses
`SIMULATED_CARD_PROCESSOR`. Do not fabricate production readiness.

## Module entry point

```typescript
import { AccessSettlement } from '@solstice/access-economy';

const orchestrator = AccessSettlement.createAccessSettlementOrchestrator({
  mode: 'sandbox',
  fundingVerifier,
});
```

## Related documentation

- `docs/access/ACCESS_DOMAIN_ARCHITECTURE.md` — Access domain model
- `docs/access/ACCESS_FUNDING_AND_SOLVENCY.md` — funding reservations
- `docs/productization/PHASE_C_05_CARDS.md` — canonical card platform
