# ADR-0009: PYR Blockchain Approach

- **Status:** PROPOSED
- **Date:** 2026-08-14
- **Deciders:** Architecture (this record); not yet accepted. A human must accept or reject this record. This document is not an accepted decision.
- **Consulted:** None on file. No counsel review of this ADR has happened. No security-specialist review of custody has happened.
- **Informed:** Engineering, compliance, ledger, and any service that would later call a chain adapter.
- **Supersedes:** none
- **Related:** ADR-0006 (Policy Engine language); ADR-0008 (persistence); Phase 7 Consent Ledger / Clean Room (not present in this tree at inspection); Universal Ledger Fabric six invariants; `LIVE_CRYPTO_ENABLED` (must stay `false`)

This record compares four ways PYR — "The Currency of You", an economic settlement and participation asset powered by activity in the Solstice Personal Data Economy — could one day be represented on a blockchain. **PYR is not collateralized by personal data, not backed by personal data, and not redeemable for personal data.** Those descriptions are forbidden in code, comments, types, and documentation.

**This ADR does not select a chain. It does not implement a chain. Status remains PROPOSED.** Phase 8 implements only an abstract chain adapter and an in-memory simulation. `LIVE_CRYPTO_ENABLED` stays `false`. No node, testnet, RPC endpoint, or wallet provider is contacted. No real key material exists.

---

## Inspection of the current codebase

This ADR was written against git commit `19f31e5` (detached HEAD at start of Phase 8 work; `main` tip). Findings:

| Question | Finding | Path |
| --- | --- | --- |
| Consent Ledger (Phase 7) | **Does not exist.** No package, type, or test named consent ledger. Proof of Contribution therefore cannot depend on an existing consent reference type; Phase 8 must introduce the Consent Ledger. | Searched `*consent*`, `ConsentLedger` — no matches |
| Clean Room (Phase 7) | **Does not exist.** No clean-room computation surface. Phase 8 must introduce it. | Searched `*clean-room*`, `CleanRoom` — no matches |
| Evidence Vault | Exists. Append-only hash chain. Sealing is the only write. | [`packages/kernel/src/evidence.ts`](../../../packages/kernel/src/evidence.ts), [`packages/evidence-vault/src/vault.ts`](../../../packages/evidence-vault/src/vault.ts) |
| Ledger asset handling | Fiat `Money` (ISO 4217 codes, bigint minor units). Account classes are deposits / investments / digital_assets / rewards / pending / house_* / clearing. **No PYR asset class. No non-fiat participation asset.** | [`packages/ledger/src/journal.ts`](../../../packages/ledger/src/journal.ts), [`packages/domain/src/account.ts`](../../../packages/domain/src/account.ts), [`packages/domain/src/money.ts`](../../../packages/domain/src/money.ts) |
| Six ledger invariants | Present on the Phase 0/1 fabric: BALANCE, IMMUTABILITY, AUTHORITY, CLASS_BRIDGE, NO_COMMINGLING (CUSTOMER vs CORPORATE), IDEMPOTENCY. The Kernel-gated `packages/ledger` journal enforces per-currency balance and Kernel authorization; it does not yet know PYR. | [`src/ledger/invariants.ts`](../../../src/ledger/invariants.ts), [`src/ledger/journal.ts`](../../../src/ledger/journal.ts) |
| Growth Attribution PYR source | **Does not exist.** Catalog has exactly 13 sources. No `PYR_REWARD`, no `DATA_EARNINGS`. | [`packages/contracts/src/growth-catalog.ts`](../../../packages/contracts/src/growth-catalog.ts) |
| Jurisdiction packs | Versioned JSON packs for US, EU, GB, SA, AE. Each rule carries `legalReviewState`. Default-deny. `CONFIRMED_BY_COUNSEL` is forbidden in this build. `RESEARCH_REQUIRED` never permits. | [`packages/kernel/src/policy/packs/`](../../../packages/kernel/src/policy/packs/), [`packages/kernel/src/policy/schema.ts`](../../../packages/kernel/src/policy/schema.ts) |
| Crypto-custody subsystem | **Does not exist.** No custody package, no MPC/HSM interface, no subsystem manifest, no extraction trigger for real key material. | Searched `crypto-custody`, `subsystem-manifest` — no matches |
| `LIVE_CRYPTO_ENABLED` | `false` in capability flags. Must stay `false`. | [`packages/flags/src/capabilities.ts`](../../../packages/flags/src/capabilities.ts), [`config/capabilities.ts`](../../../config/capabilities.ts) |

**Files that do not exist (and were therefore not readable)**

