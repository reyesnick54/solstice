# Runbook — KYC / compliance provider outage

Simulation / preproduction only.

1. If KYC, sanctions, or AML is unavailable, the Kernel must not treat that as `CLEAR`.
2. Existing authenticated sessions and read-only balances may remain.
3. New onboarding and actions that require compliance facts stay refused or deferred.
4. Do not mark a rule `CONFIRMED_BY_COUNSEL` because a fixture adapter recovered.
5. Manual-review queue growth is expected. Do not auto-clear it.

Existing: `docs/runbooks/regulated-provider-outage.md`.
