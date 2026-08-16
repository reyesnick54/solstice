# SunRey chain authority matrix

Canonical companion to ADR-0031. This table is the source of truth
for *which store wins*. There is no second unofficial matrix.

Engineering status: `ACCEPTED_FOR_ENGINEERING`.
Legal / regulatory confidence: `RESEARCH_REQUIRED`.
Not `CONFIRMED_BY_COUNSEL`.

Production blockchain is **not implemented**. Rows that name
"SunRey Blockchain" as a future native authority do not mean that
authority exists today.

## Legend

| Authority | Meaning |
| --- | --- |
| Canonical Ledger | `packages/ledger` journals via `Ledger.postJournal` |
| SunRey Blockchain | Future native chain state in `packages/sunrey-chain` (simulation receipts only today) |
| Evidence Vault | `packages/evidence` hash chain |
| Personal Data Vault | `packages/personal-data-vault` |
| Consent Ledger | `packages/consent` |
| External regulated provider | Bank, broker, card network, Travel Rule counterparty — simulation ports only |
| Oracle | Signed observation; never money (ADR-0027) |
| Derived projection only | PEG, PEVE, indexes, market data, surveillance alerts |

If two authorities are listed, the **first** is authoritative for
that row. The second is an anchor, operational copy, or projection.

## Matrix

| State category | Authority | Must not |
| --- | --- | --- |
| Fiat deposits | Canonical Ledger | Chain balances; PEG; custody provider API |
| Payments (outbound/inbound instructions and settlement journals) | Canonical Ledger | Chain; rail adapter as books |
| Investment / brokerage cash | Canonical Ledger | Chain; paper broker as books |
| Securities positions (accounting) | Canonical Ledger + investments lots derived from authorized journals | Chain token wrappers; PEG |
| SunRey Coin (current simulation units) | Canonical Ledger (`packages/sunrey-coin`) | Chain as a second coin ledger; invented ticker |
| SunRey Coin (future native chain units) | Not migrated. Requires a later ADR. Until then Canonical Ledger | Silent dual-authority |
| MoonRey Coin | Development issuance on SunRey Blockchain from a finalized `VerifiedProductiveContribution` (Chunk 44). Public ticker `NOT_ASSIGNED`. Production MoonRey Coin product remains unimplemented. | Alias of SunRey Coin; invented ticker; fiat substitute; arbitrary mint |
| Identity (legal identity, KYC metadata, ActorContext) | Solstice Identity (`packages/identity`) | Chain as KYC store; PDV as identity authority |
| Identity references on-chain | SunRey Blockchain (scoped commitments) after write; Identity remains the person/business authority | Universal public person id |
| Consent (grant, revoke, purpose, permits) | Consent Ledger | Chain as the consent database; PDV as consent |
| Consent receipts / revocations on-chain | SunRey Blockchain (hashes) ; Consent Ledger remains authoritative | Raw consent documents on-chain |
| Raw personal data | Personal Data Vault | Chain; evidence payloads; PEG nodes |
| Attestations (source records) | Issuer + PDV / identity as applicable | Chain as the only copy of raw claims |
| Attestation commitments | SunRey Blockchain (hash, schema, revocation state) | Treating a commitment as KYC completion |
| Productive capacity | Authoritative objects/claims/contributions on SunRey Blockchain; Global Productive Capacity Graph is a derived rebuildable projection (Chunk 44) | Graph as blockchain source of truth; minting from unverified capacity |
| Oracle observations | Oracle module (future); facts are not money | Price as official NAV; FX as execution |
| Exchange orders | SunRey Exchange matching engine | Chain order book; ledger as an open-order store |
| Exchange trades (match records) | SunRey Exchange | Chain as matching authority |
| Exchange settlement (asset/fiat journals) | Canonical Ledger via CoinPort / FiatPort | Chain DVP as books |
| Custody (provider balances, destinations, withdrawals) | `packages/custody` operational state; customer accounting remains Canonical Ledger | Provider API as ledger; chain as custody books |
| Proofs (Kernel decision evidence) | Evidence Vault | Chain as the only proof store |
| Policy versions (packs, legalReviewStatus) | Compliance Kernel / policy engine | Chain; RDT candidate packs; AI promotion |
| Policy decision commitments | Evidence Vault + optional chain anchor | Chain ALLOW replacing Kernel |
| Execution Authority | Kernel-issued, `packages/permissions` | Chain signature as authority |
| Market-surveillance alerts | Derived projection (`packages/market-surveillance`) | Alerts as legal findings or freezes |
| Personal Economic Graph / PEVE | Derived projection | Graph as balance |
| Clean Room results | Clean Room receipts; raw views ephemeral | Chain as the computation store |
| Information-market listings | `packages/information-market` | Chain as a CLOB |

## Conflict rules

1. Fiat or current SunRey Coin journals versus chain: **Ledger wins**.
2. Consent database versus chain receipt: **Consent Ledger wins**.
3. Vault evidence versus chain anchor: **Vault wins**.
4. Identity versus scoped chain reference: **Identity wins** for who
   the person is; the chain wins only for the commitment bytes it
   stored.
5. Reorg: mark chain operation `REORG_OBSERVED`. **Do not rewrite
   journals, vault records, or consent history.**

## Production claims

This matrix does not make the chain production-ready, decentralized,
quantum-secure, regulator-approved, or mainnet-ready.
