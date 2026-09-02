# Wave 3 Economic Proof Domain Model

**Status:** Wave 3 Prompt 1 — domain model and proof lattice (simulation only)  
**Date:** 2026-09-02  
**Owner:** `packages/sunrey-chain/src/economic-proof`  
**Prerequisites:** Wave 2 sovereign blockchain core (`WAVE 2 EXIT GATE: PASS`)

Wave 3 establishes the **Economic Proof Architecture**: the typed progression from raw economic observations through evidence, verified facts, and canonical claims — without placing sensitive raw data on-chain and without granting monetary authority at any proof stage.

Wave 3 is **not** the Economic Awareness Fabric, production oracle mesh, full HEC graph, valuation models, issuance formulas, or mainnet activation.

---

## Authority boundary diagram

```text
REAL WORLD (providers, sensors, HIN, oracles — simulation fixtures)
        |
        |  no monetary authority
        v
+---------------------------+
|   EconomicObservation     |  "A source reported or measured something."
+---------------------------+
        |
        |  digest references only; raw PDV off-chain
        v
+---------------------------+
|     EconomicEvidence      |  Material supporting or refuting a claim.
+---------------------------+
        |
        |  verification methodology applied
        v
+---------------------------+
|   VerifiedEconomicFact    |  Sufficient evidence supports this fact.
+---------------------------+
        |
        |  fingerprinted registry record
        v
+---------------------------+
| CanonicalEconomicClaim    |  Canonical economic event for policy evaluation.
|  HUMAN_ECONOMIC  |  PRODUCTIVE_ECONOMIC (distinct domains)
+---------------------------+
        |
        |  valuation is non-authoritative
        v
+---------------------------+
|    EconomicValuation      |  (future wave — not implemented here)
+---------------------------+
        |
        v
+---------------------------+
|    MonetaryProposal       |  (future wave — non-binding until governance)
+---------------------------+
        |
        v
+---------------------------+
|  GovernanceAuthorization  |  (Chunk 71 / ceremony — not proof lattice)
+---------------------------+
        |
        v
+---------------------------+
| MonetaryStateTransition   |  Native supply / ledger (Wave 2 monetary consensus)
+---------------------------+
        |
        v
      BLOCKCHAIN (cryptographic commitments only — not full payloads)
```

**Authority rule:** Each horizontal boundary is a hard gate. No object below `GovernanceAuthorization` may mutate `AssetSupplyBook`, issue Execution Authority, or set Exchange price.

---

## Core separation (never collapse)

| Object | May do | Must NOT |
| --- | --- | --- |
| `EconomicObservation` | Record a provider measurement with provenance | Mint; be treated as verified truth |
| `EconomicEvidence` | Bind digests, rights, purpose | Replace Evidence Vault; contain raw PDV on-chain |
| `VerifiedEconomicFact` | Assert verified measurement under methodology | Authorize issuance |
| `CanonicalEconomicClaim` | Fingerprint an economic event for policy | Double-count; hold wallet balance |
| `HumanEconomicContribution` | (HEC registry — separate owner) | Mint SunRey directly |
| `ProductiveEconomicContribution` | (productive registry — separate owner) | Mint MoonRey directly |
| `EconomicValuation` | Propose reference value | Set supply or market price |
| `IssuanceProposal` | Propose quantity | Execute without Chunk 71 gate |
| `GovernanceAuthorization` | Authorize policy-bound execution | Auto-activate mainnet |
| `MonetaryStateTransition` | Append-only supply delta | Rewrite history |
| `MarketPrice` | Exchange last trade | Authorize issuance |

---

## Canonical types (Wave 3)

All types live under `packages/sunrey-chain/src/economic-proof/` with versioned schema constants:

| Type | Schema ID |
| --- | --- |
| `EconomicObservation` | `sunrey.economic-proof.observation.v1` |
| `EconomicEvidence` | `sunrey.economic-proof.evidence.v1` |
| `VerifiedEconomicFact` | `sunrey.economic-proof.verified-fact.v1` |
| `CanonicalEconomicClaim` | `sunrey.economic-proof.claim.v1` |

### Economic domains

Claims and observations are tagged `HUMAN_ECONOMIC` or `PRODUCTIVE_ECONOMIC`. SunRey and MoonRey are **not** modeled as one generic category with a token field — evidence domains remain distinct even though they share proof infrastructure.

---

## Existing types preserved

