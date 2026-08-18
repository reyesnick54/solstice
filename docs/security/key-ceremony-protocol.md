# Key ceremony protocol

Versioned `CeremonyPlan` fields: `ceremony_id`, purpose, environment
class, network candidate, participant roles, required approvals, key
purposes, CryptoSuites, provider requirements, steps, expected public
artifacts, evidence requirements, recovery plan, schema version.

## Roles

Operational engineering roles, not legal certifications:

`CEREMONY_COORDINATOR`, `SECURITY_OFFICER`, `VALIDATOR_OPERATOR`,
`GOVERNANCE_SIGNER`, `RELEASE_SIGNER`, `WITNESS`,
`INDEPENDENT_OBSERVER`.

## Dual control

High-impact operations require configurable multi-person authorization
(default two distinct humans):

- create root governance key
- activate genesis signing session
- rotate release authority
- approve recovery procedure

One human credential does not have unrestricted ceremony control by
default. AI may assist with reports and cannot approve, sign as a
human, verify external HSM possession, or declare production authority
active.

## Session states

`PLANNED` → `PARTICIPANTS_VERIFIED` → `PROVIDER_VERIFIED` →
`KEYS_GENERATED` → `PUBLIC_DESCRIPTORS_COLLECTED` →
`ATTESTATIONS_VERIFIED` → `TRANSCRIPT_FINALIZED` →
`REHEARSAL_COMPLETE`.

`AWAITING_EXTERNAL_PRODUCTION_EVENT` is reserved. The repository can
complete rehearsal states without pretending a real production event
occurred.

## Network isolation

Profiles: `OFFLINE`, `RESTRICTED_NETWORK`, `DEVELOPMENT_SIMULATION`.
Production-class sensitive signing workflows do not require public RPC
connectivity (`requiresPublicRpc: false`).

## CLI

```
sunrey-ceremony plan
sunrey-ceremony participants
sunrey-ceremony provider-check
sunrey-ceremony generate
sunrey-ceremony contribute
sunrey-ceremony attest
sunrey-ceremony approve
sunrey-ceremony transcript
sunrey-ceremony verify
sunrey-ceremony rehearse
sunrey-ceremony production plan
sunrey-ceremony production validators
sunrey-ceremony production participants
sunrey-ceremony production provider-check
sunrey-ceremony production contribute
sunrey-ceremony production attest
sunrey-ceremony production genesis
sunrey-ceremony production verify
sunrey-ceremony production transcript
sunrey-ceremony production authorization-dossier
sunrey-ceremony production rehearse
```
