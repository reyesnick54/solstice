# Cybersecurity Intelligence Providers

Date: 2026-08-30  
Wave: 4 / Prompt 17  
Status: **Simulation adapters implemented**

## Purpose

Wave 4 cybersecurity intelligence extends the SunRey external-data plane with
vulnerability, threat, endpoint security, and service-outage observations.
These are **evidence inputs only** — they do not authorize execution, modify
balances, or bypass the Compliance Kernel.

## Integrated providers

| Provider | Category | Capabilities | Adapter |
| --- | --- | --- | --- |
| NVD | cybersecurity | vulnerability_intelligence, cve_lookup | fixture |
| URLhaus | cybersecurity | malicious_url, malware | fixture |
| Mozilla HTTP Observatory | cybersecurity | http_security | fixture |
| Mozilla TLS Observatory | cybersecurity | tls_security | fixture |
| PhishStats | cybersecurity | phishing, malicious_url | fixture |
| Virushee | cybersecurity | malware | fixture |
| Cloudflare Trace | cybersecurity | domain_security | fixture |
| OutageDeck | cybersecurity | outage_monitoring | fixture |
| DownStatus | cybersecurity | outage_monitoring | fixture |

All adapters use deterministic fixtures — no live HTTP in CI.

## Canonical models

### VulnerabilityObservation

CVE intelligence from NVD. Not a duplicate canonical CVE registry.

Fields: `cveId`, `description`, `publishedAt`, `modifiedAt`, `severity`,
`cvssVersion`, `cvssScore`, `vector`, `affectedProducts`, `references`,
`providerId`, `retrievedAt`, `freshness`, `provenance`.

### DependencyVulnerabilityMapping

Maps CVE observations to SunRey software dependencies with explicit exposure
status distinctions:

- `CVE_EXISTS` — CVE published, no dependency link
- `DEPENDENCY_POTENTIALLY_AFFECTED` — name match, version unconfirmed
- `CONFIRMED_VULNERABLE` — dependency version within affected range
- `NOT_AFFECTED` / `UNKNOWN`

### ThreatIndicator

Types: `MALICIOUS_URL`, `PHISHING_URL`, `MALWARE_URL`, `MALICIOUS_DOMAIN`,
`SUSPICIOUS_IP`.

Source payloads are **untrusted**. Malicious URLs are never auto-fetched.
Display strings are sanitized via `safe-url.ts`.

### EndpointSecurityObservation

TLS and HTTP security scans for SunRey-owned and approved provider endpoints.
Not an unrestricted public scanning proxy.

### ServiceIncidentObservation

External outage intelligence supplements — does **not** override direct health
checks.

## Services

- `VulnerabilityIntelligenceService`
- `ThreatIntelligenceService`
- `EndpointSecurityService`
- `ServiceOutageService`

## Security controls

- No automatic malicious URL fetching
- No active links in operational surfaces without sanitization
- No API keys in logs or health surfaces
- External data treated as untrusted
- TLS verification enabled on live transports (simulation uses fixtures)
- Response size limits enforced by provider-sdk transport

## Compliance Kernel boundary

Cybersecurity observations are evidence. The Kernel remains authoritative
for all compliance and execution decisions.

## Related

- `docs/providers/PROVIDER_RISK_MONITOR.md`
- `docs/providers/WAVE_4_COMPLETION_REPORT.md`
- `packages/external-data/src/wave4/`
