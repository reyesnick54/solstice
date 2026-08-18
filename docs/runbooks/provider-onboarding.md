# Runbook — provider onboarding

1. Identify the provider domain and the canonical registry
   (infrastructure, oracle, regulated, or security HSM). Do not create
   a parallel registry.
2. Configure the provider with `SecretReference` / workload identity
   only. Never commit a secret value.
3. Run `sunrey-ops provider test` against the local or sandbox
   adapter. Tests are non-destructive by default.
4. Record evidence references (contract, security, license, DPA,
   data license). Missing slots stay missing.
5. A configured human reviewer reviews evidence. AI may summarize
   only.
6. Production eligibility is derived from the domain profile. It is
   never inferred from configuration or a passing sandbox test.
