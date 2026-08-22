# SunRey compliance provider onboarding checklist

Use this checklist before any KYC, KYB, sanctions, PEP, adverse-media,
AML, fraud, or Travel Rule vendor is bound to production. Completing a
row is not production authorization.

`LIVE_EXTERNAL_KYC` stays `false` until a later, separately authorized
activation.

## 1. Commercial and legal

- [ ] Data processing agreement executed
- [ ] Privacy review completed (purpose limitation, minimization, residency)
- [ ] Sub-processor list reviewed
- [ ] Jurisdictional coverage documented (and gaps marked `RESEARCH_REQUIRED`)
- [ ] Regulatory signoff by counsel (no agent or model may satisfy this)
- [ ] Incident-handling and breach-notification terms accepted

## 2. Engineering sandbox

- [ ] Sandbox credentials bound through the Chunk 149 credential plane
- [ ] Provider registered on Chunk 91 Provider Runtime (`SANDBOX` only)
- [ ] Webhook signature, timestamp window, and replay protection verified
- [ ] Duplicate webhook delivery is idempotent
- [ ] Unverified webhooks cannot change verified identity state
- [ ] Sandbox `VERIFIED` results are labeled non-production

## 3. Certification

- [ ] KYC suite: start, pending, verified, failed, expired, webhook duplicate
- [ ] Sanctions suite: no match, possible match, confirmed/review, unavailable
- [ ] AML suite: submit signal, alert, case creation, duplicate event
- [ ] Travel Rule suite: applicable, not applicable, pending, complete, failed
- [ ] Provider-unavailable fail-closed behavior proven
- [ ] Certification record stored; adapter success is not legal approval

## 4. Data retention and privacy

- [ ] Retention configuration agreed (reference-only default)
- [ ] Document images stay in approved secure storage / provider systems
- [ ] No KYC documents in application logs
- [ ] No full identity payloads in generic events
- [ ] Access controls and encryption reviewed
- [ ] Subject-access / deletion procedure mapped to Personal Data Vault

## 5. Ongoing monitoring

- [ ] Sanctions-list update job policy defined
- [ ] PEP / KYC expiry / business-status / wallet-risk triggers defined
- [ ] Continuous expensive rescreening is off unless policy allows
- [ ] Phase B jobs/events used; jobs cannot issue Execution Authority

## 6. Manual review integration

- [ ] Findings that require humans open canonical compliance cases
- [ ] Vendor case systems are not SunRey authority
- [ ] AI / S3M / Grok cannot finalize a case
- [ ] Hard sanctions blocks remain non-overridable except by recorded policy

## 7. Product activation (later)

- [ ] Exchange / custody eligibility still owned by those packages
- [ ] Kernel remains the decision layer
- [ ] `PRODUCTION` lifecycle not selected here
- [ ] `LIVE_EXTERNAL_KYC` remains `false` until authorized activation
