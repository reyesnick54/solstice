# Provider Risk Monitor

Date: 2026-08-30  
Wave: 4 / Prompt 17  
Status: **Implemented (simulation)**

## Purpose

The Provider Risk Monitor analyzes the health and security posture of SunRey's
external provider ecosystem. It reasons across multiple risk dimensions — not
just uptime.

## Architecture

```
Provider health telemetry
Provider error rates
TLS/HTTP security observations
Service outage intelligence
Authentication failures
Schema changes
Data integrity anomalies
Circuit breaker state
Catalog verification status
        ↓
ProviderRiskMonitor.assess()
        ↓
ProviderRiskScore (explainable factors)
        ↓
ProviderRiskState
        ↓
Quarantine recommendation (provider-level only)
        ↓
Existing disable/kill-switch mechanism
```

Location: `packages/external-data/src/wave4/provider-risk-monitor.ts`

## Risk states

| State | Meaning |
| --- | --- |
| `NORMAL` | Operating within bounds |
| `DEGRADED` | Elevated risk, still usable with caution |
| `SUSPICIOUS` | Security or integrity concerns — quarantine recommended |
| `COMPROMISED_SUSPECTED` | Severe anomaly pattern |
| `DISABLED` | Provider disabled or quarantined |
| `UNKNOWN` | Insufficient data |

## Risk dimensions

- **availability** — downtime, rate limits, circuit breaker
- **security** — TLS/certificate issues, posture degradation
- **data_integrity** — schema changes, malformed payloads, outliers
- **credential** — authentication failures
- **licensing_governance** — catalog verification gaps

## Provider risk score

Explainable internal score (0–100) with per-factor contributions retained
for audit. Not opaque.

## Quarantine

When quarantined:

- No new live requests to that provider
- Cached data subject to freshness policy
- Fallback providers may operate
- Health status reflects quarantine
- Operators can inspect reason
- Historical evidence retained

Quarantine does **not** shut down SunRey core, Money, Exchange, or blockchain.

## Recovery

Controlled recovery path:

```
SUSPICIOUS → QUARANTINED → safe probes → validation → HEALTHY → reactivate
```

A single successful request after security quarantine is insufficient for
immediate restoration.

## Events

Internal events (via `wave4/events.ts`):

- `PROVIDER_SECURITY_DEGRADED`
- `PROVIDER_QUARANTINED`
- `PROVIDER_RECOVERED`
- `PROVIDER_SCHEMA_ANOMALY`
- `PROVIDER_CREDENTIAL_FAILURE`
- `THREAT_INTELLIGENCE_MATCH`

User-safe events (no CVE internals or provider architecture details):

- `SECURITY_ACTION_REQUIRED`
- `SERVICE_DEGRADED`
- `SUSPICIOUS_LOGIN_REVIEW`
- `IDENTITY_REVIEW_REQUIRED`

## Operations

See also:

- `docs/providers/PROVIDER_OPERATIONS.md`
- `docs/providers/provider-failure-handling.md`
- `docs/runbooks/sre/kyc-compliance-provider-outage.md`
