# Production SLO / SLI architecture

All operational SLOs are labeled `ENGINEERING_TEST_TARGETS`. They are
not contractual promises unless an external authority later approves a
separate contract.

## Operational domains

- consensus availability
- finality latency
- RPC availability
- state-sync success
- database availability
- backup success
- oracle freshness
- Explorer lag

## Economic integrity indicators

Integrity failures are not treated as ordinary latency:

- SunRey supply reconciliation
- DVP reconciliation
- custody reconciliation
- fee reconciliation
- treasury reconciliation
- MoonRey issuance reconciliation

These monitors do not provide investment predictions.
