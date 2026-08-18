# Runbook — provider replacement

Replacement is a governed, evidence-based migration between compatible
providers. Canonical protocol authority does not change.

Examples:

- oracle provider replacement
- KMS replacement
- cloud object storage replacement

1. Confirm capability compatibility with `sunrey-ops provider profile`.
2. Plan the replacement (`planProviderReplacement`). Required evidence
   classes come from the domain profile.
3. Run acceptance tests against the successor in sandbox.
4. Dual-run where architecture requires diversity. Measure provider,
   region, and controller concentration.
5. Human review is required before any production-eligibility change.
