# Access Consumer Protection

> **Disclaimer:** This document describes software architecture and control points only.
> Final legal, accounting, tax, consumer-protection, and regulatory treatment must be
> reviewed and approved by qualified professionals and applicable regulated partners
> before production launch.

## Disclosure framework

`AccessDisclosure` records support:

- `disclosureId`, `version`, `jurisdiction`, `category`
- `effectiveFrom`, `requiredAcknowledgement`
- `displayContentReference` (content lives outside business logic)
- `status` (`DRAFT` / `ACTIVE` / `RETIRED`)

Disclosure types include:

- `ACCESS_NON_CASH_RIGHT`
- `CAPACITY_LIMITATION`
- `FUNDING_AVAILABILITY`
- `PROVIDER_TERMS`
- `QUOTE_EXPIRATION`
- `SECURITY_DEPOSIT`
- `INCIDENTALS`
- `CANCELLATION_POLICY`
- `REFUND_POLICY`
- `ACCESS_EXPIRATION`
- `PROVIDER_AVAILABILITY`
- `USER_COPAY`
- `NO_TOKEN_REDEMPTION`
- `SERVICE_PROVIDER_RELATIONSHIP`
- `PRICE_COMPONENTS`

Implementation: `packages/access-economy/src/regulatory-controls/disclosure.ts`

## Disclosure versioning

Every acknowledgment records `disclosureId`, `version`, `timestamp`, `userId`, and
`transactionId` where applicable. Material term changes create new versions; old
transactions retain their original disclosure version.

## Checkout disclosures

Before Access purchase confirmation, the backend returns applicable disclosure
requirements via `resolveCheckoutDisclosures()`. The frontend does not determine
which disclosures apply.

BFF projection: `packages/human-access-economy/src/consumer-regulatory.ts`

Example disclosures at checkout:

- Access covers $300; you pay $100
- Provider may require a separate refundable deposit
- Provider cancellation policy applies
- Access is a non-cash program right with no guaranteed fiat redemption value

## Price transparency

All price components remain visible:

| Component | Field |
|-----------|-------|
| Base price | `basePriceMinorUnits` |
| Tax | `taxMinorUnits` |
| Mandatory fees | `mandatoryFeesMinorUnits` |
| Optional fees | `optionalFeesMinorUnits` |
| Deposit | `depositMinorUnits` |
| Access coverage | `accessCoverageMinorUnits` |
| User contribution | `userContributionMinorUnits` |
| Access service fee | `accessServiceFeeMinorUnits` (default zero) |
| Provider total | `providerTotalMinorUnits` |

Mandatory fees must not be hidden inside Access coverage.

## Provider terms

Provider-specific cancellation, refund, fees, taxes, incidentals, security deposit,
and fulfillment requirements are preserved. User acknowledgment does not erase
provider obligations or consumer rights.

## Refund transparency

Distinct refund states — never conflate pending with completed:

| State | Meaning |
|-------|---------|
| `PROVIDER_REFUND_PENDING` | Awaiting provider refund |
| `PROVIDER_REFUND_RECEIVED` | Provider refund received |
| `USER_REFUND_PENDING` | User refund in progress |
| `USER_REFUNDED` | User refund completed |
| `ACCESS_POOL_RESTORED` | Access funding pool restored |
| `ENTITLEMENT_RESTORED` | Entitlement units restored |

Do not display "Refunded" when only provider refund is pending.

## Cancellation transparency

Before cancellation confirmation, expose:

- Provider penalty (if known)
- Estimated refundable amount
- Estimated Access restoration (if deterministically known)
- User refund impact

Unconfirmed amounts are marked estimated/pending. No refund guarantees are invented.

## Terminology audit

Consumer surfaces should use:

- "Access covers" (not "cash value")
- "Available Access" (not "balance")
- "Access entitlement" (not "token redemption")
- "Access allocation" (not "guaranteed value")
- "Access contribution" (not "1 MR = $X")

## Dispute boundary

Dispute categories are separated:

- `PROVIDER_DISPUTE`
- `PAYMENT_DISPUTE`
- `ACCESS_ENTITLEMENT_DISPUTE`
- `REFUND_DISPUTE`

Access disputes may reference the canonical underlying payment dispute.

## Access service fees

Configurable fee representation exists with default zero. Fees must be explicit
and must not be buried in exchange rates or Access coverage.

## Items requiring external approval

- Final disclosure prose and jurisdiction-specific variants
- Required acknowledgment UX patterns
- Refund timeline representations
- Cancellation penalty disclosure requirements by jurisdiction
- Provider terms presentation format
