# Chunk 26R — SunRey Coin resume (supersedes historical stops)

**Status:** IMPLEMENTED.

**Supersedes:** `docs/architecture/chunk-26-stop.md` (historical Chunk 26
STOP-ONLY) and PR #52 (`cursor/sunrey-coin-stop-e559`), which recorded a
later stop while Clean Room was still `PLANNED`.

Those PRs did not implement SunRey Coin. `chunk-26-stop.md` is historical.

## Why the original stop is historical

The first Chunk 26 agent stopped because Consent Ledger, Purpose
Firewall, and Privacy Clean Room were absent. After Chunks 24 and 25R:

- Personal Data Vault is IMPLEMENTED (`packages/personal-data-vault`).
- Consent Ledger is IMPLEMENTED (`packages/consent`).
- Purpose Firewall is IMPLEMENTED in that same owner.
- Privacy Clean Room is IMPLEMENTED (`packages/clean-room`).

`evaluateChunkRequirements` for CHUNK-26 returns `mustStop: false`.
This resume implements the reserved digital-asset bounded context at
`packages/sunrey-coin`.

## Canonical owner

- Brand: **SunRey**. Asset: **SunRey Coin**.
- Package: `packages/sunrey-coin` only.
- Bounded context: `SUNREY_COIN` (`IMPLEMENTED`).
- Future reservations: `SUNREY_EXCHANGE` and `SUNREY_CHAIN` remain
  `PLANNED`. They are not implemented here.

Historical reservation names `PYRAMID` / `REYN_COIN` and
`PYRAMID_EXCHANGE` / `REYN_EXCHANGE` are replaced. Do not keep both
old and new canonical owners.

Forbidden competing roots: `packages/reyn-coin`,
`packages/sunrey-ledger`, `packages/reyn-ledger`, `packages/coin-ledger`,
`packages/crypto-ledger-v2`, `packages/token-ledger`,
`packages/coin-engine-v2`, `packages/sunrey-exchange`,
`packages/sunrey-chain`.

Public ticker: **UNDECIDED** / `NOT_ASSIGNED`. Do not invent
`SUNREY`, `SRN`, `SRY`, `REYN`, `RYN`, or `RCOIN` as a ticker.

## Foundational rule

SunRey Coin is a simulation economic ledger for authorized-contribution
rewards. It extends the canonical Ledger. It is not a second ledger,
not an exchange, not a chain, and not a priced token.

Flow:

Clean Room receipt + contribution
→ consent re-check
→ formula v1 (FLOOR, eight 0–100 factors)
→ evaluate (zero journals)
→ propose (zero journals)
→ Kernel `ISSUE_SUNREY_COIN`
→ verified Execution Authority
→ `Ledger.postJournal`
→ derived custody position + supply snapshot

## A. Baseline

Started from `origin/main` after Chunk 25R
(`feat(data): resume privacy clean room (#53)`).

Pre-flight: `personal-data-vault`, `consent`, `purpose-firewall`, and
`clean-room` are `IMPLEMENTED`. `mustStop` is false.

## B. Security / identity

Reuses `packages/security` `KeyProvider` and `packages/identity`.
Capabilities: `SUNREY_COIN_VIEW` (STANDARD) and
`SUNREY_COIN_OPERATE_REQUEST` (financial → KYC + STRONG). No live
custody keys. No chain wallets or addresses.

## C. SunRey Coin architecture

Canonical package `packages/sunrey-coin`. Asset id `asset:sunrey-coin`
is not a ticker. Display name is `SunRey Coin`. Precision 6.

System books `SUNREY.ISSUANCE`, `SUNREY.TREASURY`, `SUNREY.BURN` are
`SIMULATED_FUNDING_SOURCE`. Customer custody
`SUNREY.CUSTODY.<ownerId>` is `DIGITAL_ASSET_CUSTODY`, registered via
`AccountRegister.registerSystemAccount`, not `openAccount`.

`AssetQuantity` lives in `packages/money`. Ledger `Posting.amount` is
`LedgerAmount = Money | AssetQuantity`. Fiat and digital-asset amounts
must not share a journal.

## D. Contribution / Currency of You

Formula v1 is the product of eight bigint factors (0–100) times
`FORMULA_BASE_REWARD` (1_000_000) / `100^8`, **FLOOR**. Factors come
from Clean Room contribution metadata only. Protected identity traits
are accepted and voided; they must not change weight.

Replay key:
`receiptId:subjectId:jobId:purposeId:contributionId:formulaVersion`.

## E. Eligibility

Evaluate records `ELIGIBLE_SIMULATION`, `INELIGIBLE`, `DUPLICATE`,
`INSUFFICIENT_EVIDENCE`, `REVIEW_REQUIRED`, or `POLICY_DISABLED`.
Revoked or expired consent is `INELIGIBLE` for future evaluation.
Historic issued positions remain.

## F. Proposal

`proposeIssuance` writes no journal. Financial effect is false.

## G. Issuance

`issue` submits `ISSUE_SUNREY_COIN` to the Kernel. On ALLOW, verify
Execution Authority, then `Ledger.postJournal`: DEBIT issuance, CREDIT
custody, class bridge `SIMULATED_FUNDING_TO_DIGITAL_ASSET_CUSTODY`.