- Consent Ledger, consent reference type, grant/revoke mutators
- Clean Room job runner
- PYR asset type, PYR wallet, PYR journals
- Jurisdictional PYR asset registry
- Chain adapter / gateway
- Pyramid Data Exchange, Proof of Contribution, Pyramid Data Index
- Crypto-custody interface and subsystem manifest
- ADR-0001 through ADR-0005; ADR-0009 (this file)

There is no chain client to "keep." There is no wallet SDK. There is no validator config. The cost of choosing a chain now is the cost of locking an unaccepted regulatory and operational posture. The cost of deferring the choice behind an adapter is one interface and a simulation.

---

## Decision drivers

1. **Regulatory classification exposure** across the United States, the European Union, Saudi Arabia, the United Arab Emirates, and the United Kingdom. Fitness for a regulator is a legal determination, not an architectural one. This ADR only compares *exposure surface*.
2. **Custody and key-management burden.** Real MPC/HSM key material is an extraction trigger for a crypto-custody subsystem and requires security-specialist review before any implementation. This phase has none.
3. **Settlement finality** — when a PYR credit can be treated as settled in the Universal Ledger Fabric.
4. **Cost** — protocol fees, operator staff, and the cost of being wrong.
5. **Validator or sequencer trust assumptions.**
6. **Upgrade and governance path.**
7. **How a jurisdictional disable would actually work** — not how a whitepaper would describe a pause button.
8. **Raw-data-off-chain enforcement** — only hashes, proof identifiers, consent references, settlement events, and provenance identifiers may ever be submitted. Raw sensitive personal data never goes on-chain.
9. **Exit cost** if the choice proves wrong.

Compliance disclaimer: this ADR does **not** claim that any option is compliant with the SEC, CFTC, FinCEN, MiCA, GDPR, UK GDPR, FCA, SAMA, Saudi PDPL, CBUAE, UAE PDPL, DIFC, ADGM, or any other regime.

---

## Options

### Option A — New Layer-1

Solstice (or a foundation it controls) specifies and operates a new base blockchain. Solstice chooses the consensus, the validator set, the fee asset, and the governance.

| Driver | Assessment |
| --- | --- |
| **Regulatory classification (US)** | Highest exposure. Operating a network plus issuing PYR can be argued as a commodity network, a security offering, a money-services business, or all three. Validator rewards and genesis allocations are separate classification events. |
| **Regulatory classification (EU)** | MiCA treats crypto-asset issuance and the operation of a trading platform / CASP as licensed activities. A new L1 with a native participation asset is the largest MiCA surface of the four options. GDPR still applies to any off-chain personal data; putting only hashes on-chain does not by itself make the network a lawful processor. |
| **Regulatory classification (SA / UAE)** | SAMA / CBUAE / VARA / ADGM / DIFC virtual-asset regimes focus on operators and custodians. Running validators in or for those jurisdictions is an operator licence question. Unknown corridors stay `RESEARCH_REQUIRED`. |
| **Regulatory classification (UK)** | FCA crypto-asset promotions and forthcoming regime: issuing and operating a network is a promotions-and-authorisation problem, not a software problem. |
| **Custody / keys** | Solstice must custody validator keys and, if it offers wallets, customer keys. That is the extraction trigger for crypto-custody. Highest operational burden. |
| **Finality** | Whatever Solstice specifies. Honest finality for a bank ledger still requires a defined reorg window. A new L1's finality is unproven to counterparties. |
| **Cost** | Highest: protocol research, validator ops, security audits, incident response, fee-market design. |
| **Trust** | Users trust Solstice's validator set. A "decentralized" L1 launched and gated by Solstice is still a Solstice trust assumption in the first years. |
| **Upgrade / governance** | Hard forks. Governance tokens recreate the classification problem. |
| **Jurisdictional disable** | **Does not actually work as a country switch.** A public L1 cannot stop a validator in another country from including a transfer. A "disable" is either (a) Solstice's gateway refusing to sign/submit, or (b) a protocol halt that stops *everyone*. Option (a) is a gateway rule, not an L1 feature. Option (b) is a kill switch that makes the chain a Solstice computer. |
| **Raw-data-off-chain** | Must be enforced in the mempool/application layer. An L1 that accepts arbitrary bytes will accept a raw record unless the transaction type *cannot express it*. That is an adapter/type problem, not a consensus problem. |
| **Exit cost** | Highest. Migrating off a Solstice L1 means abandoning the validator set, the explorer, and every integration. |

### Option B — L2 / rollup

PYR lives on a rollup that settles to an existing L1. Solstice may run the sequencer or outsource it.

