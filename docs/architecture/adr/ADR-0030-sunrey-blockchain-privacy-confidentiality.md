# ADR-0030 — SunRey Blockchain privacy / confidentiality model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN / PERSONAL_DATA_VAULT / CONSENT
- Depends on: ADR-0015, ADR-0019, ADR-0031, ADR-0032
- Implementation status: PARTIAL for simulation classification;
  production confidentiality: NOT_IMPLEMENTED

## Context

The simulation chain already distinguishes `ON_CHAIN_SAFE` versus
`OFF_CHAIN_ONLY` and stores scoped subject commitments, not a
universal public identifier. Raw PDV, PAN/CVV, health, genetic, and
private-key material are structurally denied.

Confidential *balances* that hide from the regulated ledger would
create an unauditable second money.

## Decision

1. Default on-chain content is **commitments, hashes, public
   protocol metadata, and scoped subject references**.
2. Raw personal data remains in the Personal Data Vault. Consent
   remains in the Consent Ledger. The chain stores receipts and
   revocations, not the grant document.
3. There is no production confidential-transaction, full-anonymity,
   or homomorphic-balance feature in this freeze.
4. Later confidentiality (if any) must preserve:
   - auditability for Kernel / evidence / regulated fiat
   - no hidden fiat
   - Purpose Firewall default DENY
5. Encryption for node-to-node links is a transport concern
   (ADR-0023), not application confidentiality of ledger fiat.
6. No GDPR/CCPA/PDPL/HIPAA compliance claim.

## Alternatives considered

- **Full anonymity set / privacy coin model.**
- **Put KYC documents on-chain encrypted to a master key.**
- **Confidential fiat balances on-chain.**

## Why rejected

- Privacy-coin semantics conflict with Travel Rule research,
  surveillance simulation, and audit.
- Master-key encrypted KYC on-chain is still a leak and a
  retention nightmare.
- Confidential fiat on-chain is a second unauditable ledger.

## Security implications

Commitments must be non-linkable across purposes (already a
simulation goal). Hash-only designs still leak metadata (time,
graph). That leakage is accepted for the public protocol metadata
set and must be documented, not denied.

## Compliance implications

Privacy law, lawful access, and retention are `RESEARCH_REQUIRED`.
Not `CONFIRMED_BY_COUNSEL`.

## Operability implications

Operators of nodes see public metadata. They must not log RPC
payloads that include off-chain-only fields.

## Migration implications

Simulation commitments are not production anonymity guarantees.

## Unresolved questions

- Selective disclosure / ZK for attestations (research, not frozen
  as implemented).
- How much metadata is too much for scoped subject references.

## Status

`ACCEPTED_FOR_ENGINEERING` for commitments-on-chain,
data-off-chain. Production confidentiality features: **not
implemented**. Legal confidence: `RESEARCH_REQUIRED`.
