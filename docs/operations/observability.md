# Observability

Engineering reference stack (local / development):

- OpenTelemetry Collector (`packages/sunrey-chain/ops/otel-collector.yaml`)
- Prometheus-compatible scrape and alert rules
- Grafana-compatible dashboards under `packages/sunrey-chain/ops/grafana/dashboards`

Validate with `sunrey-ops health` and the Chunk 55 config validator.

Traces may follow:

1. SDK submission → RPC → mempool → finalized block event → Explorer indexing
2. Exchange trade → settlement intent → custody → chain settlement → finality → reconciliation

Consensus-critical deterministic logic must not depend on tracing success.

Do not put private keys, raw KYC, PDV data, Clean Room raw data, consent
content, or HSM secret references into metrics, traces, or logs.
