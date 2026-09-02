# Wave 3 — Evidence Commitments

SunRey Wave 3 introduces cryptographic evidence commitments that let blockchain
state attest to off-chain evidence supporting monetary transitions **without**
placing raw evidence on-chain.

**Principle:** RAW EVIDENCE OFF-CHAIN · CRYPTOGRAPHIC PROOF OF EVIDENCE ON-CHAIN

Owner: `packages/sunrey-chain/src/evidence-commitments/`

Depends on: Evidence Vault (`packages/evidence`), Wave 2 block commitment root
slots (`BlockHeaderV2`), ADR-0032 evidence anchoring.

---

## Evidence lifecycle

1. **Seal** — Kernel or domain service seals a decision or observation in the
   append-only Evidence Vault (`EvidenceVault.seal`). Payloads may contain
   sensitive fields; vault rows are never updated or deleted.
2. **Commit** — A versioned `EvidenceCommitment` binds stable metadata:
   evidence id, type, content hash, provenance hash, issuer, canonical temporal
   reference, and verification metadata. No raw payload fields enter the
   commitment.
3. **Bundle** — One or more commitments attach to an `EconomicClaim` inside an
   `EvidenceBundle` with explicit roles (`SUPPORTING`, `CONTRADICTING`,
   `SUPERSEDED`, `REVOKED`, `CHALLENGED`). Duplicate commitment hashes collapse
   to a single entry.
4. **Root** — Each finalized block scope computes an `EvidenceRoot` as a
   Merkle root over sorted bundle roots for claims with evidence in that block.
5. **Anchor** — `BlockHeaderV2.commitmentRoots.evidenceRoot` stores the 32-byte
   root. Historical headers are immutable.
6. **Status overlay** — Later challenge, supersede, revoke, or invalidate events
   append `EvidenceStatusRecord` rows. They never rewrite sealed commitments or
   committed block roots.

---

## Evidence Vault relationship

| Vault | On-chain commitment |
| --- | --- |
| Authoritative for raw payloads and hash chain | References `evidenceId` + `contentHash` (= `payloadSha256`) |
| `recordSha256` chain tip | May appear as `provenanceHash` |
| Append-only, DB-enforced | Block roots are replay-derived, not editable |
| Refusal seals even when chain submit unknown | Anchor absence ≠ no decision |

Bridge: `evidenceCommitmentFromVaultRecord` in `vault-bridge.ts`.

---

## Off-chain / on-chain boundary

**Off-chain (allowed to contain sensitive data):**

- Evidence Vault payloads
- PDV ciphertext
- Provider documents
- Raw observations and fabric cache rows

**On-chain (commitments only):**

- `EvidenceCommitment.commitmentHash`
- `EvidenceBundle.bundleRoot`
- `EvidenceRoot` in block header
- Claim fingerprint + economy discriminator

**Never on-chain:**

- Raw health records, DNA, communications, private financial records
- Personal identifiers, private enterprise datasets
- API secrets, provider credentials
- Unstable URLs or transient metadata (unless normalized to stable references first)

Enforced by `privacy.ts` scanners and block serialization tests.

---

## EvidenceCommitment

Schema version: `EVIDENCE_COMMITMENT_SCHEMA_VERSION = 1`

Deterministic hash domain: `sunrey.evidence.commitment.v1`

Bound fields:

- `evidenceId`
- `evidenceType`
- `contentHash` (64-char hex SHA-256)
- `provenanceHash`
- `issuerProvider`
- `temporalRef` (canonical UTC instant string)
- `verification` (`verificationMethod`, `verificationState`, `policyVersion`, `verifierRef`)

API: `createEvidenceCommitment`, `assertEvidenceCommitment`.

---

## EvidenceBundle

Associates commitments with one `EconomicClaim`:

```ts
type EconomicClaimRef = {
  claimId: string;
  economy: 'SUNREY' | 'MOONREY';
  claimFingerprint: string;
};
```

Semantics:

- Entries sorted by `commitmentHash`, then role precedence.
- Duplicate `commitmentHash` values collapse (no accidental double weight).
- `bundleRoot` = Merkle root over commitment hashes in canonical order.
- SunRey and MoonRey claims use the same machinery; `bundleId` includes economy
  so economic meaning does not collide.

---

## EvidenceRoot

Block-scope root semantics:

- Input: all `EvidenceBundle` values finalized in the block (or checkpoint scope).
- Bundle roots sorted lexicographically by `bundleRoot`.
- `EvidenceRoot.rootHex` = Merkle root over `(bundleId → bundleRoot)` leaves.
- **Empty scope:** deterministic `emptyMerkleRoot()` (domain-separated empty leaf).

The root commits to economic/monetary evidence bindings for the scope, not to
unrelated vault records.

---

## Block integration (Wave 2 reserved fields)

`BlockHeaderV2` extends `BlockHeaderV1`:

| Field | Tag | Status |
| --- | --- | --- |
| `commitmentRoots.evidenceRoot` | 12 | **Wave 3 — active** |
| `commitmentRoots.rightsRoot` | 13 | Reserved (zero) |
| `commitmentRoots.policyRoot` | 14 | Reserved (zero) |

- `schemaVersion = 2` when commitment roots are present.
- V1 headers decode unchanged (`decodeBlockHeader`).
- `commitmentRootsForBlock` derives roots from bundles at finalize time.
- Blocks with no economic evidence still commit to `emptyMerkleRoot()`.

---

## Proof creation

`buildEvidenceInclusionProof` produces:

1. Bundle membership proof — commitment hash leaf under `bundleRoot`.
2. Block membership proof — bundle id leaf under `evidenceRoot`.
3. Metadata: `claimId`, `bundleId`, `blockHeight`, `evidenceRootHex`.

Demonstrates: **Evidence X** ∈ **Bundle Y** supporting **Claim Z** committed by
**Block N** without revealing sibling evidence payloads.

---

## Proof verification

`verifyEvidenceInclusionProof` checks:

- Commitment hash matches bundle leaf.
- Bundle Merkle path resolves to `bundleRootHex`.
- Bundle root leaf matches block Merkle path to `evidenceRootHex`.

Tampering any of `contentHash`, bundle membership, claim reference, or root
invalidates verification.

---

## Privacy

- Commitments hash content; they do not embed it.
- `scanForForbiddenBlockPayload` rejects sensitive key names in block-bound JSON.
- Tests assert encoded block headers do not contain raw evidence identifiers or
  health payloads.
- ADR-0032 invariant preserved: forged on-chain anchor ≠ vault truth.

---

## Historical immutability

- Finalized `EvidenceRoot` values are not rewritten on challenge or revoke.
- `EvidenceStatusRecord` provides append-only interpretation overlays.
- Vault chain verification (`verifyChain`) remains the authoritative integrity
  check for sealed payloads.
- Reorg of an on-chain anchor does not unseal vault evidence (ADR-0032).

---

## Tests

`tests/wave-3-evidence-commitments.test.ts` — deterministic commitments/roots,
ordering invariance, inclusion proofs, privacy, vault restart, immutability,
SunRey/MoonRey separation, and block header compatibility.

Run:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-3-evidence-commitments.test.ts
```

---

## Related documents

- `docs/architecture/SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` — Section 10
- `docs/architecture/adr/ADR-0032-sunrey-blockchain-evidence-anchoring.md`
- `docs/architecture/SUNREY_ECONOMIC_INFORMATION_FLOW.md` — Wave 3 prep terms
