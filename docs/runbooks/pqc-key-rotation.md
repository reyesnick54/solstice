# Runbook: PQC / hybrid key rotation (testnet)

Environment: local development or testnet. Not mainnet.

## Wallet

1. Unlock the development keystore.
2. Confirm the account's `approvedCryptoSuites` includes the next suite.
3. Rotate `Ed25519` → `sunrey-hybrid-ed25519-mldsa-v1` → optional
   `sunrey-mldsa-65-v1` using the wallet rotate API.
4. Historical classical transactions remain verifiable. Balances are
   not rewritten because keys change.
5. Never log seed material. Never put private keys in Explorer, events,
   SBOM, release manifests, or genesis.

## Validator

1. Register the future PQ/hybrid public key.
2. Schedule rotation through Chunk 40 `UpgradePlan` / epoch mechanics.
3. Keep the current classical consensus key until the activation height.
4. After activation, only the active suite may originate new votes.
5. Double-sign safety persists across rotation.

## Oracle / governance / machine identity

Same CryptoPolicy. High-value feeds may require hybrid at H2.
AI still cannot vote. Machine rotation does not change
owner/controller semantics.

## Failure

If the standardized PQ provider is unavailable when policy requires
hybrid or PQ, fail closed. Do not sign classical-only.
See [pqc-provider-failure.md](./pqc-provider-failure.md).
