# Disaster recovery

Engineering RPO/RTO values are stored as
`ENGINEERING_TEST_TARGETS`. They are not contractual production
commitments.

Each drill writes a machine-readable report:

- drill ID, scenario, components affected
- start and recovery timestamps
- measured RPO and RTO
- integrity checks, final state, failures, operator notes

```
sunrey-ops dr run END_TO_END_RESILIENCE
sunrey-ops dr report
```

End-to-end development scenario:

1. Network healthy
2. Create finalized transactions
3. Create snapshots and backups
4. Isolate one failure domain
5. Verify consensus where quorum permits
6. Destroy one node state and restore from snapshot
7. Destroy Explorer index and rebuild
8. Restore application database
9. Verify ledger/custody reconciliation without invented journals
10. Restore topology and confirm state roots agree
