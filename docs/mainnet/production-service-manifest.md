# Production service manifest (Candidate V2)

`ProductionServiceManifest` binds each candidate service to an
immutable release digest and configuration hash.

Services:

- validator
- sentry
- RPC
- Explorer
- oracle collector
- Exchange
- custody
- monitoring
- backup
- database
- release service

Each record includes:

- artifact digest (`sha256:<hex>` only)
- configuration hash
- workload identity
- network zone
- secret references
- resource profile
- health requirements

Floating tags such as `:latest` do not qualify. Configuration drift
is reported as `MATCH`, `AUTHORIZED_VARIANCE`, `UNAUTHORIZED_DRIFT`,
or `EVIDENCE_UNAVAILABLE`.