| Driver | Assessment |
| --- | --- |
| **Regulatory classification (US / EU / SA / UAE / UK)** | Still an issuance and (if Solstice sequences) an operator question. Slightly smaller than Option A because Solstice is not claiming to be a base settlement network. Sequencer-as-a-service can look like a VASP / CASP. |
| **Custody / keys** | Sequencer keys plus any bridge keys. Bridge keys are a frequent loss mode. Still an extraction trigger if real HSM/MPC appears. |
| **Finality** | Soft finality at the sequencer; hard finality after L1 settlement. The bank ledger must say which one "settled" means. |
| **Cost** | Lower than a new L1; still sequencer ops, proving, and bridge risk. |
| **Trust** | Sequencer can censor or reorder. A decentralized sequencer set recreates Option A’s validator problem at smaller scale. |
| **Upgrade / governance** | Proxy contracts and admin keys. Admin-key governance is a custody and counsel problem. |
| **Jurisdictional disable** | **Honest form:** the sequencer refuses to include transfers for a disabled jurisdiction, *and* the Solstice gateway refuses to submit them. **Dishonest form:** claiming the rollup "cannot" move PYR in that country while a user can still submit a forced-inclusion transaction to L1. Forced inclusion is the point of many rollups; it fights a jurisdictional kill switch. |
| **Raw-data-off-chain** | Same as A: the posted data is whatever the transaction type allows. Calldata that can hold a blob can hold a record. The type must not have a field for a record. |
| **Exit cost** | Medium. Escape-hatch to L1 may exist; the PYR contract and its admin key still have to be migrated or abandoned. |

### Option C — Application-specific chain

A purpose-built chain (Cosmos SDK, Substrate, or similar) whose only application is PYR settlement and reference posting. Not a general L1; not a rollup on someone else's L1.

| Driver | Assessment |
| --- | --- |
| **Regulatory classification** | Similar to A in the five jurisdictions: Solstice still operates a network. "App-specific" does not shrink MiCA or MSB analysis. It can *help* the raw-data story if the module whitelist is closed. |
| **Custody / keys** | Validator keys again. Same extraction trigger. |
| **Finality** | Typically fast BFT. Counterparties must still accept Solstice's validator set. |
| **Cost** | High, slightly below a general L1 because the state machine is smaller. Still a chain to staff. |
| **Trust** | Explicitly Solstice (or a foundation) validators. Honest, and therefore easier to explain to counsel than a pretend-public L1. |
| **Upgrade / governance** | Module upgrades via governance. Can refuse non-reference txs at the module boundary. |
| **Jurisdictional disable** | Validators can refuse to include a transfer. That is a policy at the validator — i.e. Solstice — not a property of "the chain." A single honest (or hostile) validator in another country may still include it unless the module itself checks a registry. The registry check is an application rule. |
| **Raw-data-off-chain** | **Best of the four at the protocol layer** if the module accepts only the five reference kinds. That is still the same invariant as the adapter; it is just enforced twice. |
| **Exit cost** | High. The chain *is* the product. |

### Option D — Token on an existing chain

PYR is a contract (or equivalent) on a chain Solstice does not operate. Solstice runs a gateway that submits references and settlement events. Customer wallets, if any, are a later custody problem.

| Driver | Assessment |
| --- | --- |
| **Regulatory classification (US)** | Issuance / secondary-trading analysis remains. Solstice is less likely to be treated as a network operator. Using a public chain does **not** make PYR "not a security." |
| **Regulatory classification (EU)** | MiCA crypto-asset white paper and CASP duties may still apply to offering PYR. Operating a chain does not. |
| **Regulatory classification (SA / UAE / UK)** | Offering or marketing a token can be a virtual-asset activity even if Solstice does not run validators. Packs stay `RESEARCH_REQUIRED` until counsel says otherwise. |
| **Custody / keys** | Lowest *network* burden; **customer-wallet custody is unchanged**. The moment Solstice holds customer keys, MPC/HSM extraction triggers. A hosted wallet on someone else's chain is still custody. |
| **Finality** | Inherited. Must be named (e.g. "N L1 confirmations") before any live flag could flip — which this phase will not do. |
| **Cost** | Lowest protocol cost; variable fees; audit cost for the contract. |
| **Trust** | The host chain's validator/sequencer set. Solstice does not pick them. Censorship and reorgs are their problem and Solstice's operational risk. |
| **Upgrade / governance** | Contract admin keys or immutability. Admin keys are custody. Immutability raises exit cost in a different way (cannot fix). |
| **Jurisdictional disable** | **Works only at the gateway and, if present, a pausable contract.** Anyone who holds a signing key outside Solstice can transfer if the contract allows. A disable is: (1) registry-gated gateway refuses `TRANSFER_PYR`; (2) optional pause; (3) Solstice does not operate a matching engine. It is not a guarantee that no PYR moves on the host chain. That honesty is a feature of this option. |
| **Raw-data-off-chain** | **Weakest at the host layer** — most existing chains accept arbitrary calldata. Enforcement must be structural in the Solstice adapter: the submit function must not accept a raw record *as a type*. Relying on the host chain to reject personal data is not a control. |
| **Exit cost** | **Lowest.** Stop submitting. Pause if the contract allows. Leave the contract in place as a historical log of hashes. Move the adapter to another host later. Users are not locked to Solstice validators. |

