# Production candidate

Configuration layers:

- `LOCAL`
- `TESTNET`
- `MAINNET_REHEARSAL`
- `PRODUCTION_CANDIDATE`

`PRODUCTION_CANDIDATE` does not imply active mainnet. `ENVIRONMENT`
remains `simulation`. `LIVE_*` flags remain false.

## Configuration signing

High-impact bundles are hashed and versioned. They reference:

- release artifact digest
- network candidate
- protocol version
- environment
- provider configuration hash

## Validation rejects

- testnet key reference in production candidate
- local fixture secret
- floating release artifact
- wrong network ID or chain ID
- public signer exposure
- public validator admin exposure
- unverified HSM marked verified
- floating container tags

## Local harness

`createLocalHarness` / `runLocalProductionCandidateHarness` emulate
secret manager, KMS, HSM, object storage, service identity, and
network policies with test-only credentials.
