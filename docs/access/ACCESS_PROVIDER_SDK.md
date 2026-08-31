# SunRey Access Provider SDK — ACCESS Wave 2

Classification: engineering simulation on current `main`.

## Overview

ACCESS Wave 2 introduces the canonical **Access Provider SDK** under
`packages/access-economy/src/providers/sdk/`. It extends the SunRey
provider-sdk lifecycle pattern (`initialize`, `healthCheck`, `getCapabilities`,
`shutdown`) with Access-specific segmented contracts.

```
SunRey provider-sdk (external-data plane)
        ↓ pattern reuse
Access Provider SDK (access-economy/providers/sdk)
        ↓
Access-specific provider contracts
```

The SDK does **not** duplicate the external-data `ProviderRegistry` in
`packages/provider-sdk`. Access commercial and discovery providers are owned by
`packages/access-economy`.

## Core contracts

| Contract | File | Purpose |
| --- | --- | --- |
| `AccessProvider` | `sdk/contract.ts` | Base lifecycle contract |
| `AccessProviderDescriptor` | `sdk/descriptor.ts` | Metadata (no secrets) |
| `AccessInventoryProvider` | `sdk/interfaces.ts` | Search, availability, inventory |
| `AccessQuoteProvider` | `sdk/interfaces.ts` | Firm quotes (no settlement) |
| `AccessFulfillmentProvider` | `sdk/interfaces.ts` | Reserve, book, cancel, status |
| `AccessRefundProvider` | `sdk/interfaces.ts` | Provider-side refund interaction |
| `AccessSettlementProvider` | `sdk/interfaces.ts` | **Interface only** — Wave 3 |
| `AccessCapacityContributor` | `sdk/interfaces.ts` | Capacity publication (no MR settlement) |

## Domain types

| Type | Purpose |
| --- | --- |
| `AccessProduct` | Canonical provider product |
| `AccessOpportunity` | Discovery search result |
| `AccessCapacity` | Approved trusted capacity |
| `AccessCapacityCandidate` | Pending capacity contribution |

## Registry and discovery

`AccessProviderRegistry` (`sdk/registry.ts`) supports:

- `register()` / `unregister()` / `get()` / `list()`
- `listByCategory()` / `listByCapability()` / `listByGeography()`
- `listProductionEnabled()` / `listDiscoveryProviders()` / `listFulfillmentProviders()`
- `listCapacityContributors()` / `findProviders()` / `getHealth()`

`AccessDiscoveryService` (`sdk/discovery-service.ts`) composes registry
resolution with deterministic selection and safe discovery fallback.

Bootstrap all providers:

```typescript
import { bootstrapAccessProviderSdk } from '@solstice/access-economy/providers';

const world = bootstrapAccessProviderSdk();
const result = await world.discovery.search({
  requestId: 'search_1',
  category: 'TRAVEL',
  query: 'flight miami jfk',
  geography: 'Miami, FL',
  limit: 5,
});
```

## Provider selection

`selectProvider()` (`sdk/selection.ts`) is deterministic. Factors:

- Activation state
- Capability and category match
- Geography
- Health
- Contract and credential readiness
- Commercial priority and trust score
- User/provider preference

Selection reason is always stored.

## Fallback rules

| Operation | Fallback |
| --- | --- |
| Discovery search | Allowed when semantically safe |
| Booking | **Not** allowed on unknown state |
| Unknown booking | Reconciliation required first |

See `sdk/fallback.ts` and `sdk/reconciliation.ts`.

## Capacity approval

External capacity contributions flow:

```
Provider contribution → AccessCapacityCandidate → policy validation → AccessCapacity
```

No automatic capacity inflation. See `sdk/capacity-approval.ts`.

## Risk and operations

- `AccessProviderRiskMonitor` — quarantine blocks new bookings; existing state reconcilable
- `AccessProviderOperations` — enable, disable, quarantine, inspect

## Webhooks

- `AccessProviderWebhookNormalizer` — signature verification required for production
- `AccessProviderEventIdStore` — idempotent event handling

## Security

- No secrets in descriptors, logs, or BFF
- Provider IDs are controlled (`PROVIDER_IDS` in `types.ts`)
- `FUTURE_NATIVE_MR` settlement model is never production-enabled
- No payment settlement, virtual cards, or SR/MR conversion in Wave 2

## Bridge from ACCESS-14

Legacy monolithic `AccessProvider` adapters (ACCESS-14) are bridged via
`sdk/bridge.ts` to segmented SDK contracts without breaking existing gateway
behavior.

## Tests

`packages/access-economy/src/providers/sdk/access-wave-2.test.ts`
