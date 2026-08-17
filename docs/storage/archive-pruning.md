# Archive and pruning

## ARCHIVE

An archive node retains full finalized history required for historical
queries and verification.

## PRUNED

A pruned node may drop historical **block payloads** below
`finalized_height - retain_finalized_blocks`.

Pruning must never remove:

- current consensus / tip state
- data required to verify the current state root
- validator history required for accountability
- commit metadata required for recovery

Indexes and evidence projections may be rebuilt. Kernel evidence
records live in the Evidence Vault, not in prunable chain traces.
