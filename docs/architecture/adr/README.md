# ADR index

Engineering decision status, legal/regulatory confidence, and production
activation are **different axes**. Do not collapse them.

- **IMPLEMENTED** does not mean **APPROVED**.
- **CONFIGURED** does not mean **LIVE**.
- **ACCEPTED_FOR_ENGINEERING** authorizes simulation work only.

Canonical lifecycle vocabulary: [`LIFECYCLE.md`](./LIFECYCLE.md).

Machine-readable registry: `packages/config/src/adr-governance.ts`.

Activation gates: `packages/config/src/activation-gates.ts`.

## Engineering decision status

`DRAFT` · `PROPOSED` · `ACCEPTED_FOR_ENGINEERING` · `ACCEPTED` ·
`SUPERSEDED` · `REJECTED` · `DEPRECATED`

`ACCEPTED_FOR_ENGINEERING` means later chunks may implement the decision in
simulation. It is not human product acceptance of a live network and it is
not counsel review.

## Legal / regulatory confidence

`NOT_APPLICABLE` · `DRAFT` · `RESEARCH_REQUIRED` · `COUNSEL_REVIEWED` ·
`CONFIRMED_BY_COUNSEL`

No record in this repository is `CONFIRMED_BY_COUNSEL`. Agents must not mark
any legal or regulatory position `CONFIRMED_BY_COUNSEL`.

## Production activation

`NOT_ALLOWED` · `ENGINEERING_ONLY` · `REGULATORY_GATED` ·
`EXTERNAL_APPROVAL_REQUIRED`

Every ADR in this repository currently resolves to **production activation
not allowed** at runtime. `packages/config/src/activation-gates.ts` enforces
fail-closed defaults.

ADR-0001 through ADR-0005 are not in this repository. Existing numbers are
not reused or silently changed.