| Legacy type | Owner | Relationship to Wave 3 |
| --- | --- | --- |
| `OracleObservation` / `VerifiedEconomicFact` (oracle) | `packages/sunrey-chain/src/oracle` | Productive oracle-network facts; adapted via `fromOracleVerifiedFact()` |
| `EconomicObservation` (economy-data) | `packages/sunrey-chain/src/productive/economy-data` | Productive ingestion plane; adapted via `fromEconomyDataObservation()` |
| `HumanContributionRegistryRecord` | `packages/human-economic-contribution` | Human contribution ontology; feeds human claims in later waves |
| `ExternalObservation` | `packages/external-data` | Provider envelope; not proof-lattice canonical |
| Chunk 71 issuance types | `packages/sunrey-chain/src/economics` | Monetary authority — downstream of proof lattice |

**Not deprecated:** Mature oracle and economy-data types remain authoritative within their owners. Wave 3 adds the **cross-domain proof lattice** without replacing them.

---

## Persistence boundaries

| Store | Contents | Monetary authority |
| --- | --- | --- |
| Bounded DB / claim registry (future) | Full `CanonicalEconomicClaim` records | **None** |
| `solstice_evidence` | Hash-chained vault seals | **None** |
| Proof persistence ports (`economic-proof/persistence.ts`) | In-memory simulation stores + seal interface | **None** |
| Blockchain state | Commitment hashes via `chainCommitmentRepresentation()` | **None** — anchors only |

Full proof-domain records stay off-chain. Consensus-relevant identifiers and commitments use deterministic canonical serialization (`economic-proof/serialization.ts`).

---

## Deterministic serialization

Reuses Wave 2 length-prefixed codec primitives from `packages/sunrey-chain/src/blocks/codec.ts`:

- Fixed field order
- Unsigned big-endian integers (`bigint` minor units — no floating point)
- Sorted repeated fields before encoding
- Domain-separated SHA-256 commitments (`SUNREY_ECONOMIC_OBSERVATION_V1`, etc.)

Chain commitment representation requires **only** `{ objectId, schemaVersion, commitment, economicDomain }` — `rawPayloadRequired: false`.

---

## Validation rules

`economic-proof/validation.ts` enforces:

- Supported schema versions only
- Required IDs and provenance where mandated
- Valid temporal ranges (`startUtc <= endUtc`)
- Valid economic domains (`HUMAN_ECONOMIC` | `PRODUCTIVE_ECONOMIC`)
- No negative physical quantities
- No unlabeled numeric values (metric + unit required)
- No monetary mutation authority on proof objects

---

## Tests

`packages/sunrey-chain/src/economic-proof/economic-proof.test.ts` proves:

- Deterministic serialization and commitments
- Deterministic duplicate fingerprints
- Human vs productive claim distinction
- Observation / evidence / verified fact / claim cannot authorize issuance
- Malformed claim and unsupported schema rejection
- Chain commitment without raw payload requirement
- Adapter compatibility with oracle and economy-data types

---

## Remaining ambiguities (Prompt 2+)

1. **Duplicate resolution** — fingerprint exists; full anti-double-count registry not implemented (Prompt 2).
2. **Evidence / Rights / Policy roots** — commitment batch model for block header extension roots (Wave 3 later prompts).
3. **Cross-plane observation reconciliation** — Wave 5 external-data vs economy-data vs oracle observations not unified.
4. **Durable claim registry schema** — SQL migration not added in Prompt 1; ports defined only.
5. **Information consensus quorum** — single-source verification paths in economy-data remain distinct from oracle quorum.

---

## Related documents

- [`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`](./SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md) — Wave 3 scope
- [`SUNREY_MONETARY_AUTHORITY_CONTRACT.md`](./SUNREY_MONETARY_AUTHORITY_CONTRACT.md) — monetary boundaries
- [`WAVE2_SOVEREIGN_BLOCKCHAIN_COMPLETION_REPORT.md`](./WAVE2_SOVEREIGN_BLOCKCHAIN_COMPLETION_REPORT.md) — Wave 2 exit gate
- [`SUNREY_BLOCKCHAIN_CAPABILITY_MATRIX.md`](./SUNREY_BLOCKCHAIN_CAPABILITY_MATRIX.md) — capability status
- [`SUNREY_ECONOMIC_INFORMATION_FLOW.md`](./SUNREY_ECONOMIC_INFORMATION_FLOW.md) — Wave 1 flow audit

---

*End of Wave 3 Economic Proof Domain Model — Prompt 1.*
