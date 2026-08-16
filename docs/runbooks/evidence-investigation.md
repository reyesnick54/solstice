# Runbook — evidence investigation

Read-only investigation of consensus equivocation evidence.
Simulation / development only. Research status, not a legal
finding.

## Collect

```
sunrey-node evidence list
sunrey-node evidence show <id>
sunrey-node evidence verify <file-or-id>
sunrey-node validator offenses <validator>
```

The CLI prints evidence hashes, public keys, and signatures. It
never prints private keys.

## Validation failures that must reject the evidence

- different validators
- different rounds or heights
- the same signed message twice
- invalid signature
- current key after rotation used instead of the historical key
- wrong chain or network
- expired evidence (`height + 16` exceeded)
- altered canonical bytes
- already processed `EvidenceId`

Any of these is false or malformed evidence. The accused validator
must remain unchanged. If the payload arrived from a peer, that
peer's misbehavior score should increase.

## Distinguishing missed votes

Absence of a prevote or precommit is not evidence. Do not open an
accountability receipt for liveness-only gaps.

## Persistence / replay

Restart the node from the same data directory and resubmit the
same evidence file. The second penalty must be rejected. Receipts
are append-only under `accountability-receipts.json`.