---

## Comparison

| Driver | A New L1 | B L2 / rollup | C App-specific chain | D Token on existing chain |
| --- | --- | --- | --- | --- |
| Regulatory surface | Network + token | Sequencer + token | Network + token | Token (and any CASP/VASP offering) |
| Custody burden | Validator + wallet | Sequencer + bridge + wallet | Validator + wallet | Wallet only (still an extraction trigger) |
| Finality | Unproven | Sequencer then L1 | BFT, Solstice-trusted | Inherited, nameable |
| Cost | Highest | High | High | Lowest protocol |
| Trust | Solstice validators | Sequencer | Solstice validators | Host set |
| Upgrade | Hard fork | Admin proxy | Module gov | Admin key or immutable |
| Jurisdictional disable | Gateway only, or halt all | Fights forced inclusion | Validator policy = Solstice | Gateway + optional pause; honest limits |
| Raw-data enforcement | App/mempool | Calldata risk | Module whitelist (best protocol fit) | Adapter types only (must be structural) |
| Exit cost | Highest | Medium | High | Lowest |

---

## Recommendation

**Do not select a blockchain in this phase.** Implement only an abstract `ChainGateway` and a simulated in-memory chain.

**If a later accepted ADR must name a direction,** the least-worst candidate among these four is **Option D: a token on an existing chain, preferably an established public L2 for fee and finality reasons — still as a token, not as a Solstice-operated rollup.** Reasons:

1. Solstice is a simulated bank with a Compliance Kernel, not a validator-set operator. Options A–C add a network-operator classification on top of the already-unresolved PYR-issuance classification in US/EU/SA/UAE/UK.
2. A jurisdictional disable that actually works is a **registry-gated gateway** (and, later, a pausable contract). That is true on every option. Option D does not pretend a public L1 can un-include a transaction in one country.
3. Raw-data-off-chain is an **application invariant**. It is enforced by making a raw record impossible to express as a `ChainReference`. An L1 or app-chain module can repeat that check; it cannot replace it. Option C is the best *protocol* fit for a closed message type, but that benefit does not justify operating a chain before counsel and security review.
4. Exit cost is lowest: stop the adapter, leave hashes in place, point the same interface at a different host if the first host proves wrong.

**Rejected for now:** a new L1 (A) and a Solstice-operated app-chain (C) as first moves — they maximize operator burden and exit cost before PYR has a counsel-confirmed jurisdictional registry. A Solstice-operated rollup (B) is reserved as a possible later tightening if Option D's host-chain trust becomes unacceptable; it is not selected here.

**Not accepted.** No contract is deployed. No chain ID is configured. The adapter's only implementation is in-process simulation.

---

## Consequences

### Positive

- Phase 8 can ship the data-contribution flow entirely in simulation.
- The chain choice remains reversible.
- Raw-data-off-chain can be proven at the type boundary before any host exists.

### Negative

- Teams may treat the simulation as if a chain were chosen. The status line is PROPOSED to prevent that.
- Option D, if later accepted, inherits a host's outages and fee market.
- Counsel may reject Option D's "gateway-only disable" as insufficient for a given country; that is a reason to keep the ADR open, not to implement a chain now.

### Neutral / required follow-through

- Crypto-custody stays a stub. Real MPC/HSM key material triggers extraction of `packages/crypto-custody` and security-specialist review. See [`docs/architecture/subsystem-manifest.md`](../subsystem-manifest.md).
- No PYR jurisdictional entry is `CONFIRMED_BY_COUNSEL`. Capabilities derived from the registry stay disabled.
- `LIVE_CRYPTO_ENABLED` and `LIVE_DATA_MARKET_ENABLED` stay `false`.

---

## What Phase 8 implements instead of this choice

- `ChainGateway.submit(ref: ChainReference)` — `ChainReference` is constructible only via five static factories (hash, proof identifier, consent reference, settlement event, provenance identifier). There is no constructor, field, or overload for a raw record.
- `SimulatedChain` — in-memory confirm/query. No network.
- PYR journals on the Universal Ledger Fabric, six invariants unchanged, customer and corporate books separate.
- Jurisdictional PYR registry that automatically disables capabilities unless an entry is `CONFIRMED_BY_COUNSEL` (none are).
