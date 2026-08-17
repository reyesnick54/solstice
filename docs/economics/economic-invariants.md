# Economic invariants

These invariants are checked after every stress run and after every
property-stream operation. They are engineering statements, not a
marketing security score.

| ID | Statement |
| --- | --- |
| `SUNREY_SUPPLY_RECONCILES` | `genesis + issued − burned = circulating + locked + escrowed + feeReserved` for `SUNREY_COIN`. Fee burn uses the same burn counter. |
| `MOONREY_SUPPLY_RECONCILES` | Constitutional MoonRey book matches productive issuance. No parallel mint. |
| `NO_HIDDEN_NATIVE_ISSUANCE` | Every SunRey unit has a `MonetaryIssuanceAuthority`. Treasury cannot mint. |
| `NO_DUPLICATE_MOONREY_ISSUANCE` | A contribution fingerprint / replay id mints at most once. |
| `NO_DUPLICATE_VALIDATOR_REWARD` | An entitlement id is paid at most once through `ValidatorEconomicsEngine`. |
| `NO_DUPLICATE_VALIDATOR_PENALTY` | A protocol evidence id executes at most one penalty. |
| `FEE_RESERVATION_RECONCILES` | Charged = burned + validator reward + treasury. |
| `FEE_DISPOSITION_RECONCILES` | FeePolicyV2 disposition matches ingested rewards and monetary FEE_BURN. |
| `EXCHANGE_DVP_CONSERVES_ASSETS` | DVP is atomic and does not create assets. |
| `CUSTODY_RECONCILES` | Custody attribution reconciles. No blind duplicate submission. |
| `MACHINE_MANDATES_HOLD` | Machines cannot spend outside a mandate. |
| `GENESIS_POLICY_REMAINS_IMMUTABLE` | Active monetary policy version remains `sunrey.monetary.constitution.v1`. |
| `GOVERNANCE_VERSIONING_HOLDS` | Fee, validator, and MoonRey policy versions are recorded and monotonic. |
| `ORACLE_FAILURE_DOES_NOT_FABRICATE_FACTS` | Outage, staleness, conflict, and unit mismatch fail closed. |

Formal twin: `CROSS_ECONOMIC_INVARIANTS`.
