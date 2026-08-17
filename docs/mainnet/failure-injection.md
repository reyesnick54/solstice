# Failure injection

The rehearsal injects and recovers the following scenarios in-process:

| Scenario | Expected engineering result |
| --- | --- |
| One validator unavailable | Finality retained; catch-up on restore |
| Two validators unavailable | 5/7 voting power; expected finality behavior |
| One failure domain removed | BFT safety; availability by remaining power; RPC failover |
| Active signer unavailable | One signer becomes active; no equivocation |
| Local chain storage destroyed | Restore from verified snapshot; state root converges |
| PostgreSQL failure | Restore/recovery path; ledger/custody/exchange/events reconcile |
| One public RPC removed | SDK failover; consensus unaffected |
| Explorer index deleted | Rebuild to zero lag |
| Oracle provider unavailable + stale | Quorum/feed behavior; no fabricated fact |
| Screening / Travel Rule / HSM unavailable | Affected sandbox actions follow policy |
| Suspected signing-key compromise | Detection, restriction, evidence, replacement, recovery |
| No-quorum partition | No conflicting finality; safe rejoin |
| Network rejoin | Same finalized chain; no duplicate settlement or issuance |

`sunrey-launch inject-failure <SCENARIO>` and `sunrey-launch recover <SCENARIO>`
drive the same paths as the full rehearsal.
