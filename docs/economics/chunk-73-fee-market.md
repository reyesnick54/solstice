# Chunk 73 — SunRey adaptive fee market

FeePolicyV2 extends the canonical Chunk 42 fee engine. It does not create
a parallel fee subsystem, a second validator reward pool, or a second
monetary burn path.

Historic FeeSchedule / FeePolicy v1 semantics are preserved. Historical
transactions are not reinterpreted under FeePolicyV2.

## Resource model

Validators meter deterministic resource classes from transaction bytes
and protocol state. Equivalent Chunk 42 names are reused:

| V2 class | Historic equivalent |
| --- | --- |
| `TRANSACTION_BYTE_UNITS` | `TRANSACTION_BYTE_UNITS` |
| `STATE_READ_UNITS` | `STATE_READ_UNITS` |
| `STATE_WRITE_UNITS` | `STATE_WRITE_UNITS` |
| `CRYPTOGRAPHIC_PROOF_UNITS` | proof verify |
| `SIGNATURE_VERIFY_CLASSICAL` / `_HYBRID` / `_PQ` | split of `SIGNATURE_VERIFY_UNITS` |
| `ORACLE_VERIFY` | on-chain fact verification only |
| `EXCHANGE_DVP_LEG` | atomic multi-leg settlement |
| `INTEROP_PROOF` | deterministic interop proof verify |
| `OTHER_GOVERNED_RESOURCE` | compute and other governed work |

Wall-clock execution time is never a consensus resource quantity.

## Adaptive algorithm

`BASE_PRICE_FORMULA_V1` is a bounded proportional controller. The next
block base resource price depends only on:

- previous finalized base price
- previous finalized weighted resource usage
- governed target utilization
- governed adjustment denominator and one-block bound
- governed min/max price and block resource limit

It does not depend on APIs, AI output, local clocks, validator-local
load, or off-chain feeds. See
[`adaptive-resource-price.md`](./adaptive-resource-price.md).

## Policy parameters

Development/rehearsal fixtures exist. Production values remain
unconfigured until approved. AI cannot authorize changes.

Governed parameters: resource weights, formula version, target
utilization, min/max price, adjustment bound, block resource limit,
fee asset, and fee disposition.

## Fee assets

SunRey Coin remains the development fee asset. MoonRey is unavailable
as a fee asset unless a separate governed policy enables it.

## Disposition

`validator + burn + treasury = charged`. Validator rewards enter the
existing Chunk 42 / Chunk 72 reward pool. Burns use the existing
monetary burn account. Treasury is the native-chain treasury
classification, not a fiat ledger journal. Disposition cannot mint.

## Wallet authorization

The signed `max_fee` is the authorization. An estimate is informational.
If the required fee exceeds `max_fee`, execution follows the
insufficient-fee path and does not charge more.

`reserved = charged + released` exactly.

## Mainnet readiness

FeePolicyV2 is implemented. Formal, simulation, and performance results
are engineering evidence. Production parameters are still undecided.
Governance approval has not occurred.
