# Production validator dossier

Each candidate validator requires a `ProductionValidatorDossier`.

Private keys are never stored in the dossier.

## Fields

- validator ID
- legal / operator reference where provided
- operator evidence state
- consensus public-key descriptor
- P2P public key
- governance key
- signer provider
- HSM evidence class and reference
- bond configuration
- failure domain
- infrastructure provider
- network endpoints / descriptors
- incident contact reference
- ceremony contribution state
- evidence references

Organizational independence is not claimed.

## Operator evidence

Supported evidence kinds:

- operator identity
- infrastructure readiness
- security controls
- signer readiness
- HSM attestation
- operations runbook acknowledgement
- governance agreement
- incident contact
- other governed requirements

## Acceptance

`ProductionValidatorAcceptance` requires configured evidence.

| State | Meaning |
| --- | --- |
| `CANDIDATE` | Recorded, not verified |
| `TECHNICALLY_VERIFIED` | Public keys, signer challenge, and suite checks passed |
| `EXTERNAL_EVIDENCE_REQUIRED` | Configured evidence or real HSM still missing |
| `HUMAN_ACCEPTED` | Human accepted a non-eligible or incomplete record |
| `GENESIS_ELIGIBLE` | Configured evidence complete, human accepted, not a fixture |

Fixture, testnet, development, and rehearsal validators can never
become `GENESIS_ELIGIBLE`.
