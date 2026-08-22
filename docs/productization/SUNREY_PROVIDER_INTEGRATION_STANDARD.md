# SunRey provider integration standard

How a future vendor adapter is added. This is not production
authorization and not a certification.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## 1. Do not create a new provider package

Canonical owner: `packages/sunrey-chain/src/provider-runtime`.

Domain contracts stay where they already live:

| Category | Contract | Owner |
| --- | --- | --- |
| Payments / rails | `RailAdapter` | `packages/payments/src/rail-port.ts` |
| FX | `FxLiquidityProvider` | `packages/payments/src/fx-provider.ts` |
| Identity / KYC / KYB | `IdentityProviderPorts` | `packages/identity/src/ports.ts` |
| AML / sanctions | `ComplianceProviderPorts` | `packages/kernel/src/compliance/ports.ts` |
| Custody | custody provider-candidate | `packages/custody` |
| Cards | cards service + webhook ingest | `packages/cards` |

Implement the existing interface. Do not invent a parallel port.

## 2. Register the adapter with the runtime

```ts
import {
  createUniversalProviderRuntime,
  createCredentialRef,
} from '@solstice/sunrey-chain/src/provider-runtime/universal';

const runtime = createUniversalProviderRuntime();
const credential = createCredentialRef({
  providerId: 'vendor-payments',
  secretHref: 'secret://vault/vendor-payments/api',
  keyVersion: '1',
  environment: 'SANDBOX',
});

runtime.register({
  providerId: 'vendor-payments',
  providerType: 'PAYMENTS',
  displayName: 'Vendor payments sandbox',
  adapterId: 'vendor-payments-v1',
  capabilities: ['PAYMENT.ACH', 'PAYMENT.WIRE'],
  environment: 'SANDBOX',
  credentialReference: credential.ok ? credential.value : null,
  webhookConfiguration: {
    verificationAdapterId: 'vendor-payments-webhook',
    replayWindowMs: 300_000,
    environment: 'SANDBOX',
    persistRawEvidence: true,
  },
  enabledJurisdictions: ['US'],
  supportedCurrencies: ['USD'],
  supportedProducts: ['send'],
  nowUtc: new Date().toISOString(),
});
```

Credentials are references. Never put API keys, PAN, or private keys
on the registration record.

## 3. Walk the lifecycle on the server

Allowed productization path:

`DISABLED` → `SIMULATED` → `SANDBOX` (configuration complete) →
`CERTIFICATION` (test suite ready) → `PREPRODUCTION` (certification
evidence) → `LIMITED_LIVE` / `PRODUCTION` (human authorization plus
live flags, both currently closed).

An HTTP request, Agent proposal, frontend, or env var cannot casually
move a provider to live production.

## 4. Pass the contract harness

```ts
import { runProviderContractHarness, harnessPassed } from
  '@solstice/sunrey-chain/src/provider-runtime/universal';

const results = runProviderContractHarness({
  providerId: 'vendor-payments',
  providerType: 'PAYMENTS',
  capabilities: ['PAYMENT.ACH'],
  environment: 'SANDBOX',
  adapterId: 'vendor-payments-v1',
});
if (!harnessPassed(results)) {
  throw new Error('adapter contract failed');
}
```

The harness covers configuration, capability declaration, timeouts,
normalized errors, idempotency/retry, health, webhook verification,
observability, and environment isolation.

Domain-specific rail/FX/KYC suites are later Phase D prompts.

## 5. Webhook path

HTTP callback → identify provider → retrieve verification adapter →
verify signature → verify timestamp / replay → persist redacted
evidence → normalize event → idempotency → async workflow token.

The handler must not post a Ledger journal or issue Execution
Authority.

## 6. Certification distinction

Passing unit tests yields `INTERNAL_ADAPTER_TESTED` only.
`EXTERNAL_PROVIDER_CERTIFIED` requires an approval identity, timestamp,
and evidence references. Do not claim a vendor is certified without
that record.

## 7. Production remains off

Do not flip `LIVE_*`, `ENVIRONMENT`, `PRODUCTION_READY`,
`PRODUCTION_ACTIVE`, or `LIVE_CONNECTIVITY_ENABLED`.
Do not connect a real bank or payment provider from this standard.
