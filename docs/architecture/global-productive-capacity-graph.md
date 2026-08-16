# Global Productive Capacity Graph

The graph is a derived index of finalized SunRey Blockchain facts.
It is not the source of truth.

## Authoritative facts

Registered productive objects, rights, oracle facts, productive
claims, verified contributions, and MoonRey issuance receipts.

## Nodes

- productive objects
- owners / controllers
- locations
- resource classes
- capacity / output / delivery / usage / reserve claims
- verified contributions
- oracle facts

## Edges

`OWNS`, `CONTROLS`, `OPERATES`, `PRODUCES`, `CONSUMES`, `DELIVERS`,
`DEPENDS_ON`, `LOCATED_IN`, `VERIFIED_BY`, `DERIVED_FROM`,
`SUPPLIES`, `USES_RESOURCE`, `HAS_CAPACITY`.

## Rebuild

`buildProductiveCapacityGraph` reconstructs the projection from
finalized history. Deleting the graph and rebuilding it produces
the same `projectionHash`. Blockchain facts are unchanged.

## Temporal model

Capacity is not permanently true. Objects and claims carry
`valid_from`, `valid_until`, measurement interval, epoch, and
superseded state. A 2026 capacity observation is not treated as
permanently true.

## Read APIs

Derived reads only. No raw sensitive personal data.

- productive object
- capacity by category
- output by category
- verified contributions
- contribution lineage
- MoonRey issuance attribution
- geographic aggregates
- epoch aggregates

## Observability

`productive_objects`, `productive_claims`, `verified_contributions`,
`rejected_contributions`, `duplicate_contributions`,
`moonrey_issuance`, `moonrey_issuance_by_category`, `epoch_issuance`,
`category_limit_utilization`, `oracle_concentration`,
`productive_graph_lag`.
