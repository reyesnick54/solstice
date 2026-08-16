# ADR index

Engineering decision status and regulatory/legal confidence are
different axes. Do not collapse them.

**Engineering decision status:** `PROPOSED` · `ACCEPTED` ·
`ACCEPTED_FOR_ENGINEERING` · `SUPERSEDED` · `REJECTED`

`ACCEPTED_FOR_ENGINEERING` means later chunks may implement the
decision. It is not human product acceptance of a live network and
it is not counsel review.

**Regulatory / legal confidence** (when a record discusses a legal or
regulatory position): `DRAFT` · `RESEARCH_REQUIRED` ·
`COUNSEL_REVIEWED` · `CONFIRMED_BY_COUNSEL`

No record in this repository is `CONFIRMED_BY_COUNSEL`. Agents must not
mark any legal or regulatory position `CONFIRMED_BY_COUNSEL`.

ADR-0001 through ADR-0005 are not in this repository. Existing numbers
are not reused or silently changed.

| Number | Title | Engineering status | Legal / regulatory confidence | Affected subsystem | Depends on | Implementation status | Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0006 | Policy Engine Language | PROPOSED (Addendum A: engineering Option C implemented in simulation; not human ACCEPTED) | RESEARCH_REQUIRED — no counsel review; no pack is confirmed | COMPLIANCE / policy engine | none | IMPLEMENTED (engineering / simulation only) | [ADR-0006-policy-engine-language.md](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity and authentication stack (earlier draft) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | none | NOT_IMPLEMENTED | [ADR-0007-identity-stack.md](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack (later revision) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | ADR-0006, ADR-0008 | NOT_IMPLEMENTED | [ADR-0007-identity-and-authentication-stack.md](./ADR-0007-identity-and-authentication-stack.md) |
| 0006 | Policy Engine Language | PROPOSED | RESEARCH_REQUIRED — no counsel review; no pack is confirmed | COMPLIANCE / policy engine | none | NOT_IMPLEMENTED | [ADR-0006-policy-engine-language.md](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity and authentication stack (earlier draft) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | none | PARTIAL | [ADR-0007-identity-stack.md](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack (later revision) | PROPOSED (Addendum A: in-house domain engineered; vendor not selected; not counsel) | not a legal opinion; no counsel review | IDENTITY | ADR-0006, ADR-0008 | PARTIAL | [ADR-0007-identity-and-authentication-stack.md](./ADR-0007-identity-and-authentication-stack.md) |
| 0008 | Persistence Layer for Phase 1 | PROPOSED (Addendum A: engineering-accepted Option A; not counsel) | not a legal opinion | persistence / BANKING / Evidence durability | ADR-0006, ADR-0007 | PARTIAL | [ADR-0008-persistence-layer.md](./ADR-0008-persistence-layer.md) |
| 0009 | Canonical cryptographic infrastructure | ACCEPTED | not a legal opinion; no counsel review | SECURITY | none | IMPLEMENTED (Chunk 33R CryptoSuite / Ed25519 / PQ ports; not quantum-proof) | [ADR-0009-cryptographic-infrastructure.md](./ADR-0009-cryptographic-infrastructure.md) |
| 0010 | Canonical compliance screening fabric | PROPOSED | RESEARCH_REQUIRED — simulation only; no counsel review | COMPLIANCE / screening | ADR-0006 | PARTIAL | [ADR-0010-compliance-screening-fabric.md](./ADR-0010-compliance-screening-fabric.md) |
| 0011 | Personal Economic Graph | PROPOSED | not a legal opinion; no counsel review | PERSONAL_ECONOMIC_GRAPH | identity, events, persistence | PARTIAL | [ADR-0011-personal-economic-graph.md](./ADR-0011-personal-economic-graph.md) |
| 0012 | Machine-verifiable mandates and Growth Orchestrator | PROPOSED | not a legal opinion; no counsel review | GROWTH_ORCHESTRATOR / PERSONAL_ECONOMY_AGENT | identity, PEG, events, evidence | PARTIAL | [ADR-0012-mandates-and-growth-orchestrator.md](./ADR-0012-mandates-and-growth-orchestrator.md) |
| 0013 | Regulatory Digital Twin | PROPOSED | RESEARCH_REQUIRED — simulation only; no counsel review | REGULATORY_DIGITAL_TWIN | ADR-0006, identity, events, evidence | IMPLEMENTED (engineering / simulation only) | [ADR-0013-regulatory-digital-twin.md](./ADR-0013-regulatory-digital-twin.md) |
| 0013 | Personal Economic Value Engine | PROPOSED | not a legal opinion; no counsel review | PERSONAL_ECONOMIC_VALUE_ENGINE | identity, PEG, agent, growth, events, evidence | PARTIAL | [ADR-0013-personal-economic-value-engine.md](./ADR-0013-personal-economic-value-engine.md) |
| 0014 | Investment Risk Engine and Model Registry | PROPOSED | RESEARCH_REQUIRED — simulation/engineering limits only; no counsel review | RISK / MODEL_REGISTRY | ADR-0006, investments, kernel, events, evidence | IMPLEMENTED (engineering / simulation only) | [ADR-0014-investment-risk-and-model-registry.md](./ADR-0014-investment-risk-and-model-registry.md) |
| 0015 | SunRey Chain foundation | PROPOSED | RESEARCH_REQUIRED — simulation only; no counsel review | SUNREY_CHAIN | security, evidence, events, consent, clean-room, sunrey-coin | IMPLEMENTED (engineering / simulation only) | [ADR-0015-sunrey-chain-foundation.md](./ADR-0015-sunrey-chain-foundation.md) |
| 0016 | SunRey Blockchain node architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0015, ADR-0009 | PARTIAL (local development node; production not implemented) | [ADR-0016-sunrey-blockchain-node-architecture.md](./ADR-0016-sunrey-blockchain-node-architecture.md) |
| 0017 | SunRey Blockchain consensus architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0018 | NOT_IMPLEMENTED (interface freeze) | [ADR-0017-sunrey-blockchain-consensus-architecture.md](./ADR-0017-sunrey-blockchain-consensus-architecture.md) |
| 0018 | SunRey Blockchain validator architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0017, ADR-0024 | NOT_IMPLEMENTED (Chunk 36 stopped) | [ADR-0018-sunrey-blockchain-validator-architecture.md](./ADR-0018-sunrey-blockchain-validator-architecture.md) |
| 0019 | SunRey Blockchain state machine architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0020, ADR-0031 | PARTIAL (Chunk 32R objects + local development state machine) | [ADR-0019-sunrey-blockchain-state-machine-architecture.md](./ADR-0019-sunrey-blockchain-state-machine-architecture.md) |
| 0020 | SunRey Blockchain execution runtime | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0019, ADR-0031 | PARTIAL (SYSTEM / EVIDENCE_ANCHOR local modules) | [ADR-0020-sunrey-blockchain-execution-runtime.md](./ADR-0020-sunrey-blockchain-execution-runtime.md) |
| 0021 | Transaction and block encoding | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0019, ADR-0024 | PARTIAL (Chunk 32R protobuf codec + local block production) | [ADR-0021-sunrey-blockchain-transaction-block-encoding.md](./ADR-0021-sunrey-blockchain-transaction-block-encoding.md) |
| 0022 | Blockchain storage model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0019, ADR-0021 | PARTIAL (local crash-safe file store) | [ADR-0022-sunrey-blockchain-storage-model.md](./ADR-0022-sunrey-blockchain-storage-model.md) |
| 0023 | Networking / P2P architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0017, ADR-0018 | IMPLEMENTED (development Quinn/rustls; not production BFT) | [ADR-0023-sunrey-blockchain-networking-p2p.md](./ADR-0023-sunrey-blockchain-networking-p2p.md) |
| 0024 | Cryptographic agility model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN / SECURITY | ADR-0009, ADR-0016, ADR-0025 | IMPLEMENTED (Chunk 33R foundation; Ed25519; no production PQC) | [ADR-0024-sunrey-blockchain-cryptographic-agility.md](./ADR-0024-sunrey-blockchain-cryptographic-agility.md) |
| 0025 | Post-quantum migration architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review; not quantum-secure | SUNREY_CHAIN / SECURITY | ADR-0024, ADR-0028 | PARTIAL (hybrid envelope + ports; production PQC not selected) | [ADR-0025-sunrey-blockchain-post-quantum-migration.md](./ADR-0025-sunrey-blockchain-post-quantum-migration.md) |
| 0026 | Native asset model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review; tickers NOT_ASSIGNED | SUNREY_CHAIN / SUNREY_COIN | ADR-0019, ADR-0020, ADR-0031 | PARTIAL (Coin on ledger; MoonRey absent) | [ADR-0026-sunrey-blockchain-native-asset-model.md](./ADR-0026-sunrey-blockchain-native-asset-model.md) |
| 0027 | Oracle architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0019, ADR-0020, ADR-0031 | NOT_IMPLEMENTED | [ADR-0027-sunrey-blockchain-oracle-architecture.md](./ADR-0027-sunrey-blockchain-oracle-architecture.md) |
| 0028 | Governance and protocol upgrades | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0017, ADR-0021 | NOT_IMPLEMENTED | [ADR-0028-sunrey-blockchain-governance-upgrades.md](./ADR-0028-sunrey-blockchain-governance-upgrades.md) |
| 0029 | Interoperability model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0026, ADR-0031, ADR-0033 | NOT_IMPLEMENTED | [ADR-0029-sunrey-blockchain-interoperability.md](./ADR-0029-sunrey-blockchain-interoperability.md) |
| 0030 | Privacy / confidentiality model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN / PDV / CONSENT | ADR-0015, ADR-0019, ADR-0031 | PARTIAL (simulation classification) | [ADR-0030-sunrey-blockchain-privacy-confidentiality.md](./ADR-0030-sunrey-blockchain-privacy-confidentiality.md) |
| 0031 | Canonical ledger vs blockchain authority | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | BANKING / SUNREY_CHAIN | ADR-0015, ADR-0026 | IMPLEMENTED (matrix + tests; no production chain) | [ADR-0031-canonical-ledger-vs-blockchain-authority.md](./ADR-0031-canonical-ledger-vs-blockchain-authority.md) |
| 0032 | Evidence anchoring and audit | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | EVIDENCE / SUNREY_CHAIN | ADR-0015, ADR-0019, ADR-0031 | PARTIAL (simulation anchors) | [ADR-0032-sunrey-blockchain-evidence-anchoring.md](./ADR-0032-sunrey-blockchain-evidence-anchoring.md) |
| 0033 | Chain identity / network ID / genesis | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED — no counsel review | SUNREY_CHAIN | ADR-0016, ADR-0017, ADR-0021, ADR-0028 | PARTIAL (simulation IDs plus local-dev GenesisV1; no production genesis) | [ADR-0033-sunrey-blockchain-identity-genesis.md](./ADR-0033-sunrey-blockchain-identity-genesis.md) |

## Notes on ADR-0007

Two files share number 0007. They are not two different decisions and
they are not renumbered.

- `ADR-0007-identity-stack.md` was written against an empty application
  tree.
- `ADR-0007-identity-and-authentication-stack.md` revises the same
  slot so the Context cites the Customer domain. Other ADRs link to
  this later filename.

Both remain `PROPOSED`. Neither authorizes an identity provider, SDK,
or vendor contract.

## What "implementation status" means here

- **NOT_IMPLEMENTED** — the decision, if later accepted, has no
  corresponding runtime on `main`.
- **PARTIAL** — reserved for later use when a proposed ADR has a
  subset of its consequences on `main`.
- **IMPLEMENTED** — reserved for later use when an **ACCEPTED** ADR
  has its stated confirmation criteria on `main`.

PROPOSED is not ACCEPTED. Agents must not change these statuses.
