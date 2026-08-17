# Runbook — regulated provider outage

Simulation / sandbox / production-candidate-disabled only.

1. Identify the provider class and whether the action requires it.
2. Confirm health is `UNAVAILABLE`, `DEGRADED`, or `UNKNOWN`.
3. Apply the versioned outage posture (`BLOCK`, `DEFER`, or
   `REQUIRE_MANUAL_REVIEW`).
4. Leave the regulated action unavailable when the provider is
   required. Do not rewrite `UNAVAILABLE` to `CLEAR`.
5. Seal the Kernel decision and provider-health evidence.
6. Do not fail open, invent a substitute provider, or mark the
   provider licensed because a sandbox adapter is healthy.

This runbook is not a legal conclusion.
