# Runbook — Provider outage

Simulation / preproduction only.

1. Identify provider class. Technical health is not legal or production approval.
2. Confirm the domain-scoped kill switch (`PROVIDER`, `RAIL`, `CORRIDOR`) if a human operator engages it. Control room cannot engage it.
3. Apply Kernel `BLOCK` / `DEFER` / `REQUIRE_MANUAL_REVIEW`. Do not fail open.
4. Leave regulated actions unavailable when the provider is required.
5. Treasury liquidity warning is SEV3 unless customer payouts are blocked.
6. Do not substitute a different vendor because a sandbox adapter is green.

Existing: `docs/runbooks/regulated-provider-outage.md`, `docs/runbooks/provider-runtime-incident.md`.
