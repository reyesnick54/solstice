# Runbook — ceremony verification

Independent verification recomputes the transcript hash chain and
checks public artifacts.

## Check

1. Every transcript entry sequence matches `n+1`.
2. `priorTranscriptHash` matches the previous `entryHash`.
3. Recomputed `entryHash` matches the stored hash.
4. Final `CeremonyTranscriptHash` matches the chain tip.
5. Public-key contributions verify under the operator key.
6. Attestation fingerprints match registered keys.
7. Genesis binding hash matches the exact field set.
8. Approvals are human-signed and untampered.

Any mutation of a contribution, attestation, genesis hash, approval,
or transcript entry must fail verification.

The public report contains ceremony ID, roles, public fingerprints,
algorithms, attestation status, genesis candidate hash reference,
transcript hash, approval count, and software versions. It contains
no secret material.
