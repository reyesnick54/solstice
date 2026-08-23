# Phase H Prompt 1 — Personal Data Vault

Canonical owner: `packages/personal-data-vault`.

The Personal Data Vault **is** the Personal Data Fabric. Do not create
`packages/personal-data-fabric`, `packages/data-fabric`, or a second
subject store. Economic-oracle fabrics in `packages/sunrey-chain` are
unrelated productive-economy feeds.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`

Live data monetization and live native-asset issuance stay disabled.

## Vault architecture

| Layer | Path | Role |
| --- | --- | --- |
| Canonical store | `packages/personal-data-vault/src/service.ts` | Encrypted ingest, version, derive, export, delete |
| Product facade | `packages/personal-data-vault/src/product/service.ts` | Typed Vault Data Record, categories, correction, export jobs |
| Persistence | `packages/persistence/src/personal-data-vault` + `db/customer/migrations/V019` / `V039` | PostgreSQL metadata and ciphertext envelopes |
| Consumer BFF | `services/api/src/consumer/vault.ts` | Lovable-safe `/api/v1/data/vault*` |
| Agent tool | `packages/sunrey-agent` `getVaultRecords` | Required purpose + category or record ids. No wildcard |

## Data model

Schema `sunrey.vault.data-record.v1` fields include `dataRecordId`,
`ownerSubjectId`, `dataCategory`, `dataType`, `dataKind`,
`schemaVersion`, `source`, `sourceReference`, `provenance`, timestamps,
`verificationState`, `confidence`, `classification`, `retentionPolicy`,
`consentReference`, `purposeRestrictions`, `accessPolicy`,
`integrityHash`, `status`, and distinct ownership roles.

Kinds (separated):

- `RAW_DATA`
- `NORMALIZED_DATA`
- `DERIVED_DATA`
- `AI_INFERENCE`
- `USER_DECLARATION`
- `VERIFIED_FACT`

AI inference cannot be marked `VERIFIED`.

## Categories

Version `sunrey.vault.category-registry.v1`. Sandbox-ingestible:

financial, education, employment, skills, professional_activity,
consumption, attention_time, creative_contribution, social_contribution,
goals_preferences.

Present but **not ingested by default** (schema support is not collection
authority): mobility_location, communications_metadata, digital_activity,
health_wellness, biometric, genetic, identity_attribute.

Each category declares classification, allowed purposes, retention
default, shareability, Agent-access eligibility, economic-rights
eligibility, and legal/review requirements. Speculative categories are
not production-available.

## Classification

`PUBLIC`, `USER_PROVIDED`, `PERSONAL`, `FINANCIAL_SENSITIVE`,
`IDENTITY_SENSITIVE`, `HEALTH_SENSITIVE`, `BIOMETRIC_SENSITIVE`,
`GENETIC_SENSITIVE`, `CONFIDENTIAL`, `SECRET`.

These are engineering classes, not GDPR/CCPA/PDPL/HIPAA categories.

## Provenance

Every record carries origin, provider/source, collection method,
timestamps, verification, transformation history, parent record ids,
integrity hash, and license/rights refs. Derived records point at
inputs. Versioning writes a new version; provenance is not silently
overwritten. Historical versions stay separate from current user-facing
state.

## Ownership

Roles: data subject, SunRey as `SUNREY_SERVICE` controller (does **not**
own the data), data source, rights holder, optional licensee. The model
does not say “SunRey owns all user data.”

## Storage and encryption

Production-critical metadata persists in PostgreSQL schema
`personal_data_vault`. Large/raw payloads stay as encrypted envelopes
referenced by `payloadId` / `objectRef`. Key material uses
`KeyProvider` `DATA_ENCRYPTION`. No encryption keys are committed. No
proprietary cryptography. Future HSM/KMS is the existing key-provider
boundary.

Minimization rejects KYC documents, bank/card credentials, private
keys, provider secrets, and passwords. Store references instead.

## Access

Reads evaluate owner, actor, purpose, category, classification,
consent port, Agent mandate, and capability (`VAULT_VIEW_OWN`,
`VAULT_INGEST_OWN`, `VAULT_EXPORT_OWN`, `VAULT_DELETE_OWN`). There is
no `getAllUserData()` for application code.

## Retention, deletion, correction, export

Retention is per category (`SERVICE_ACTIVE`, time-limited 180/730,
legal hold, evidence). Deletion tombstones metadata and shreds
ciphertext when the simulation retention port allows it. That is not a
legal erasure guarantee.

User-declared records may be overwritten. Derived and
provider-sourced records open a review/dispute. Export is a structured
portable bundle that omits internal security metadata, other users,
provider secrets, and protected compliance intelligence.
`legalPortabilityClaim` is always false.

## PEG / Agent boundary

PEG may reference a Vault fact via `toPegDataAssetRef`. The Vault is
not a second financial intelligence graph.

The Agent receives only requested records in approved categories for
an approved purpose. Wildcard access is forbidden. Conversation cannot
change consent.

## Lovable UX

Screens: Vault Home, Your Data, Data Categories, Data Sources,
Verified Data, User-Declared Data, Derived Insights, Who Can Access,
Data History, Export, Correct / Dispute.

Sandbox personas: `vault_minimal`, `vault_financial`,
`vault_employment`, `vault_multi_source`, `vault_derived`,
`vault_disputed`, `vault_revoked`, `vault_restricted_agent`. No real
personal data.

See `docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md`.
