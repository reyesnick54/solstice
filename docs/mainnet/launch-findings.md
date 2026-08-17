# Launch findings

`RehearsalFinding` fields:

- finding ID
- category
- severity
- description
- evidence
- owner
- remediation
- verification state

## Engineering blockers

`MAINNET_ENGINEERING_BLOCKER` is a finding category for unresolved
issues that would prevent a future production launch. It is separate
from legal and regulatory dependencies.

## Activation plan

Chunk 65 `ActivationPlan` is updated from rehearsal findings. The plan
does not execute. It does not launch validators, publish production
genesis, or enable `LIVE_*` flags.
