# Phase H Prompt 2 — Consent, permissions, data rights, and access governance

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

This record productizes the control plane for how Personal Data Vault
information may be used. It does not authorize production, flip
`LIVE_*` flags, or mark any privacy rule `CONFIRMED_BY_COUNSEL`.

Phase H Prompt 1 does not have a productization record on `main`. The
canonical Personal Data Vault is already `IMPLEMENTED` at
`packages/personal-data-vault`. This prompt extends that store's
consent port rather than replacing the vault.

## Owner

Canonical owner: `packages/consent`.

Authoritative engine: `packages/consent/src/product/engine.ts`
(`ConsentDataRightsEngine`).

Ledger and Purpose Firewall remain `packages/consent/src/service.ts`
and `packages/consent/src/firewall.ts`.

Orchestration: `services/api/src/consumer/data-rights.ts`.

Do not create `packages/consent-v2`, `packages/purpose-firewall`,
`packages/data-rights`, or a second permissions / Kernel / ledger.

`packages/permissions` stays ActionIntent / Execution Authority.
HIN marketplace grants stay in `packages/information-market` and are
bridged by explicit HIN participation on this engine.

## Consent scope model

A grant is never a single global checkbox. Backend scope is:

- **who** — recipient / licensee class
- **may use** — operations (`READ`, `DERIVE`, `AGGREGATE`, `EXPORT`, `CONTRIBUTE`, `SHARE`)
- **what data** — named Personal Data Vault categories
- **for what purpose** — versioned product purpose + ledger purpose version
- **for how long** — finite `expiresAt`
- **under what terms** — `termsVersion`
- **whether it may be revoked** — `revocable` (core-service disclosures are not optional opt-outs)

Statuses: `ACTIVE`, `REVOKED`, `EXPIRED`, `SUPERSEDED`, `SUSPENDED`.

Necessity classes exposed to Lovable:

- `REQUIRED_FOR_CORE_SERVICE`
- `OPTIONAL`
- `OPTIONAL_COMPENSATED`

There is no default that silently opts a customer into monetization.
Personalization, aggregated research, and economic licensing are
separate purposes. One does not imply another.

UX bundles such as "Allow SunRey Agent to use my spending data" expand
to granular categories and a purpose. The backend stores the granular
scope.

## Revocation

Revocation immediately:

- blocks new optional access decisions
- invalidates downstream licensee grants for that purpose
- updates Agent access for agent-assistance grants
- restricts HIN eligibility when a HIN/licensing grant is withdrawn
- emits internal notifications

It does **not** erase historical processing that must be retained.
`historicalProcessingErased` is always `false`.

## Access decision

`mayAccessData(actor, subject, category, record, purpose, requestedOperation)`
returns `ALLOW`, `DENY`, `REQUIRE_CONSENT`, or `REQUIRE_REVIEW`.

It evaluates ownership, role, purpose, consent, classification,
jurisdiction, retention, license, Agent mandate, and service necessity.

Agent mandate and data consent are independent. An Agent may have
`READ_FINANCIAL_STATE` / `ANALYZE_SPENDING` and still lack optional
vault consent for a sensitive category. Both must pass.

Third-party licensees never receive unrestricted database access.
Licenses are scoped by dataset, purpose, time window, query limit,
privacy requirements, and revocation.

## HIN participation

States: `NOT_ENROLLED`, `ENROLLED`, `PAUSED`, `WITHDRAWN`, `RESTRICTED`.

Default is `NOT_ENROLLED`. Enrollment is an explicit optional grant.
Withdrawing optional HIN participation does not close ordinary SunRey
financial services (`financialServicesRemainOpen: true`).

## Rights-request workflow

Configurable types: `ACCESS`, `EXPORT`, `CORRECTION`, `DELETION`,
`RESTRICTION`, `OBJECTION`, `CONSENT_WITHDRAWAL`.

Not every right is treated as universally applicable. Jurisdiction
packs decide applicability. Unknown packs accept access / export /
withdrawal and hold other types for review.

States: `SUBMITTED`, `IDENTITY_VERIFICATION_REQUIRED`, `IN_REVIEW`,
`APPROVED`, `PARTIALLY_APPROVED`, `DENIED`, `PROCESSING`, `COMPLETED`.

## BFF / Lovable

Client-safe routes under `/api/v1/data/*` and `/api/v1/hin/participation*`.
SDK: `packages/sunrey-sdk/src/consumer-bff`.
OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`.

Screens: DATA PERMISSIONS, WHO CAN USE MY DATA, WHAT SUNREY USES,
AGENT ACCESS, HIN PARTICIPATION, ECONOMIC DATA SHARING, CONSENT
HISTORY, ACCESS HISTORY, DOWNLOAD MY DATA, DELETE / CORRECT / RESTRICT.

## Production

Simulation only. No live bank, FX, or payment provider. No counsel
confirmation of privacy-law mappings.
