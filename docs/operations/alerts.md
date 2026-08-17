# Alerts

All alerts are actionable. Severity is INFO, WARNING, HIGH, or CRITICAL.
These are engineering test targets, not production contracts.

| Code | Severity | Operator action |
| --- | --- | --- |
| CONSENSUS_FINALITY_DELAY | CRITICAL | Check connected voting power, partitions, and dashboards. Do not force finality. |
| VALIDATOR_MISSED_VOTES | HIGH | Inspect signer health and peer count. Review evidence pool. |
| VALIDATOR_SIGNER_UNAVAILABLE | CRITICAL | Run signer fencing. Confirm one active signer. See signer-failover.md. |
| VALIDATOR_PEER_ISOLATION | HIGH | Restore the failure domain or isolate the node from consensus duties. |
| RPC_HIGH_ERROR_RATE | HIGH | Remove the instance from health-aware routing. Consensus must continue. |
| DISK_LOW | WARNING | Free disk or fail over the cell. Do not continue WAL writes on a full disk. |
| EXPLORER_LAG | WARNING | Rebuild the index from finalized chain. Explorer is not authoritative. |
| ORACLE_QUORUM_UNAVAILABLE | HIGH | Restore adapter processes. Canonical observation sequence still applies. |
| CUSTODY_RECONCILIATION_MISMATCH | CRITICAL | Halt withdrawals. Reconcile to finalized holdings. Do not invent journals. |
| EXCHANGE_SETTLEMENT_BACKLOG | HIGH | Drain pending settlements after finality. Matching stays off-chain. |
| INTEROP_CLIENT_EXPIRING | WARNING | Refresh the light client before freeze. Relayers remain untrusted. |
