# Light-client freeze runbook

A frozen client is a correct fail-closed outcome.

## When a client freezes

The light client observed two conflicting foreign headers at the same
height, each with a valid finality proof. Trust assumptions for that
foreign validator set are violated.

## Immediate effect

- Status becomes `FROZEN`
- New header updates are rejected
- New packets are rejected
- Historical verified headers remain as evidence

## What not to do

- Do not unfreeze from a relayer submission
- Do not resume verification from an arbitrary new header
- Do not treat the freeze as a node fault

## Recovery

Recovery is a governed procedure: new client version or explicit
unfreeze authorization, trust-continuity proof, and activation
height. AI cannot authorize recovery.
