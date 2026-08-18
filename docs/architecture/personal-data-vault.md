# Personal Data Vault

Canonical owner: `packages/personal-data-vault`.

The vault is the subject-bound encrypted store for user-controlled
personal data. It is not a financial asset, Consent Ledger, Clean Room,
data marketplace, or Sol Coin.

Chunk 100 Human Information descriptors and connectors reference vault
metadata only. Raw vault contents are never exported to the blockchain
or to a market buyer.

## Technical deletion guarantees

When a deletion request is allowed by the simulation retention port:

1. Ciphertext for that asset's versions is removed from the payload store.
2. The asset-specific wrapped DEK fields are cleared (crypto-shred).
3. Metadata is tombstoned (`DELETED` / `TOMBSTONED`) so audit and lineage
   remain consistent.
4. Access-audit rows keep actor, subject, asset, operation, purpose,
   decision, and reason — never payload.

This is **not** a legal erasure guarantee. Copies in process memory,
backups, or future object-storage replicas are out of scope. Sibling
assets keep their own envelopes and remain readable.

`RETAINED_BY_POLICY` is used only when an explicit configured policy
returns `RETENTION_REQUIRED` with `policyId` and `policySource`.

## Legal / privacy status

`RESEARCH_REQUIRED`. Technical controls are not GDPR, CCPA, PDPL, HIPAA,
or any other legal compliance.
