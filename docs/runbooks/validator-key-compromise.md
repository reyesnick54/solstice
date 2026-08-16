# Validator key compromise

Simulation / development procedure. Not a production incident plan.

1. Stop the compromised signer process. Do not reuse the seed.
2. Record evidence if the key produced conflicting signatures.
3. Queue `ROTATE_CONSENSUS_KEY` for the **next** epoch. The current
   epoch continues with the old public key so historical votes still
   verify.
4. After the epoch boundary, the old key is retained on
   `historicalConsensusKeys` and must not sign the new epoch.
5. Duplicate active consensus public keys are rejected.
6. If equivocation is confirmed, jail then tombstone. Chunk 36 does
   not apply economic penalties.
7. P2P, governance, recovery, Execution Authority, and wallet keys
   are separate. Rotate only the compromised role.
8. Never paste private key material into logs, tickets, or git.

AI agents must not perform the rotation. A human or legal-entity
controller is required.
