# Provider evidence

Each `ExternalProviderEvidenceRecord` stores:

- provider
- evidence class
- document or reference ID
- issuer or source
- issued / expiration metadata
- content digest
- verification state
- human reviewer and role
- scope

Confidential document contents are never placed on the public chain.
A filled slot is not proof.

## Evidence classes

Service contract, security assessment, SOC/ISO or equivalent,
penetration-test reference, HSM attestation, key-management evidence,
data-processing agreement, data-license agreement, SLA, business
continuity, jurisdiction, license/registration, and human approval.

## Expiration

Evidence with expiration metadata becomes `STALE` when that instant is
reached. Stale evidence cannot silently remain current.

## Human review

AI may summarize evidence. AI cannot mark `HUMAN_REVIEWED`,
`HUMAN_ACCEPTED`, or `PRODUCTION_ELIGIBLE`.
