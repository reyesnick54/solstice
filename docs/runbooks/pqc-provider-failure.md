# Runbook: PQC provider failure (fail closed)

If the standardized PQ provider is unavailable or corrupt when
CryptoPolicy requires hybrid or PQ:

1. Stop signing. Do not fall back to classical-only.
2. Surface `PROVIDER_UNAVAILABLE` / `SIGNER_PROVIDER_UNAVAILABLE`.
3. Seal evidence of the refusal. Do not catch and proceed.
4. Restore the pinned `@noble/post-quantum@0.5.4` dependency from the
   lockfile / SBOM. Do not substitute an unpinned library.
5. Re-run `sunrey-ops crypto readiness` and known-answer tests.
6. Resume only after the catalog reports the provider available.

This is not an invitation to disable policy. Production approval is a
later explicit security/release/governance process.