| ADR | Title | Engineering status | Legal confidence | Implemented? | External approval required? | Production activation allowed? | Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0006 | Policy Engine Language | PROPOSED | RESEARCH_REQUIRED | yes (simulation) | legal + regulatory | no | [ADR-0006](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity stack (earlier draft) | SUPERSEDED | N/A | no | no | no | [ADR-0007-identity-stack](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack | PROPOSED | N/A | partial | legal + provider | no | [ADR-0007-auth](./ADR-0007-identity-and-authentication-stack.md) |
| 0008 | Persistence Layer for Phase 1 | PROPOSED | N/A | partial | no | engineering only | [ADR-0008](./ADR-0008-persistence-layer.md) |
| 0009 | Canonical cryptographic infrastructure | ACCEPTED | N/A | yes | no | engineering only | [ADR-0009](./ADR-0009-cryptographic-infrastructure.md) |
| 0010 | Canonical compliance screening fabric | PROPOSED | RESEARCH_REQUIRED | partial | legal + provider + regulatory | no | [ADR-0010](./ADR-0010-compliance-screening-fabric.md) |
| 0011 | Personal Economic Graph | PROPOSED | N/A | partial | no | engineering only | [ADR-0011](./ADR-0011-personal-economic-graph.md) |
| 0012 | Mandates and Growth Orchestrator | PROPOSED | N/A | partial | no | engineering only | [ADR-0012](./ADR-0012-mandates-and-growth-orchestrator.md) |
| 0013 | Regulatory Digital Twin | PROPOSED | RESEARCH_REQUIRED | yes (simulation) | legal + regulatory | no | [ADR-0013-rdt](./ADR-0013-regulatory-digital-twin.md) |
| 0013 | Personal Economic Value Engine | PROPOSED | N/A | partial | no | engineering only | [ADR-0013-peve](./ADR-0013-personal-economic-value-engine.md) |
| 0014 | Investment Risk Engine and Model Registry | PROPOSED | RESEARCH_REQUIRED | yes (simulation) | legal + regulatory | no | [ADR-0014](./ADR-0014-investment-risk-and-model-registry.md) |
| 0015 | SunRey Chain foundation | PROPOSED | RESEARCH_REQUIRED | yes (simulation) | legal + regulatory | no | [ADR-0015](./ADR-0015-sunrey-chain-foundation.md) |
| 0016 | SunRey Blockchain node architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0016](./ADR-0016-sunrey-blockchain-node-architecture.md) |
| 0017 | SunRey Blockchain consensus architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0017](./ADR-0017-sunrey-blockchain-consensus-architecture.md) |
| 0018 | SunRey Blockchain validator architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0018](./ADR-0018-sunrey-blockchain-validator-architecture.md) |
| 0019 | SunRey Blockchain state machine architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0019](./ADR-0019-sunrey-blockchain-state-machine-architecture.md) |
| 0020 | SunRey Blockchain execution runtime | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0020](./ADR-0020-sunrey-blockchain-execution-runtime.md) |
| 0021 | Transaction and block encoding | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0021](./ADR-0021-sunrey-blockchain-transaction-block-encoding.md) |
| 0022 | Blockchain storage model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0022](./ADR-0022-sunrey-blockchain-storage-model.md) |
| 0023 | Networking / P2P architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0023](./ADR-0023-sunrey-blockchain-networking-p2p.md) |
| 0024 | Cryptographic agility model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0024](./ADR-0024-sunrey-blockchain-cryptographic-agility.md) |
| 0025 | Post-quantum migration architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0025](./ADR-0025-sunrey-blockchain-post-quantum-migration.md) |
| 0026 | Native asset model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0026](./ADR-0026-sunrey-blockchain-native-asset-model.md) |
| 0027 | Oracle architecture | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + provider + regulatory | no | [ADR-0027](./ADR-0027-sunrey-blockchain-oracle-architecture.md) |
| 0028 | Governance and protocol upgrades | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev) | legal + regulatory | no | [ADR-0028](./ADR-0028-sunrey-blockchain-governance-upgrades.md) |
| 0029 | Interoperability model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes (dev gateway) | legal + regulatory | no | [ADR-0029](./ADR-0029-sunrey-blockchain-interoperability.md) |
| 0030 | Privacy / confidentiality model | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0030](./ADR-0030-sunrey-blockchain-privacy-confidentiality.md) |
| 0031 | Canonical ledger vs blockchain authority | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | yes | legal + regulatory | no | [ADR-0031](./ADR-0031-canonical-ledger-vs-blockchain-authority.md) |
| 0032 | Evidence anchoring and audit | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0032](./ADR-0032-sunrey-blockchain-evidence-anchoring.md) |
| 0033 | Chain identity / network ID / genesis | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + regulatory | no | [ADR-0033](./ADR-0033-sunrey-blockchain-identity-genesis.md) |
| 0034 | SunRey Access Fabric / Human Access Economy | ACCEPTED_FOR_ENGINEERING | RESEARCH_REQUIRED | partial | legal + provider + regulatory | no | [ADR-0034](./ADR-0034-sunrey-access-fabric.md) |

## Notes on ADR-0007

Two files share number 0007. They are not two different decisions and they
are not renumbered.

- `ADR-0007-identity-stack.md` was written against an empty application tree.
- `ADR-0007-identity-and-authentication-stack.md` revises the same slot.

The earlier draft is `SUPERSEDED`. The later revision remains `PROPOSED`.
Neither authorizes an identity provider, SDK, or vendor contract.

## What "implementation status" means here

- **NOT_IMPLEMENTED** — no corresponding runtime on `main`.
- **PARTIAL** — a subset of the ADR consequences exists on `main`.
- **IMPLEMENTED** — engineering artifacts exist on `main` (often simulation-only).

`PROPOSED` is not `ACCEPTED`. `ACCEPTED_FOR_ENGINEERING` is not production
authorization. Agents must not upgrade these statuses without human review.

## Maintenance

When adding an ADR:

1. Add the markdown file under `docs/architecture/adr/`.
2. Add a row to this index.
3. Add a record to `packages/config/src/adr-governance.ts`.
4. If the ADR controls a regulated feature, add an activation gate in
   `packages/config/src/activation-gates.ts` and a `LIVE_*` default in
   `packages/config/src/flags.ts`.
