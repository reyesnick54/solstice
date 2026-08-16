# Verified economic fact specification

Simulation / development protocol only. Legal confidence:
`RESEARCH_REQUIRED`. Facts are cryptographically evidenced protocol
inputs, not philosophical truth and not money.

## Object

A `VerifiedEconomicFact` is the canonical on-chain fact other modules
may read:

| Field | Meaning |
| --- | --- |
| `fact_id` | Domain-separated hash of the finalized content |
| `feed_id` | Feed that produced the fact |
| `subject` | Resource / plant / cluster identifier |
| `aggregated_value` | Integer mantissa + scale + unit |
| `unit` | Canonical `UnitRegistry` code |
| `source_observation_ids` | Sorted contributing observation ids |
| `aggregation_policy` | Policy from the feed definition |
| `observation_window` | Inclusive measurement start/end (UTC) |
| `valid_until` | Expiration instant (UTC) |
| `quality_status` | `PENDING` / `VERIFIED` / `CONFLICTED` / `STALE` / `REVOKED_SOURCE` / `SUPERSEDED` |
| `finalized_height` | Height at which the window finalized |

## Admission

An observation is admitted only when all of the following hold:

- provider is registered and `ACTIVE`
- provider is authorized for the feed's fact type
- feed is active
- unit and scale match the feed
- time window is valid and fresh
- sequence increases per `(oracle_id, feed_id)`
- network and chain match
- schema and bounds hold
- geography is present when required
- CryptoSuite verifies the signature
- payload is inside the resource-meter bound

Stable rejection codes live in `ORACLE_REJECTION_CODES`.

## Consumers

Native modules treat facts as inputs with explicit freshness and
quorum rules. Missing, stale, or conflicted required facts fail
closed.

`REFERENCE_PRICE` cannot authorize fiat journals. FX remains
`packages/payments` simulation quotes. MoonRey issuance remains
unavailable.

## Schema upgrades

Fact-type schemas are versioned. New types or units arrive only
through governed schema upgrades. Absence of a type is not permission
to invent a second oracle package.
