# Runbook — validator production onboarding

## Dossier

Collect a `ProductionValidatorDossier` for each candidate:

1. Validator ID and operator reference
2. Distinct consensus, P2P, and governance public keys
3. Signer provider and HSM evidence
4. Bond configuration and failure domain
5. Infrastructure provider and endpoints
6. Incident contact
7. Configured evidence references

Do not place private keys in the dossier or in Git.

## Evidence

Operator identity, infrastructure readiness, security controls, signer
readiness, HSM attestation, runbook acknowledgement, governance
agreement, and incident contact must be referenced before
`GENESIS_ELIGIBLE`.

## Signer test

Before eligibility, the signer interface must prove:

- correct public key and purpose
- allowed algorithm
- sign/verify on a safe challenge message (not a production block)
- anti-double-sign state readiness
- health

Backup/recovery evidence is required without exporting the private key
into application code.

## Rejection rules

- Fixture validators never become `GENESIS_ELIGIBLE`
- Testnet, development, and rehearsal keys are rejected
- Duplicate high-risk fingerprints are rejected
- Simulation HSM cannot satisfy a configured real-HSM requirement

Chunk 92 operator enrollment consumes this dossier and records
`ValidatorOperatorEnrollment` / `ValidatorOperatorAcceptance`.
Fixture production acceptance remains rejected. See
[../validators/operator-enrollment.md](../validators/operator-enrollment.md).
