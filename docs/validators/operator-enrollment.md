# Validator operator enrollment

Enrollment is an operational workflow. It does not itself admit a
validator into the canonical set.

## Stages

1. **Operator profile** — public descriptor, organization, contacts.
2. **Infrastructure evidence** — region, failure domain, provider.
3. **Signer evidence** — public-key fingerprint, HSM/KMS state, fencing.
4. **Candidate V2 assignment** — bind `SUNREY_PRODUCTION_NETWORK_CANDIDATE_2`.
5. **Dossier** — consume the Chunk 85 `ProductionValidatorDossier`.
   Do not duplicate dossier authority.
6. **Human acceptance** — a human principal records
   `ValidatorOperatorAcceptance`. AI cannot accept. Fixtures cannot
   become production acceptance.
7. **Validator governance action** — prepare the canonical join /
   activation action. The operator platform does not apply it.
8. **Activation coordinate** — epoch/height coordinate for the
   governed activation.

## Commands

```
sunrey-ops validator enrollment
sunrey-ops validator enrollment start
sunrey-ops validator operator
```

Private personal details stay off the public Explorer surface.