## H. Transfer

`TRANSFER_SUNREY_COIN` moves custody to custody. Circulating supply
must not change. Same-class, no Money mix.

## I. Burn

`BURN_SUNREY_COIN` DEBIT custody, CREDIT burn, same class bridge.

## J. Positions

Positions are derived from journals plus optional simulation holds.
No mutable balance field. Market price is `UNAVAILABLE`.

## K. Supply / reconciliation

`issued - burned === holdings` is `MATCHED`. Mismatch is recorded and
sealed. Never auto-mint or auto-burn to fix.

## L. Persistence

Customer V022 `sunrey_coin` schema stores metadata only. It is not a
second ledger. Ledger V005 widens journal/posting/account asset columns
to TEXT so `asset:sunrey-coin` can persist. Domain product/account ISO
currencies stay CHAR(3).

## M. Events / evidence

Namespace `sunrey_coin` with seven versioned events. Every evaluate,
propose, issue, transfer, burn, and reconcile seals the Evidence Vault.

## N. PEG

Non-authoritative `HOLDS` and optional `RESULTED_IN` references.
No raw payload. Not a second ledger.

## O. Agent

`SubjectScopedSunReyCoinTool` is read-only. `issue` / `transfer` /
`burn` on the tool always fail. `packages/agent` does not import
`packages/sunrey-coin` or `ExecutionAuthority`.

## P. Regulatory Digital Twin

Simulation scenario categories only. Legal state remains
`RESEARCH_REQUIRED`. The token is not classified.

## Q. Growth

`DIGITAL_ASSET_SIMULATION`. `marketPrice: UNAVAILABLE`.
`NO_GUARANTEED_RETURN`. No APY, APR, blended return, or yield field.

## R. Policy / Kernel

Purpose `CUSTOMER_DIGITAL_ASSET`. Action types
`ISSUE_SUNREY_COIN`, `TRANSFER_SUNREY_COIN`, `BURN_SUNREY_COIN`.
Simulation capability `cap-gb-sim-digital-custody` on
`prod_digital_usd_gb`. Unknown corridors stay `RESEARCH_REQUIRED`.

## S. Chain adapter

Type-only stub: `implemented: false`. No wallets, addresses, or keys.

## T. Exchange

Not implemented. `SUNREY_EXCHANGE` remains `PLANNED`.

## U. What this chunk implements

- `AssetQuantity` and `LedgerAmount` on the canonical money/ledger
- Kernel-gated issue / transfer / burn
- Authorized-contribution formula v1
- Derived custody positions and supply reconciliation
- Metadata persistence, events, evidence, PEG refs, read-only agent tool
- 20-subject Clean Room → coin demo

## V. Invariants preserved

- no second ledger
- no invented ticker
- no `LIVE_*` / `ENVIRONMENT` change
- no Kernel refusal catch-and-continue
- no agent mint
- no protected-trait contribution weight
- no human-worth ranking
- no replayed contribution issuance
- no transfer that changes supply
- no fabricated market price
- no live blockchain
- no SunRey Exchange in this chunk

## W. Demo

`npm run demo:sunrey-coin` — 20 subjects, PDV ingest, contribution
consent, Clean Room grocery aggregate, identical weights for A and B
despite different irrelevant identity traits, propose (no journal),
Kernel issue, derived position, supply `MATCHED`, duplicate rejected,
full transfer A→B with unchanged supply, revoke A's consent, historic
B position remains, future evaluate of A is `INELIGIBLE`, agent cannot
mint.

## X. Tests

Constitution test `CHUNK-26 implements SunRey Coin after Consent and
Clean Room` asserts `SUNREY_COIN` `IMPLEMENTED`, package present,
exchange/chain planned, and competing packages absent.

Package tests cover formula FLOOR, float rejection, ticker status, and
service wiring.

## Y. Exact results

Recorded in CI on this PR. Local pipeline is `npm run ci`.

## Z. Exact CI

Seven-stage CI order is unchanged. Persistence job stays separate.
`demo:sunrey-coin` is appended after `demo:clean-room`.

## AA. Regulatory / token-classification limitations

Digital-asset legal classification is **not established**. Nothing
here is `CONFIRMED_BY_COUNSEL`. SunRey Coin is not claimed to be a
security, commodity, deposit, e-money, stablecoin, or utility token.
There is no market price, redemption promise, or data-backed
enforceable value.

## AB. Intentionally unimplemented

SunRey Exchange, SunRey Chain, public ticker, live rails, live
custody keys, marketplace, AMM, order book, wallets, smart contracts,
USD/SAR price, yield, and any counsel-confirmed token class.

## AC. Exit criterion

Chunk 26R implementation exit criteria are met in simulation:

1. Canonical owner is `packages/sunrey-coin`.
2. Journals post only through `Ledger.postJournal` with verified EA.
3. Contribution rewards ignore protected traits.
4. Supply reconciles without auto-correction.
5. Agents cannot mint.
6. Exchange and Chain remain unbuilt.
7. No ticker was invented.

## AD. Recommendation for later chunks

Do **not** start SunRey Exchange or SunRey Chain from this tree.
Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag false.
Assign a public ticker only by an explicit later decision; do not
invent one here.
