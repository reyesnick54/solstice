# Runbook — Agent / model outage

Simulation / preproduction only.

1. Confirm `AGENT_MODEL_FAILURE`. Money UI and human-submitted intents remain usable.
2. Agent kill switches may pause `MODEL`, `TOOL`, or `ALL_AGENT_USAGE`. They must not disable account access.
3. ProposalGate ALLOW still means "fit for a human to consider." It is not Execution Authority.
4. Do not route around the model by letting the Agent call `postJournal`.
5. Grok remains reserved. Do not enable a live model to "fix" the outage.

Existing: `docs/runbooks/agent-security-incident.md`.
