# Chunk 164 — Production launch candidate freeze

This chunk freezes the exact candidate that humans and external
reviewers would later evaluate. It does **not** activate production.

Canonical owner: `packages/sunrey-chain` under the existing mainnet
release candidate at
`packages/sunrey-chain/src/release-candidate/mainnet/launch-freeze`.

Capability: `sunrey-production-launch-freeze`.

## What this is

A single immutable object identifying exactly:

- what software
- what protocol
- what economic constitution
- what genesis candidate
- what providers
- what external evidence
- what operating scope
- what security artifacts
- what database schemas
- what configuration

would constitute one production launch candidate.

The freeze binds hashes from:

- Mainnet RC
- Economic RC
- Full-platform candidate
- Production economic authorization
- External evidence snapshot
- Operating scope snapshot
- Provider binding snapshot
- Genesis candidate
- Validator candidate set
- Crypto policy
- Build / SBOM / provenance

`freezeHash` is deterministic. Freeze is not approval. Freeze is not
authorization. Freeze is not activation.

## Exact version binding

Every bound component includes component ID, schema version, content
version, and content hash. `latest`, `current`, `default`, `main`, and
`HEAD` are rejected as semantic versions. `sourceCommit` may identify
the actual Git commit SHA.

There is no implicit provider, implicit parameter set, or implicit
release artifact inside the frozen candidate.

## Snapshots

- External evidence: record IDs, classes, subjects, scope, content
  digests, verification state, expiry, and revocation. No confidential
  documents.
- Operating scope: exact Chunk 161 rows. Jurisdiction, legal entity,
  activation domain, provider requirement, corridor, or eligibility
  changes stale the freeze.
- Provider binding: Chunk 162 candidate matrix. Provider IDs, domains,
  profile versions, endpoint profile hashes, credential descriptor
  references, evidence refs, operating-scope refs, and failover
  mappings. No raw credentials.
- Database migrations: database name, migration IDs, content digests,
  and latest schema version. No database dumps.
- Configuration: safe metadata and credential-descriptor hashes. No
  secret values, private keys, API tokens, or passwords.

## States

`DRAFT`, `INCOMPLETE`, `ENGINEERING_VALIDATED`,
`AWAITING_EXTERNAL_EVIDENCE`, `AWAITING_PRODUCTION_PARAMETERS`,
`AWAITING_HUMAN_AUTHORIZATION`, `FROZEN_FOR_REVIEW`, `STALE`,
`REJECTED`, `SUPERSEDED`.

`PRODUCTION_ACTIVE`, `LIVE`, and `DEPLOYED` are not freeze states.

If real production parameters remain `UNCONFIGURED`, the freeze may
exist as `INCOMPLETE_REVIEW_CANDIDATE`. It must not become
`LAUNCH_REVIEW_READY`.

Once `FROZEN_FOR_REVIEW`, the object is immutable. Any modification
requires a new freeze ID, version, and hash.

## Staleness and diff

`evaluateLaunchCandidateStaleness` stales the candidate when
constitutionally relevant state changes. CPU temperature, temporary
local test duration, and wall-clock monitoring metrics do not stale
the freeze.

`diffProductionLaunchCandidates` classifies changes. It never
auto-approves.

## Current repository result

Expected current result is `AWAITING_PRODUCTION_PARAMETERS` and/or
`AWAITING_EXTERNAL_EVIDENCE` and/or `AWAITING_HUMAN_AUTHORIZATION`.
This chunk does not fake `FROZEN_FOR_REVIEW`.

## Commands

```
npm run demo:sunrey-production-launch-freeze
```
