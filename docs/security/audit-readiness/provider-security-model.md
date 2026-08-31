# Provider security model

Owners: `packages/provider-sdk`, `packages/security/src/regulated`

## Outbound HTTP (SSRF)

All provider transports use `packages/provider-sdk/src/ssrf.ts`:

- Approved hostname/port/scheme only
- Blocks loopback, RFC1918, link-local, metadata hosts
- Blocks `file:`, `javascript:`, `data:` schemes
- Redirect targets re-validated (`transport.test.ts`)

## Inbound webhooks

`packages/security/src/regulated/webhook.ts` — signature, timestamp, replay window.

## Credentials

- `SecretReference` (`secret://`) only in configuration
- Redaction catalog for logs (`provider-sdk/redaction.ts`)
- No live connectivity (`LIVE_*` false)

## Certification endpoints

Oracle certification sandbox: fixture transports, conformance gates only.

## Evidence

```
npm test -- packages/provider-sdk/src/transport.test.ts
npm test -- packages/sunrey-sdk/src/developer-platform.test.ts
npm test -- tests/wave-6-prompt-17-security-assurance.test.ts
```
